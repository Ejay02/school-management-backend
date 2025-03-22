import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayDisconnect,
  OnGatewayConnection,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Roles } from 'src/shared/enum/role';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || true,
    credentials: true,
  },
})
export class AnnouncementGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(AnnouncementGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(private readonly jwtService: JwtService) {
    // Increase max listeners
    process.nextTick(() => {
      if (this.server) {
        this.server.setMaxListeners(20);
      }
    });
  }

  // Add connection handler with authentication
  async handleConnection(client: Socket) {
    try {
      this.logger.log(`Client attempting to connect: ${client.id}`);

      const token =
        client.handshake.auth.token ||
        client.handshake.headers.authorization?.split(' ')[1];

      if (!token) {
        this.logger.warn(
          `Client ${client.id} attempted connection without token`,
        );
        client.emit('error', { message: 'Authentication required' });
        client.disconnect();
        return;
      }

      // Verify the token
      try {
        const payload = this.jwtService.verify(token, {
          secret: process.env.JWT_SECRET,
        });
        client.data.user = payload;
        this.logger.log(
          `Client ${client.id} connected: ${payload.email || payload.username || payload.sub}`,
        );

        // Send successful connection event
        client.emit('connected', {
          message: 'Successfully connected to announcement updates',
          userId: payload.sub,
        });
      } catch (tokenError) {
        this.logger.warn(
          `Client ${client.id} provided invalid token: ${tokenError.message}`,
        );
        client.emit('error', { message: 'Invalid authentication token' });
        client.disconnect();
      }
    } catch (error) {
      this.logger.error(`Socket connection error: ${error.message}`);
      client.emit('error', { message: 'Connection error' });
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // Handle client joining role-specific rooms
  @SubscribeMessage('joinRooms')
  handleJoinRooms(
    client: Socket,
    payload: {
      role: Roles;
      classId?: string;
      userId: string;
    },
  ) {
    // Join role-specific room
    client.join(`role-${payload.role}`);

    // If it's a student or teacher, join class-specific room
    if (payload.classId) {
      client.join(`class-${payload.classId}`);
    }

    // Join user-specific room
    client.join(`user-${payload.userId}`);
  }

  // Emit to specific roles
  emitToRoles(announcement: any, targetRoles: Roles[]) {
    targetRoles.forEach((role) => {
      this.server.to(`role-${role}`).emit('newAnnouncement', announcement);
    });
  }

  // Emit to specific class
  emitToClass(classId: string, announcement: any) {
    this.server.to(`class-${classId}`).emit('newAnnouncement', announcement);
  }

  // Emit read status to specific user
  emitReadStatus(announcementId: string, userId: string, isRead: boolean) {
    this.server.to(`user-${userId}`).emit('readStatus', {
      announcementId,
      isRead,
    });
  }

  emitUnreadCountUpdate(userId: string, count: number) {
    // Emit to specific user
    this.server.to(`user-${userId}`).emit('unreadCount', { count });
  }

  emitToAll(announcement: any) {
    this.server.emit('newAnnouncement', announcement);
  }

  emitAnnouncementDeleted(announcementId: string) {
    // Emit to all connected clients
    this.server.emit('announcementDeleted', { id: announcementId });
  }

  emitArchiveStatus(announcementId: string, isArchived: boolean) {
    this.server.emit('announcementArchiveStatus', {
      id: announcementId,
      isArchived,
    });
  }
}
