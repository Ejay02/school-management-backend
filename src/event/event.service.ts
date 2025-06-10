import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { Roles } from '../shared/enum/role';
import { EventVisibility } from './enum/eventVisibility';
import { GoogleCalendarService } from '../config/google.calender.config';
import { EventFilter } from './interface/event.filter';
import { CreateEventInput } from './input/create.event.input';
import { EditEventInput } from './input/edit.event.input';
import { Server } from 'socket.io';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { PaginationParams } from '../shared/pagination/types/pagination.types';
import { PrismaQueryBuilder } from '../shared/pagination/utils/prisma.pagination';
import { EventGateway } from './gateway/event.gateway';

@Injectable()
@WebSocketGateway()
export class EventService {
  @WebSocketServer()
  private readonly server: Server;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly eventGateway: EventGateway,
    private readonly googleCalendarService: GoogleCalendarService,
  ) {}

  async getEvents(
    filter: EventFilter,
    userId: string,
    userRole: Roles,
    params: PaginationParams,
  ) {
    try {
      const baseQuery: any = {
        where: {},
        include: {
          class: {
            include: {
              students: true,
            },
          },
        },

        orderBy: { createdAt: 'desc' },
      };

      // Apply filters from `filter` object
      if (filter?.type) {
        baseQuery.where.type = { contains: filter.type, mode: 'insensitive' };
      }
      if (filter?.startDate) {
        baseQuery.where.startTime = { gte: filter.startDate };
      }
      if (filter?.endDate) {
        baseQuery.where.endTime = { lte: filter.endDate };
      }
      if (filter?.classId) {
        baseQuery.where.classId = filter.classId;
      }

      // Role-based visibility rules
      if (userRole === Roles.ADMIN || userRole === Roles.SUPER_ADMIN) {
        baseQuery.where.OR = [
          { visibility: EventVisibility.PUBLIC },
          { creatorId: userId },
        ];
      } else {
        baseQuery.where.OR = [
          { creatorId: userId },
          { visibility: EventVisibility.PUBLIC },
        ];

        // Role-specific rules
        switch (userRole) {
          case Roles.PARENT:
            baseQuery.where.OR.push(
              { targetRoles: { has: Roles.PARENT } },
              { class: { students: { some: { parentId: userId } } } },
            );

            break;

          case Roles.TEACHER: {
            const teacherWithClasses = await this.prisma.teacher.findUnique({
              where: { id: userId },
              include: { classes: true },
            });

            const classIds =
              teacherWithClasses?.classes?.map((c) => c.id) || [];

            // Clear the OR array and rebuild it with proper conditions
            baseQuery.where.OR = [
              { creatorId: userId }, // Events created by the teacher

              // Public events with proper class association for role-targeted events
              {
                AND: [
                  { visibility: EventVisibility.PUBLIC },
                  {
                    OR: [
                      // Non-role-targeted public events
                      { targetRoles: { isEmpty: true } },

                      // Teacher-targeted public events (global or for teacher's classes)
                      {
                        AND: [
                          { targetRoles: { has: Roles.TEACHER } },
                          {
                            OR: [
                              { classId: null },
                              { class: { id: { in: classIds } } },
                            ],
                          },
                        ],
                      },
                      // Student-targeted public events (only for teacher's classes)
                      {
                        AND: [
                          { targetRoles: { has: Roles.STUDENT } },
                          { class: { id: { in: classIds } } },
                        ],
                      },
                      // Other role-targeted public events that aren't class-specific
                      {
                        AND: [
                          {
                            targetRoles: {
                              hasEvery: [
                                Roles.ADMIN,
                                Roles.SUPER_ADMIN,
                                Roles.PARENT,
                              ].filter(
                                (r) =>
                                  r !== Roles.TEACHER && r !== Roles.STUDENT,
                              ),
                            },
                          },
                          { classId: null },
                        ],
                      },
                    ],
                  },
                ],
              },

              // Teacher-targeted events (global or for teacher's classes)
              {
                AND: [
                  { targetRoles: { has: Roles.TEACHER } },
                  {
                    OR: [
                      { classId: null },
                      { class: { id: { in: classIds } } },
                    ],
                  },
                ],
              },
              // Student-targeted events (only for teacher's classes)
              {
                AND: [
                  { targetRoles: { has: Roles.STUDENT } },
                  { class: { id: { in: classIds } } },
                ],
              },
            ];

            break;
          }

          case Roles.STUDENT:
            baseQuery.where.OR.push(
              { targetRoles: { has: Roles.STUDENT } },
              { class: { students: { some: { id: userId } } } },
            );

            break;
        }
      }

      const searchFields = ['title', 'description', 'type'];

      const result = await PrismaQueryBuilder.paginateResponse(
        this.prisma.event,
        baseQuery,
        params,
        searchFields,
      );

      return result;
    } catch (error) {
      throw new InternalServerErrorException('Failed to fetch events', {
        cause: error,
      });
    }
  }

  async getEventById(eventId: string, userId: string, userRole: Roles) {
    try {
      console.log('hello taiga');
      // Base query includes the event by ID and its associated class details
      const query: any = {
        where: { id: eventId },
        include: {
          class: {
            include: {
              students: true,
            },
          },
        },
      };

      // For non-admin users, add visibility filters
      if (userRole !== Roles.ADMIN && userRole !== Roles.SUPER_ADMIN) {
        // First check if the user is the creator of the event
        const creatorCheck = await this.prisma.event.findFirst({
          where: {
            id: eventId,
            creatorId: userId,
          },
        });

        // If user is the creator, return the event without additional filters
        if (creatorCheck) {
          return creatorCheck;
        }

        // If not the creator, only allow public events with role-specific restrictions
        query.where.AND = [{ visibility: EventVisibility.PUBLIC }];

        // Role-specific restrictions for public events
        switch (userRole) {
          case Roles.PARENT:
            query.where.AND.push({
              OR: [
                { targetRoles: { has: Roles.PARENT } },
                { class: { students: { some: { parentId: userId } } } },
              ],
            });
            break;
          case Roles.TEACHER: {
            const teacherClasses = await this.prisma.teacher.findUnique({
              where: { id: userId },
              select: { classes: { select: { id: true } } },
            });

            const classIds = teacherClasses?.classes?.map((c) => c.id) || [];

            query.where.AND.push({
              OR: [
                // Teacher-targeted events (global or for teacher's classes)
                {
                  AND: [
                    { targetRoles: { has: Roles.TEACHER } },
                    {
                      OR: [
                        { classId: null },
                        { class: { id: { in: classIds } } },
                      ],
                    },
                  ],
                },
                // Student-targeted events (only for teacher's classes)
                {
                  AND: [
                    { targetRoles: { has: Roles.STUDENT } },
                    { class: { id: { in: classIds } } },
                  ],
                },
              ],
            });
            break;
          }
          case Roles.STUDENT:
            query.where.AND.push({
              OR: [
                { targetRoles: { has: Roles.STUDENT } },
                { class: { students: { some: { id: userId } } } },
              ],
            });
            break;
        }
      }

      const event = await this.prisma.event.findFirst(query);

      if (!event) {
        throw new NotFoundException('Event not found or access denied');
      }

      return event;
    } catch (error) {
      console.log('error:', error);
      throw new InternalServerErrorException('Failed to fetch event by id', {
        cause: error,
      });
    }
  }

  async createEvent(data: CreateEventInput, role: Roles, creatorId: string) {
    try {
      const { event } = await this.prisma.$transaction(async (tx) => {
        const duplicateEvent = await tx.event.findFirst({
          where: {
            title: data.title,
            startTime: data.startTime,
            ...(data.classId && { classId: data.classId }),
          },
        });
        if (duplicateEvent) {
          throw new Error('Event with this title already exists');
        }

        const visibility = data.visibility;
        let targetRoles = [role]; // Default to creator's role
        let classIdToUse = data.classId;

        // For private events, we don't need classId or targetRoles
        if (visibility === EventVisibility.PRIVATE) {
          classIdToUse = null;
          targetRoles = [role]; // Only creator's role for private events
        } else if (role === Roles.ADMIN || role === Roles.SUPER_ADMIN) {
          // Admins can create public events with specified target roles
          targetRoles = data.targetRoles || [role];
        } else if (role === Roles.TEACHER && data.classId) {
          // Check if the teacher has access to the class
          const teacherAccess = await this.prisma.class.findFirst({
            where: {
              id: data.classId,
              OR: [
                { supervisorId: creatorId },
                {
                  subjects: {
                    some: { teachers: { some: { id: creatorId } } },
                  },
                },
              ],
            },
          });

          if (teacherAccess) {
            // If teacher specified target roles, use those
            if (data.targetRoles && data.targetRoles.length > 0) {
              targetRoles = data.targetRoles;
            } else {
              // Otherwise fall back to all roles in the class
              targetRoles = await this.getClassRoles(data.classId);
            }
          } else {
            throw new ForbiddenException(
              'Teacher does not have access to this class',
            );
          }
        }

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
            ...(classIdToUse && {
              class: {
                connect: { id: classIdToUse },
              },
            }),
            status: 'SCHEDULED',
            visibility,
            targetRoles: {
              set: targetRoles,
            },
          },
        });

        return { event };
      });

      // Only send notifications and calendar invites for non-private events
      if (data.visibility !== EventVisibility.PRIVATE) {
        const targetUsers = await this.getTargetUsers({
          classId: data.classId,
          targetRoles: data.targetRoles,
        });

        try {
          await Promise.all([
            // Google Calendar API call - with error handling
            this.googleCalendarService
              .createCalendarEvent({
                ...event,
                attendees: targetUsers.map((user) => user.email),
              })
              .catch((error) => {
                console.warn(
                  'Google Calendar integration failed:',
                  error.message,
                );
                // Continue execution - don't let calendar failure stop event creation
              }),

            // Send email notifications
            this.sendNotifications(
              event,
              targetUsers,
              'event.notification',
              'New Event',
              {
                eventTitle: event.title,
                eventDescription: event.description,
                startTime: event.startTime.toLocaleString(),
                endTime: event.endTime.toLocaleString(),
                location: event.location || 'N/A',
                calendarLink: '#',
              },
            ),
          ]);
        } catch (error) {
          console.error('Error with notifications:', error);
        }
      }

      // Emit socket event to notify clients
      this.server.emit('eventCreated', {
        message: 'A new event has been created!',
        event,
        targetRoles:
          data.visibility === EventVisibility.PRIVATE
            ? [role]
            : data.targetRoles,
      });

      return event;
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

        if (!event)
          throw new NotFoundException(`Event with ID ${eventId} not found`);
        if (event.creatorId !== userId)
          throw new ForbiddenException('Unauthorized');

        // Handle visibility changes for private events
        let targetRoles = input.targetRoles ?? (event.targetRoles as Roles[]);
        let classIdToUse = input.classId ?? event.classId;

        // If changing to private visibility, reset classId and targetRoles
        if (input.visibility === EventVisibility.PRIVATE) {
          classIdToUse = null;
          // Only keep creator's role for private events
          const userRole = await this.getUserRole(userId);
          targetRoles = userRole ? [userRole] : [];
        }

        const editData: EditEventInput = {
          title: input.title ?? event.title,
          description: input.description ?? event.description,
          startTime: input.startTime ?? event.startTime,
          endTime: input.endTime ?? event.endTime,
          location: input.location ?? event.location,
          visibility: input.visibility ?? (event.visibility as EventVisibility),
          targetRoles: targetRoles,
          classId: classIdToUse,
        };

        const updatedEvent = await tx.event.update({
          where: { id: eventId },
          data: editData,
          include: {
            class: true,
          },
        });

        // Only send notifications for non-private events
        if (updatedEvent.visibility !== EventVisibility.PRIVATE) {
          const targetUsers = await this.getTargetUsers({
            classId: updatedEvent.classId,
            targetRoles: updatedEvent.targetRoles as Roles[],
          });

          try {
            await Promise.all([
              this.googleCalendarService
                .updateCalendarEvent(eventId, {
                  ...updatedEvent,
                  attendees: targetUsers.map((user) => user.email),
                })
                .catch((error) => {
                  console.warn('Google Calendar update failed:', error.message);
                  // Continue execution even if calendar update fails
                }),
              this.sendNotifications(
                updatedEvent,
                targetUsers,
                'event.update',
                'Event Updated',
                {
                  eventTitle: updatedEvent.title,
                  eventDescription: updatedEvent.description,
                  startTime: updatedEvent.startTime.toLocaleString(),
                  endTime: updatedEvent.endTime.toLocaleString(),
                  location: updatedEvent.location || 'N/A',
                  calendarLink: '#',
                },
              ).catch((error) => {
                console.warn('Email notification failed:', error.message);
              }),
            ]);
          } catch (error) {
            console.error(
              'Error with notifications or calendar update:',
              error,
            );
            // Don't throw the error, just log it
          }
        }

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

  // Helper method to get user role
  private async getUserRole(userId: string): Promise<Roles | null> {
    const admin = await this.prisma.admin.findUnique({ where: { id: userId } });
    if (admin) return Roles.ADMIN;

    const teacher = await this.prisma.teacher.findUnique({
      where: { id: userId },
    });
    if (teacher) return Roles.TEACHER;

    const student = await this.prisma.student.findUnique({
      where: { id: userId },
    });
    if (student) return Roles.STUDENT;

    const parent = await this.prisma.parent.findUnique({
      where: { id: userId },
    });
    if (parent) return Roles.PARENT;

    return null;
  }

  private async getTargetUsers(event: {
    classId?: string | null;
    targetRoles: Roles[];
  }) {
    try {
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
                    // surname: true,
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
                    // surname: true,
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
                    // surname: true,
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
                    // surname: true,
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
    } catch (error) {
      throw new InternalServerErrorException('Failed to fetch target users', {
        cause: error,
      });
    }
  }

  private async getClassRoles(
    classId: string,
    specifiedRoles?: Roles[],
  ): Promise<Roles[]> {
    const roles: Roles[] = [];

    // Get students in the class
    const students = await this.prisma.student.findMany({
      where: {
        classId,
      },
      include: {
        parent: true,
      },
    });

    if (students.length > 0) {
      roles.push(Roles.STUDENT);
      if (students.some((student) => student.parent)) {
        roles.push(Roles.PARENT);
      }
    }

    // Get teachers associated with the class
    const classData = await this.prisma.class.findUnique({
      where: {
        id: classId,
      },
      include: {
        subjects: {
          include: {
            teachers: true,
          },
        },
      },
    });

    if (classData) {
      // Check for supervisor
      if (classData.supervisorId) {
        roles.push(Roles.TEACHER);
      }

      // Check for teachers in subjects
      if (classData.subjects?.some((subject) => subject.teachers?.length > 0)) {
        roles.push(Roles.TEACHER);
      }
    }

    // Remove duplicate roles
    // return [...new Set(roles)];
    const availableRoles = [...new Set(roles)];

    // If specific roles were requested, filter to include only those that exist in the class
    if (specifiedRoles && specifiedRoles.length > 0) {
      return specifiedRoles.filter((role) => availableRoles.includes(role));
    }

    // Otherwise return all roles present in the class
    return availableRoles;
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
        template: `${template}.hbs`,
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
        eventId,
        message: 'An event has been deleted!',
      });

      this.server.emit('deleteEvent', {
        eventId,
        message: 'An event has been deleted!',
      });

      return true;
    });
  }

  async markEventAsRead(eventId: string, userId: string) {
    try {
      // Check if the record already exists to avoid duplicates
      return await this.prisma.$transaction(async (tx) => {
        // Create or update read status
        await tx.eventRead.upsert({
          where: {
            eventId_userId: {
              eventId,
              userId,
            },
          },
          create: {
            eventId,
            userId,
          },
          update: {
            readAt: new Date(), // Update if record already exists
          },
        });

        // Emit read status update
        this.eventGateway.emitReadStatus(eventId, userId, true);

        return true;
      });
    } catch (error) {
      throw new InternalServerErrorException('Failed to mark event as read', {
        cause: error,
      });
    }
  }
}
