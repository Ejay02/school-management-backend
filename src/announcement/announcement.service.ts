import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

import { AnnouncementGateway } from './gateway/announcement.gateway';
import { Roles } from 'src/shared/enum/role';
import { PaginationParams } from 'src/shared/pagination/types/pagination.types';
import { PrismaQueryBuilder } from 'src/shared/pagination/utils/prisma.pagination';

@Injectable()
export class AnnouncementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly announcementGateway: AnnouncementGateway,
  ) {}

  async createAnnouncement(data: {
    title: string;
    content: string;
    creatorId: string;
    creatorRole: Roles;
    classId?: string;
    targetRoles?: Roles[];
  }) {
    try {
      // Use a Prisma transaction to ensure atomicity
      const announcement = await this.prisma.$transaction(async (tx) => {
        const now = new Date();
        const oneDayAgo = new Date();
        oneDayAgo.setDate(now.getDate() - 1); // 24-hour window

        // Check for a duplicate in the last 24 hours
        const existingAnnouncement = await this.prisma.announcement.findFirst({
          where: {
            title: data.title,
            content: data.content,
            createdAt: { gte: oneDayAgo }, // Only check recent announcements
          },
        });

        if (existingAnnouncement) {
          throw new Error(
            'Duplicate announcement detected within the last 24 hours.',
          );
        }
        // Create the announcement
        const announcement = await tx.announcement.create({
          data: {
            title: data.title,
            content: data.content,
            classId: data.classId,
            creatorId: data.creatorId,
            creatorRole: data.creatorRole,
            targetRoles: {
              set: data.targetRoles || [], // Ensure this sets the targetRoles correctly
            },
          },
          include: {
            class: true,
          },
        });
        return announcement;
      });

      this.announcementGateway.server.emit('newAnnouncement', announcement);

      // Emit the announcement after creating it
      if (announcement.classId) {
        // If it's a class-specific announcement (from a teacher)
        this.announcementGateway.emitToClass(
          announcement.classId,
          announcement,
        );
      } else if (data.targetRoles && data.targetRoles.length > 0) {
        // If it's a role-targeted announcement (from admin)
        this.announcementGateway.emitToRoles(announcement, data.targetRoles);
      } else {
        // If no classId and no targetRoles, emit to all users
        this.announcementGateway.emitToAll(announcement);
      }

      return announcement; // The transaction will be committed, and the announcement is returned
    } catch (error) {
      throw new InternalServerErrorException('Error creating announcement');
    }
  }

  async getAllAnnouncements(
    userId: string,
    role: Roles,
    params: PaginationParams & { isArchived?: boolean },
  ) {
    try {
      const baseQuery: any = {
        where: {},
        include: {
          class: true,
          reads: {
            where: { userId },
            select: { readAt: true },
          },
          archives: {
            where: { userId },
            select: { archivedAt: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      };

      // Filter by archive status
      if (params.isArchived) {
        // Show only archived announcements for this user
        baseQuery.where.archives = {
          some: {
            userId,
          },
        };
      } else {
        // Show only non-archived announcements for this user
        baseQuery.where.archives = {
          none: {
            userId,
          },
        };
      }

      // Build the where clause based on role
      if ([Roles.SUPER_ADMIN, Roles.ADMIN].includes(role)) {
        // Admins can see all announcements (no additional filters)
      } else if (role === Roles.TEACHER) {
        const teacherClassIds = await this.prisma.lesson.findMany({
          where: { teacherId: userId },
          select: { classId: true },
        });

        const classIdList = teacherClassIds.map((lesson) => lesson.classId);

        // Preserve isArchived condition by using AND
        baseQuery.where = {
          AND: [
            baseQuery.where,
            {
              OR: [
                // Only announcements for classes they teach
                {
                  classId: {
                    in: classIdList,
                  },
                },
                // Only announcements they created themselves
                { creatorId: userId },
                // Only global announcements targeting teachers (with no class)
                {
                  AND: [
                    { targetRoles: { hasSome: [Roles.TEACHER] } },
                    { creatorRole: { in: [Roles.ADMIN, Roles.SUPER_ADMIN] } },
                    { classId: null }, // Only truly global announcements
                  ],
                },
              ],
            },
          ],
        };
      } else if (role === Roles.STUDENT) {
        // Preserve isArchived condition by using AND
        baseQuery.where = {
          AND: [
            baseQuery.where,
            {
              OR: [
                // Only announcements for their class
                { classId: userId },
                // Only global announcements targeting students (with no class)
                {
                  AND: [
                    { targetRoles: { hasSome: [Roles.STUDENT] } },
                    {
                      creatorRole: {
                        in: [Roles.ADMIN, Roles.SUPER_ADMIN, Roles.TEACHER],
                      },
                    },
                    // Ensure no class-specific announcements from other classes
                    {
                      OR: [{ classId: null }, { classId: userId }],
                    },
                  ],
                },
              ],
            },
          ],
        };
      } else if (role === Roles.PARENT) {
        const childrenClasses = await this.prisma.student.findMany({
          where: { parentId: userId },
          select: { classId: true },
        });

        const childClassIdList = childrenClasses.map(
          (student) => student.classId,
        );

        // Preserve isArchived condition by using AND
        baseQuery.where = {
          AND: [
            baseQuery.where,
            {
              OR: [
                // Only announcements for their children's classes
                {
                  classId: {
                    in: childClassIdList,
                  },
                },
                // Only global announcements targeting parents (with no class)
                {
                  AND: [
                    { targetRoles: { hasSome: [Roles.PARENT] } },
                    {
                      creatorRole: {
                        in: [Roles.ADMIN, Roles.SUPER_ADMIN, Roles.TEACHER],
                      },
                    },
                    // Ensure no class-specific announcements from other classes
                    {
                      OR: [
                        { classId: null },
                        { classId: { in: childClassIdList } },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        };
      } else {
        throw new ForbiddenException(
          'You do not have permission to view announcements',
        );
      }

      // Define searchable fields for announcements
      const searchFields = ['title', 'content'];

      return await PrismaQueryBuilder.paginateResponse(
        this.prisma.announcement,
        baseQuery,
        params,
        searchFields,
      );
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      throw new InternalServerErrorException('Failed to fetch announcements');
    }
  }

  async getAnnouncementById(
    userId: string,
    role: Roles,
    announcementId: string,
  ) {
    try {
      // Fetch the announcement from the database
      const announcement = await this.prisma.announcement.findUnique({
        where: { id: announcementId },
        include: {
          class: true, // Include class details if available
        },
      });

      if (!announcement) {
        throw new ForbiddenException('Announcement not found');
      }

      // Authorization logic based on the user's role
      if ([Roles.SUPER_ADMIN, Roles.ADMIN].includes(role)) {
        // Admins and super admins can access any announcement
        return announcement;
      }

      if (role === Roles.TEACHER) {
        // Check if the teacher is authorized to view this announcement
        const teacherClassIds = await this.prisma.lesson.findMany({
          where: { teacherId: userId },
          select: { classId: true },
        });

        const isTeacherAuthorized =
          announcement.classId &&
          teacherClassIds.some(
            (lesson) => lesson.classId === announcement.classId,
          );

        const isGeneralAnnouncement =
          announcement.targetRoles.includes(Roles.TEACHER) &&
          [Roles.ADMIN, Roles.SUPER_ADMIN].includes(
            announcement.creatorRole as Roles,
          );

        if (!isTeacherAuthorized && !isGeneralAnnouncement) {
          throw new ForbiddenException(
            'You do not have permission to view this announcement',
          );
        }

        return announcement;
      }

      if (role === Roles.STUDENT) {
        // Check if the student is authorized to view this announcement
        const isStudentAuthorized =
          announcement.classId === userId ||
          (announcement.targetRoles.includes(Roles.STUDENT) &&
            [Roles.ADMIN, Roles.SUPER_ADMIN, Roles.TEACHER].includes(
              announcement.creatorRole as Roles,
            ));

        if (!isStudentAuthorized) {
          throw new ForbiddenException(
            'You do not have permission to view this announcement',
          );
        }

        return announcement;
      }

      if (role === Roles.PARENT) {
        // Check if the parent is authorized to view this announcement
        const childrenClasses = await this.prisma.student.findMany({
          where: { parentId: userId },
          select: { classId: true },
        });

        const isParentAuthorized =
          announcement.classId &&
          childrenClasses.some(
            (student) => student.classId === announcement.classId,
          );

        const isGeneralAnnouncement =
          announcement.targetRoles.includes(Roles.PARENT) &&
          [Roles.ADMIN, Roles.SUPER_ADMIN, Roles.TEACHER].includes(
            announcement.creatorRole as Roles,
          );

        if (!isParentAuthorized && !isGeneralAnnouncement) {
          throw new ForbiddenException(
            'You do not have permission to view this announcement',
          );
        }

        return announcement;
      }

      throw new ForbiddenException(
        'You do not have permission to view this announcement',
      );
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      throw new InternalServerErrorException(
        'Failed to fetch the announcement',
      );
    }
  }

  async editAnnouncement(
    userId: string,
    role: Roles,
    announcementId: string,
    data: {
      title?: string;
      content?: string;
      targetRoles?: Roles[];
    },
  ) {
    try {
      return await this.prisma
        .$transaction(async (tx) => {
          // Fetch the existing announcement to check permissions
          const existingAnnouncement = await tx.announcement.findUnique({
            where: { id: announcementId },
            include: {
              class: true,
            },
          });

          if (!existingAnnouncement) {
            throw new NotFoundException('Announcement not found');
          }

          // Check edit permissions based on role
          if (![Roles.SUPER_ADMIN, Roles.ADMIN].includes(role)) {
            // Only creator can edit their own announcements
            if (existingAnnouncement.creatorId !== userId) {
              throw new ForbiddenException(
                'You do not have permission to edit this announcement',
              );
            }

            // Teachers can only edit their class announcements
            if (role === Roles.TEACHER) {
              const teacherClassIds = await tx.lesson.findMany({
                where: { teacherId: userId },
                select: { classId: true },
              });

              const canEditClass =
                existingAnnouncement.classId &&
                teacherClassIds.some(
                  (lesson) => lesson.classId === existingAnnouncement.classId,
                );

              if (!canEditClass) {
                throw new ForbiddenException(
                  'You can only edit announcements for your classes',
                );
              }
            }

            // Other roles cannot edit announcements
            if (
              ![Roles.TEACHER, Roles.ADMIN, Roles.SUPER_ADMIN].includes(role)
            ) {
              throw new ForbiddenException(
                'You do not have permission to edit announcements',
              );
            }
          }

          // Update the announcement
          const updatedAnnouncement = await tx.announcement.update({
            where: { id: announcementId },
            data: {
              title: data.title ?? undefined,
              content: data.content ?? undefined,
              targetRoles: data.targetRoles
                ? {
                    set: data.targetRoles,
                  }
                : undefined,
              updatedAt: new Date(), // Explicitly update the timestamp
            },
            include: {
              class: true,
            },
          });

          // Note: Moving the emit outside the transaction since it's not a database operation
          // and we want to emit only after the transaction succeeds
          return updatedAnnouncement;
        })
        .then((announcement) => {
          // Emit the updated announcement after transaction succeeds
          if (announcement.classId) {
            this.announcementGateway.emitToClass(
              announcement.classId,
              announcement,
            );
          } else if (announcement.targetRoles.length > 0) {
            this.announcementGateway.emitToRoles(
              announcement,
              announcement.targetRoles as Roles[],
            );
          }

          return announcement;
        });
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Failed to update announcement');
    }
  }

  async markAnnouncementAsRead(
    userId: string,
    role: Roles,
    announcementId: string,
  ): Promise<boolean> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        // First verify the user has access to this announcement
        const announcement = await this.getAnnouncementById(
          userId,
          role,
          announcementId,
        );

        if (!announcement) {
          throw new Error('Announcement not found');
        }

        // Create or update read status
        await tx.announcementRead.upsert({
          where: {
            announcementId_userId: {
              announcementId,
              userId,
            },
          },
          create: {
            announcementId,
            userId,
          },
          update: {
            readAt: new Date(), // Update if record already exists
          },
        });

        // After marking as read, get the new unread count

        const newUnreadCount = await this.getUnreadCount(userId, role);

        // Emit read status update
        this.announcementGateway.server.emit('announcementReadStatus', {
          announcementId,
          userId,
          isRead: true,
          unreadCount: newUnreadCount,
        });

        return true;
      });
    } catch (error) {
      return false;
    }
  }

  async getUnreadCount(userId: string, role: Roles): Promise<number> {
    try {
      // Get all read announcements by this user
      const readAnnouncements = await this.prisma.announcementRead.findMany({
        where: { userId },
        select: { announcementId: true },
      });

      const readIds = readAnnouncements.map((r) => r.announcementId);

      // Build base query similar to getAllAnnouncements
      const baseQuery: any = {
        id: { notIn: readIds },
      };

      // Add role-based filters
      if ([Roles.SUPER_ADMIN, Roles.ADMIN].includes(role)) {
        // Admins can see all announcements
      } else if (role === Roles.TEACHER) {
        const teacherClassIds = await this.prisma.lesson.findMany({
          where: { teacherId: userId },
          select: { classId: true },
        });

        baseQuery.OR = [
          {
            classId: {
              in: teacherClassIds.map((lesson) => lesson.classId),
            },
          },
          { creatorId: userId },
          {
            AND: [
              { targetRoles: { hasSome: [Roles.TEACHER] } },
              { creatorRole: { in: [Roles.ADMIN, Roles.SUPER_ADMIN] } },
            ],
          },
        ];
      } else if (role === Roles.STUDENT) {
        baseQuery.OR = [
          { classId: userId },
          {
            AND: [
              { targetRoles: { hasSome: [Roles.STUDENT] } },
              {
                creatorRole: {
                  in: [Roles.ADMIN, Roles.SUPER_ADMIN, Roles.TEACHER],
                },
              },
            ],
          },
        ];
      } else if (role === Roles.PARENT) {
        const childrenClasses = await this.prisma.student.findMany({
          where: { parentId: userId },
          select: { classId: true },
        });

        baseQuery.OR = [
          {
            classId: {
              in: childrenClasses.map((student) => student.classId),
            },
          },
          {
            AND: [
              { targetRoles: { hasSome: [Roles.PARENT] } },
              {
                creatorRole: {
                  in: [Roles.ADMIN, Roles.SUPER_ADMIN, Roles.TEACHER],
                },
              },
            ],
          },
        ];
      }

      // Count unread announcements with proper filters
      return await this.prisma.announcement.count({
        where: baseQuery,
      });
    } catch (error) {
      return 0; // Return 0 on error
    }
  }

  // Personal Delete: Remove from personal view
  async personalAnnouncementDelete(
    userId: string,
    announcementId: string,
  ): Promise<boolean> {
    try {
      await this.prisma.announcementRead.create({
        data: {
          userId,
          announcementId,
          deletedAt: new Date(),
        },
      });
      return true;
    } catch (error) {
      throw new InternalServerErrorException(
        'Failed to perform personal delete',
      );
    }
  }

  // Main Delete: Delete globally for everyone
  async globalAnnouncementDelete(
    userId: string,
    role: Roles,
    announcementId: string,
  ): Promise<boolean> {
    try {
      // Fetch the announcement
      const announcement = await this.prisma.announcement.findUnique({
        where: { id: announcementId },
      });

      if (!announcement) {
        throw new NotFoundException('Announcement not found');
      }

      // Ensure the user has permission to delete globally
      const isCreator = announcement.creatorId === userId;
      const isAdmin = [Roles.ADMIN, Roles.SUPER_ADMIN].includes(role);

      if (!isCreator && !isAdmin) {
        throw new ForbiddenException(
          'You do not have permission to delete this announcement globally',
        );
      }

      // Delete the announcement
      await this.prisma.announcement.delete({ where: { id: announcementId } });

      this.announcementGateway.emitAnnouncementDeleted(announcementId);

      return true;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      )
        throw error;
      throw new InternalServerErrorException('Failed to delete announcement');
    }
  }

  async archiveAnnouncement(
    userId: string,
    role: Roles,
    announcementId: string,
  ): Promise<boolean> {
    try {
      // First verify the announcement exists and user has access
      const announcement = await this.getAnnouncementById(
        userId,
        role,
        announcementId,
      );

      if (!announcement) {
        throw new NotFoundException('Announcement not found');
      }

      // Create an archive record for this user
      await this.prisma.announcementArchive.upsert({
        where: {
          announcementId_userId: {
            announcementId,
            userId,
          },
        },
        create: {
          announcementId,
          userId,
          archivedAt: new Date(),
        },
        update: {
          archivedAt: new Date(),
        },
      });

      // Emit archive status update
      this.announcementGateway.emitArchiveStatus(announcementId, true);

      return true;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Failed to archive announcement');
    }
  }

  async unarchiveAnnouncement(
    userId: string,
    role: Roles,
    announcementId: string,
  ): Promise<boolean> {
    try {
      // First verify the announcement exists and user has access
      const announcement = await this.getAnnouncementById(
        userId,
        role,
        announcementId,
      );

      if (!announcement) {
        throw new NotFoundException('Announcement not found');
      }

      // Delete the archive record for this user
      await this.prisma.announcementArchive.deleteMany({
        where: {
          announcementId,
          userId,
        },
      });

      // Emit archive status update
      this.announcementGateway.emitArchiveStatus(announcementId, false);

      return true;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        'Failed to unarchive announcement',
      );
    }
  }
}
