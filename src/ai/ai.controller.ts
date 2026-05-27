import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { AiService } from './ai.service';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('chat')
  async chatWithAssistant(@Body('message') message?: string) {
    if (!message?.trim()) {
      throw new BadRequestException('Message is required');
    }
    if (message.length > 5000) {
      throw new BadRequestException('Message is too long');
    }

    return this.aiService.chat(message);
  }
}
