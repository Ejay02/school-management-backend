import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { Roles } from '../shared/enum/role';
import { EventVisibility } from './enum/eventVisibility';
import { GoogleCalendarService } from 'src/config/google.calender.config';
import { EventFilter } from './interface/event.filter';
import { CreateEventInput } from './input/create.event.input';
import { EditEventInput } from './input/edit.event.input';
import { Server } from 'socket.io';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';

@Injectable()
@WebSocketGateway()
export class EventService {
  @WebSocketServer()
  private readonly server: Server;

  constructor(
    private prisma: PrismaService,
    private mailService: MailService,
    private googleCalendarService: GoogleCalendarService,
  ) {}

  async getEvents(filter: EventFilter, userId: string, userRole: Roles) {
    const baseQuery: any = {};

    // Apply filters from `filter` object
    if (filter?.type) {
      baseQuery.type = { contains: filter.type, mode: 'insensitive' };
    }
    if (filter?.startDate) baseQuery.startTime = { gte: filter.startDate };
    if (filter?.endDate) baseQuery.endTime = { lte: filter.endDate };
    if (filter?.classId) baseQuery.classId = filter.classId;

    // Role-based visibility rules
    if (userRole === Roles.ADMIN || userRole === Roles.SUPER_ADMIN) {
      // Admin: See all public events and their private events
      baseQuery.OR = [
        { visibility: EventVisibility.PUBLIC }, // Public events
        { creatorId: userId }, // Admin's private events
      ];
    } else {
      // Non-admin users: Parents, Teachers, Students
      baseQuery.OR = [
        { creatorId: userId }, // User's private events
        { visibility: EventVisibility.PUBLIC }, // Public events
      ];

      // Role-specific rules
      switch (userRole) {
        case Roles.PARENT:
          baseQuery.OR.push(
            { targetRoles: { has: Roles.PARENT } }, // Events for parents
            { class: { students: { some: { parentId: userId } } } }, // Events for their child's class
          );
          break;

        case Roles.TEACHER:
          baseQuery.OR.push(
            { targetRoles: { has: Roles.TEACHER } }, // Events for teachers
            { class: { teachers: { some: { id: userId } } } }, // Events for their class/students
          );
          break;

        case Roles.STUDENT:
          baseQuery.OR.push(
            { targetRoles: { has: Roles.STUDENT } }, // Events for students
            { class: { students: { some: { id: userId } } } }, // Events for their class
          );
          break;
      }
    }

    // Query the database
    return this.prisma.event.findMany({
      where: baseQuery,
      include: {
        class: true, // Include class details
      },
      orderBy: { startTime: 'asc' }, // Sort by start time (ascending)
    });
  }

  async createEvent(data: CreateEventInput, role: Roles, creatorId: string) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Enforce visibility and target roles based on the creator's role
        const visibility =
          role === Roles.ADMIN ? data.visibility : EventVisibility.PRIVATE;
        const targetRoles = role === Roles.ADMIN ? data.targetRoles : [role];

        // Create event with role-based restrictions
        const event = await tx.event.create({
          data: {
            title: data.title,
            description: data.description,
            startTime: data.startTime,
            endTime: data.endTime,
            location: data.location,
            type: 'ACADEMIC',
            creatorId,
            ...(data.classId && {
              class: {
                connect: { id: data.classId },
              },
            }),
            status: 'SCHEDULED',
            visibility,
            // targetRoles,
            targetRoles: {
              set: data.targetRoles || [], // Ensure this sets the targetRoles correctly
            },
          },
        });

        // Handle additional logic for Admin-created events
        // if (role === Roles.ADMIN && visibility === EventVisibility.PUBLIC) {
        const targetUsers = await this.getTargetUsers({
          classId: data.classId,
          targetRoles,
        });

        await this.googleCalendarService.createCalendarEvent({
          ...event,
          attendees: targetUsers.map((user) => user.email),
        });
        // }

        // Emit socket event to notify clients
        this.server.emit('eventCreated', {
          message: 'A new event has been created!',
          event,
          targetRoles,
        });

        return event;
      });
    } catch (error) {
      if (error.code === 'P2002') {
        throw new Error('Event with this title already exists');
      }
      throw error;
    }
  }

  async updateEvent(eventId: string, input: EditEventInput, userId: string) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const event = await tx.event.findUnique({ where: { id: eventId } });

        if (!event) throw new NotFoundException('Event not found');
        if (event.creatorId !== userId)
          throw new ForbiddenException('Unauthorized');

        const editData: EditEventInput = {
          title: input.title ?? event.title,
          description: input.description ?? event.description,
          startTime: input.startTime ?? event.startTime,
          endTime: input.endTime ?? event.endTime,
          location: input.location ?? event.location,
          visibility: input.visibility ?? (event.visibility as EventVisibility),
          targetRoles: input.targetRoles ?? (event.targetRoles as Roles[]),
          classId: input.classId ?? event.classId,
        };

        const updatedEvent = await tx.event.update({
          where: { id: eventId },
          data: editData,
          include: {
            class: true,
          },
        });

        const targetUsers = await this.getTargetUsers({
          classId: updatedEvent.classId,
          targetRoles: updatedEvent.targetRoles as Roles[],
        });

        await Promise.all([
          this.googleCalendarService.updateCalendarEvent(eventId, {
            ...updatedEvent,
            attendees: targetUsers.map((user) => user.email),
          }),
          this.sendNotifications(
            updatedEvent,
            targetUsers,
            'event-update',
            'Event Updated',
          ),
        ]);

        // Emit socket event to notify clients
        this.server.emit('eventUpdated', {
          message: 'An event has been updated!',
          event: updatedEvent,
        });

        return updatedEvent;
      });
    } catch (error) {
      if (error.code === 'P2002') {
        throw new Error('Event with this title already exists');
      }
      throw error;
    }
  }

  private async getTargetUsers(event: {
    classId?: string | null;
    targetRoles: Roles[];
  }) {
    const queries = [];

    // Only process target users if it's an admin creating the event
    for (const role of event.targetRoles) {
      switch (role) {
        case Roles.STUDENT:
          if (event.classId) {
            queries.push(
              this.prisma.student.findMany({
                where: { classId: event.classId },
                select: {
                  email: true,
                  name: true,
                },
              }),
            );
          } else {
            // If no classId, get all students
            queries.push(
              this.prisma.student.findMany({
                select: {
                  email: true,
                  name: true,
                },
              }),
            );
          }
          break;

        case Roles.TEACHER:
          if (event.classId) {
            queries.push(
              this.prisma.teacher.findMany({
                where: {
                  classes: { some: { id: event.classId } },
                },
                select: {
                  email: true,
                  name: true,
                },
              }),
            );
          } else {
            queries.push(
              this.prisma.teacher.findMany({
                select: {
                  email: true,
                  name: true,
                },
              }),
            );
          }
          break;

        case Roles.PARENT:
          if (event.classId) {
            queries.push(
              this.prisma.parent.findMany({
                where: {
                  students: { some: { classId: event.classId } },
                },
                select: {
                  email: true,
                  name: true,
                },
              }),
            );
          } else {
            queries.push(
              this.prisma.parent.findMany({
                select: {
                  email: true,
                  name: true,
                },
              }),
            );
          }
          break;
      }
    }
    const results = await Promise.all(queries);
    return results.flat().filter((user) => Boolean(user?.email));
  }

  private async sendNotifications(
    event: any,
    targetUsers: { email: string; name: string }[],
    template: string,
    subjectPrefix: string,
    additionalContext = {},
  ) {
    const emailPromises = targetUsers.map((user) =>
      this.mailService.sendMail({
        to: user.email,
        subject: `${subjectPrefix}: ${event.title}`,
        template,
        context: {
          userName: user.name,
          eventTitle: event.title,
          eventDescription: event.description,
          startTime: event.startTime,
          endTime: event.endTime,
          location: event.location,
          ...additionalContext,
        },
      }),
    );

    return Promise.all(emailPromises);
  }

  async cancelEvent(id: string, reason: string, creatorId: string) {
    try {
      return await this.prisma.$transaction(async (prisma) => {
        const event = await prisma.event.findUnique({
          where: { id },
          include: {
            class: true,
          },
        });

        if (!event) throw new NotFoundException('Event not found');
        if (event.creatorId !== creatorId)
          throw new ForbiddenException('Unauthorized');

        const cancelledEvent = await prisma.event.update({
          where: { id },
          data: {
            status: 'CANCELLED',
            description: `${event.description}\n\nCANCELLED: ${reason}`,
          },
          include: {
            class: true,
          },
        });

        const targetUsers = await this.getTargetUsers({
          classId: cancelledEvent.classId,
          targetRoles: cancelledEvent.targetRoles as Roles[],
        });

        await Promise.all([
          this.googleCalendarService.deleteCalendarEvent(event.id),
          this.sendNotifications(
            cancelledEvent,
            targetUsers,
            'event-cancellation',
            'Event Cancelled',
            { cancellationReason: reason },
          ),
        ]);

        // Emit socket event to notify clients
        this.server.emit('eventUpdated', {
          message: 'An event has been updated!',
          event: cancelledEvent,
        });

        return cancelledEvent;
      });
    } catch (error) {
      if (error.code === 'P2002') {
        throw new Error('Database constraint violation');
      }
      throw error;
    }
  }

  async deleteEvent(
    eventId: string,
    userId: string,
    userRole: Roles,
  ): Promise<boolean> {
    return this.prisma.$transaction(async (prisma) => {
      const event = await prisma.event.findUnique({
        where: { id: eventId },
      });

      if (!event) throw new NotFoundException('Event not found');

      const isAdminOrSuperAdmin =
        userRole === Roles.ADMIN || userRole === Roles.SUPER_ADMIN;

      // Public events can only be deleted by ADMIN or SUPER_ADMIN
      if (event.visibility === EventVisibility.PUBLIC && !isAdminOrSuperAdmin) {
        throw new ForbiddenException(
          'Only admins or super admins can delete public events',
        );
      }

      // Other events can only be deleted by their creator
      if (event.creatorId !== userId) {
        throw new ForbiddenException(
          'You can only delete your own events or need admin privileges',
        );
      }

      await prisma.event.delete({
        where: { id: eventId },
      });

      this.server.emit('deleteEvent', {
        message: 'An event has been deleted!',
      });

      return true;
    });
  }
}
