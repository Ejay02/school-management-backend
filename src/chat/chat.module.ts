import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ChatResolver } from './chat.resolver';
import { ChatService } from './chat.service';
import { ChatGateway } from './gateway/chat.gateway';

@Module({
  imports: [PrismaModule],
  providers: [ChatResolver, ChatService, ChatGateway],
  exports: [ChatService, ChatGateway],
})
export class ChatModule {}
