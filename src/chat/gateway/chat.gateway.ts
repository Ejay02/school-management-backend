import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from '../../shared/auth/auth.service';
import { ChatConversation, ChatMessage } from '../types/chat.types';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || true,
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(ChatGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  private getRefreshToken(client: Socket): string | undefined {
    const refreshToken =
      client.handshake.auth?.refreshToken ??
      client.handshake.headers['x-refresh-token'];

    return Array.isArray(refreshToken) ? refreshToken[0] : refreshToken;
  }

  private async authenticateSocket(client: Socket) {
    const token =
      client.handshake.auth.token ||
      client.handshake.headers.authorization?.split(' ')[1];

    if (!token) {
      throw new Error('AUTH_TOKEN_MISSING');
    }

    try {
      return {
        payload: this.jwtService.verify(token, {
          secret: process.env.JWT_SECRET,
        }),
      };
    } catch (tokenError) {
      const isExpired =
        tokenError?.name === 'TokenExpiredError' ||
        tokenError?.message === 'jwt expired';

      if (!isExpired) {
        throw tokenError;
      }

      const refreshToken = this.getRefreshToken(client);
      if (!refreshToken) {
        const expiredError = new Error('SOCKET_TOKEN_EXPIRED');
        (expiredError as any).code = 'SOCKET_TOKEN_EXPIRED';
        throw expiredError;
      }

      const newTokens = await this.authService.refreshTokens(refreshToken);
      const payload = this.jwtService.verify(newTokens.accessToken, {
        secret: process.env.JWT_SECRET,
      });

      return {
        payload,
        newTokens,
      };
    }
  }

  async handleConnection(client: Socket) {
    try {
      const { payload, newTokens } = await this.authenticateSocket(client);
      client.data.user = payload;

      if (newTokens) {
        client.emit('authRefreshed', newTokens);
      }

      const userId = payload.sub;
      if (userId) {
        client.join(`user-${userId}`);
      }
    } catch (error) {
      if (error?.message === 'AUTH_TOKEN_MISSING') {
        client.emit('error', { message: 'Authentication required' });
      } else if (error?.message === 'SOCKET_TOKEN_EXPIRED') {
        client.emit('error', {
          code: 'TOKEN_EXPIRED',
          message: 'Socket authentication token expired',
        });
      } else {
        client.emit('error', { message: 'Invalid authentication token' });
      }

      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('chatTyping')
  async handleChatTyping(
    client: Socket,
    payload: { conversationId: string; isTyping: boolean },
  ) {
    const userId = client.data?.user?.sub;
    if (!userId) {
      client.disconnect();
      return;
    }

    const conversationId = payload?.conversationId;
    if (!conversationId) {
      return;
    }

    const membership = await this.prisma.chatConversationMember.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
      select: { id: true },
    });

    if (!membership) {
      client.disconnect();
      return;
    }

    const members = await this.prisma.chatConversationMember.findMany({
      where: { conversationId },
      select: { userId: true },
    });

    const participantIds = members
      .map((member) => member.userId)
      .filter((memberId) => memberId && memberId !== userId);

    const safePayload = {
      conversationId,
      userId,
      isTyping: Boolean(payload?.isTyping),
      sentAt: new Date().toISOString(),
    };

    participantIds.forEach((participantId) => {
      this.server.to(`user-${participantId}`).emit('chatTyping', safePayload);
    });
  }

  emitConversationUpdated(userId: string, conversation: ChatConversation) {
    this.server
      .to(`user-${userId}`)
      .emit('chatConversationUpdated', conversation);
  }

  emitMessageCreated(userId: string, message: ChatMessage) {
    this.server.to(`user-${userId}`).emit('chatMessageCreated', message);
  }

  emitMessageDeleted(
    userId: string,
    payload: { conversationId: string; messageId: string },
  ) {
    this.server.to(`user-${userId}`).emit('chatMessageDeleted', payload);
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
