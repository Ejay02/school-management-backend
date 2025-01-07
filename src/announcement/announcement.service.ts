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

  async getAllAnnouncements() {
    try {
      return await this.prisma.announcement.findMany({
        include: {
          // admin: true,
          // teacher: true,
          class: true,
        },
      });
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      throw new InternalServerErrorException('Failed to fetch announcements');
    }
  }

  async createAnnouncement(data: {
    title: string;
    content: string;
    creatorId: string;
    creatorRole: Roles;
    classId?: string;
    targetRoles?: Roles[];
  }) {
    const announcement = await this.prisma.announcement.create({
      data: {
        title: data.title,
        content: data.content,
        classId: data.classId,
        creatorId: data.creatorId,
        creatorRole: data.creatorRole,
      },
      include: {
        class: true,
      },
    });

    // If it's a class-specific announcement (from a teacher)
    if (announcement.classId) {
      this.announcementGateway.emitToClass(announcement.classId, announcement);
    }
    // If it's a role-targeted announcement (from admin)
    else if (data.targetRoles && data.targetRoles.length > 0) {
      this.announcementGateway.emitToRoles(announcement, data.targetRoles);
    }

    return announcement; // if no role or class is specified broadcast to all
  }
}
