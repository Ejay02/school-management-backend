import {
  BadGatewayException,
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class AiService {
  constructor(private readonly prisma: PrismaService) {}

  private async getSchoolContext() {
    const state = await this.prisma.setupState.upsert({
      where: { id: 'default' },
      update: {},
      create: { id: 'default' },
      select: { schoolName: true, schoolAddress: true },
    });

    const schoolName =
      typeof state.schoolName === 'string' && state.schoolName.trim().length
        ? state.schoolName.trim()
        : 'My School';
    const schoolAddress =
      typeof state.schoolAddress === 'string' &&
      state.schoolAddress.trim().length
        ? state.schoolAddress.trim()
        : null;

    return { schoolName, schoolAddress };
  }

  private async buildSchoolPrompt(userMessage: string) {
    const { schoolName, schoolAddress } = await this.getSchoolContext();
    return `
You are an AI assistant for the school portal.
Provide accurate, concise information based on the school's profile.
If the query is not clearly answerable, suggest contacting the school office.

School Context:
- Name: ${schoolName}
${schoolAddress ? `- Address: ${schoolAddress}` : ''}

User Query:
${userMessage}
    `.trim();
  }

  private extractAssistantText(content: unknown): string | null {
    if (typeof content === 'string') {
      return content.trim();
    }

    if (Array.isArray(content)) {
      const combined = content
        .map((item) => {
          if (typeof item === 'string') {
            return item;
          }

          if (this.isTextContentPart(item)) {
            return typeof item.text === 'string' ? item.text : '';
          }

          return '';
        })
        .join('\n')
        .trim();

      return combined || null;
    }

    return null;
  }

  private isTextContentPart(
    value: unknown,
  ): value is { type: 'text'; text?: unknown } {
    if (!value || typeof value !== 'object') return false;
    const record = value as Record<string, unknown>;
    return record.type === 'text' && 'text' in record;
  }

  private getUpstreamErrorMessage(data: unknown): string {
    if (!data || typeof data !== 'object') return 'AI assistant request failed';
    const record = data as Record<string, unknown>;
    const error = record.error;
    const message = record.message;
    if (typeof error === 'string' && error.trim().length) return error;
    if (typeof message === 'string' && message.trim().length) return message;
    return 'AI assistant request failed';
  }

  private getAssistantMessageContent(data: unknown): unknown {
    if (!data || typeof data !== 'object') return undefined;
    const record = data as Record<string, unknown>;
    const choices = record.choices;
    if (!Array.isArray(choices) || choices.length === 0) return undefined;
    const firstChoice = choices[0];
    if (!firstChoice || typeof firstChoice !== 'object') return undefined;
    const choiceRecord = firstChoice as Record<string, unknown>;
    const message = choiceRecord.message;
    if (!message || typeof message !== 'object') return undefined;
    const messageRecord = message as Record<string, unknown>;
    return messageRecord.content;
  }

  async chat(message: string) {
    const token =
      process.env.HF_TOKEN ||
      process.env.HUGGINGFACE_API_KEY ||
      process.env.HUGGINGFACE_TOKEN;

    if (!token) {
      throw new ServiceUnavailableException(
        'AI assistant is not configured on the server',
      );
    }

    const model = process.env.HUGGINGFACE_MODEL || 'Qwen/Qwen2.5-7B-Instruct';
    const prompt = await this.buildSchoolPrompt(message.trim());
    const { schoolName } = await this.getSchoolContext();

    const response = await fetch(
      'https://router.huggingface.co/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'system',
              content: `You are the ${schoolName} assistant. Answer clearly and concisely using the provided school context. If a question is outside the known school context, suggest contacting the school office.`,
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          max_tokens: 250,
          temperature: 0.7,
          top_p: 0.95,
        }),
      },
    );

    let data: unknown = null;
    try {
      data = await response.json();
    } catch {
      throw new BadGatewayException(
        'AI assistant returned an unreadable response',
      );
    }

    if (!response.ok) {
      throw new BadGatewayException(this.getUpstreamErrorMessage(data));
    }

    const generatedText = this.extractAssistantText(
      this.getAssistantMessageContent(data),
    );

    if (!generatedText || typeof generatedText !== 'string') {
      throw new InternalServerErrorException(
        'AI assistant returned an empty response',
      );
    }

    return {
      text: generatedText.trim(),
      model,
    };
  }
}
