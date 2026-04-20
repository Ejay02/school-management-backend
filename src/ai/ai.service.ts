import {
  BadGatewayException,
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';

@Injectable()
export class AiService {
  private buildSchoolPrompt(userMessage: string) {
    return `
You are an AI assistant for Eduhub Portal.
Provide accurate, concise information based on the school's profile.
If the query is not clearly answerable, suggest contacting the school office.

School Context:
- Name: Eduhub Portal
- Location: 123 School Street
- Grades: Primary 1-6, Junior Secondary 1 to Senior Secondary 3
- Total Students: 360

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

          if (
            item &&
            typeof item === 'object' &&
            'type' in item &&
            (item as any).type === 'text'
          ) {
            return (item as any).text || '';
          }

          return '';
        })
        .join('\n')
        .trim();

      return combined || null;
    }

    return null;
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
    const prompt = this.buildSchoolPrompt(message.trim());

    const response = await fetch('https://router.huggingface.co/v1/chat/completions', {
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
            content:
              'You are the Eduhub Portal assistant. Answer clearly and concisely using the provided school context. If a question is outside the known school context, suggest contacting the school office.',
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
    });

    let data: any = null;
    try {
      data = await response.json();
    } catch {
      throw new BadGatewayException(
        'AI assistant returned an unreadable response',
      );
    }

    if (!response.ok) {
      const upstreamMessage =
        data?.error || data?.message || 'AI assistant request failed';
      throw new BadGatewayException(upstreamMessage);
    }

    const generatedText = this.extractAssistantText(
      data?.choices?.[0]?.message?.content,
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
