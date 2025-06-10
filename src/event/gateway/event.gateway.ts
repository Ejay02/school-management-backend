import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Roles } from '../../shared/enum/role';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class EventGateway {
  @WebSocketServer()
  server: Server;

  constructor() {
    // Increase max listeners
    if (this.server) {
      this.server.setMaxListeners(20);
    }
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
  // emitToRoles(announcement: any, targetRoles: Roles[]) {
  //   targetRoles.forEach((role) => {
  //     this.server.to(`role-${role}`).emit('newAnnouncement', announcement);
  //   });
  // }

  // // Emit to specific class
  // emitToClass(classId: string, announcement: any) {
  //   this.server.to(`class-${classId}`).emit('newAnnouncement', announcement);
  // }

  // Emit read status to specific user
  emitReadStatus(eventId: string, userId: string, isRead: boolean) {
    this.server.to(`user-${userId}`).emit('eventReadStatus', {
      eventId,
      isRead,
    });
  }

  // Emit a new event creation to targeted roles
  emitEventCreated(event: any, targetRoles: Roles[]) {
    targetRoles.forEach((role) => {
      this.server.to(`role-${role}`).emit('eventCreated', {
        message: 'A new event has been created!',
        event,
        targetRoles,
      });
    });
  }
}
