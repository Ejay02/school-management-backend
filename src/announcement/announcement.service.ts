import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

import { AnnouncementGateway } from './gateway/announcement.gateway';
import { Roles } from 'src/shared/enum/role';

@Injectable()
export class AnnouncementService {
  constructor(
    private prisma: PrismaService,
    private announcementGateway: AnnouncementGateway,
  ) {}

  async createAnnouncement(data: {
    title: string;
    content: string;
    creatorId: string;
    creatorRole: Roles;
    classId?: string;
    targetRoles?: Roles[];
  }) {
    // Use a Prisma transaction to ensure atomicity
    const announcement = await this.prisma.$transaction(async (tx) => {
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
      }

      return announcement;
    });

    return announcement; // The transaction will be committed, and the announcement is returned
  }

  async getAllAnnouncements(userId: string, role: Roles) {
    try {
      // If the user is a super admin or admin, fetch all announcements
      if ([Roles.SUPER_ADMIN, Roles.ADMIN].includes(role)) {
        return await this.prisma.announcement.findMany({
          include: {
            class: true,
          },
        });
      }

      // If the user is a teacher
      if (role === Roles.TEACHER) {
        // Get all classes where the teacher has lessons
        const teacherClassIds = await this.prisma.lesson.findMany({
          where: { teacherId: userId },
          select: { classId: true },
        });

        return await this.prisma.announcement.findMany({
          where: {
            OR: [
              {
                classId: {
                  in: teacherClassIds.map((lesson) => lesson.classId),
                },
              },
              { creatorId: userId }, // Announcements created by the teacher
              {
                AND: [
                  { targetRoles: { hasSome: [Roles.TEACHER] } },
                  { creatorRole: { in: [Roles.ADMIN, Roles.SUPER_ADMIN] } },
                ],
              }, // Announcements targeted at teachers by admins
            ],
          },
          include: {
            class: true,
          },
        });
      }

      // If the user is a student
      if (role === Roles.STUDENT) {
        return await this.prisma.announcement.findMany({
          where: {
            OR: [
              { classId: userId }, // Announcements for student's class
              {
                AND: [
                  { targetRoles: { hasSome: [Roles.STUDENT] } },
                  {
                    creatorRole: {
                      in: [Roles.ADMIN, Roles.SUPER_ADMIN, Roles.TEACHER],
                    },
                  },
                ],
              }, // Announcements targeted at all students
            ],
          },
          include: {
            class: true,
          },
        });
      }

      // If the user is a parent
      if (role === Roles.PARENT) {
        // Get all classes where the parent has children
        const childrenClasses = await this.prisma.student.findMany({
          where: { parentId: userId },
          select: { classId: true },
        });

        return await this.prisma.announcement.findMany({
          where: {
            OR: [
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
              }, // Announcements targeted at all parents
            ],
          },
          include: {
            class: true,
          },
        });
      }

      throw new ForbiddenException(
        'You do not have permission to view announcements',
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
}
