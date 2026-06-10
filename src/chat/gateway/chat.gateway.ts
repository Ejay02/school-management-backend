import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { ChatConversation, ChatMessage } from '../types/chat.types';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || true,
    credentials: true,
  },
})
export class ChatGateway {
  @WebSocketServer()
  server: Server;

  emitConversationUpdated(userId: string, conversation: ChatConversation) {
    this.server
      .to(`user-${userId}`)
      .emit('chatConversationUpdated', conversation);
  }

  emitMessageCreated(userId: string, message: ChatMessage) {
    this.server.to(`user-${userId}`).emit('chatMessageCreated', message);
  }

  emitConversationRead(
    userId: string,
    payload: {
      conversationId: string;
      readerId: string;
      readAt: string;
    },
  ) {
    this.server.to(`user-${userId}`).emit('chatConversationRead', payload);
  }
}
