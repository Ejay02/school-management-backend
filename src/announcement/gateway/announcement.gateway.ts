import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Roles } from 'src/shared/enum/role';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class AnnouncementGateway {
  @WebSocketServer()
  server: Server;

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
}
