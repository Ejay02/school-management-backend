import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/prisma/prisma.service';
import { Roles } from 'src/shared/enum/role';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async verifyAdmin(userId: string) {
    try {
      const admin = await this.prisma.admin.findUnique({
        where: {
          id: userId,
        },
      });

      if (!admin || admin.role !== 'SUPER_ADMIN') {
        throw new UnauthorizedException('User is not authorized as admin');
      }

      return admin;
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to verify admin status: ${error.message}`,
      );
    }
  }

  async getAllStudents(userId: string) {
    try {
      await this.verifyAdmin(userId);
      return await this.prisma.student.findMany({
        include: {
          parent: true,
          class: {
            include: {
              grade: true,
            },
          },
        },
      });
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      throw new InternalServerErrorException('Failed to fetch students');
    }
  }

  async getAllTeachers(userId: string) {
    try {
      await this.verifyAdmin(userId);

      return this.prisma.teacher.findMany();
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to get teachers: ${error.message}`,
      );
    }
  }

  async getAllAdmins(userId: string) {
    try {
      const admin = await this.verifyAdmin(userId);
      const where =
        admin.role !== Roles.SUPER_ADMIN ? { role: Roles.ADMIN } : undefined;

      return await this.prisma.admin.findMany({ where });
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      throw new InternalServerErrorException('Failed to fetch admins');
    }
  }

  async getAllParents(userId: string) {
    try {
      await this.verifyAdmin(userId);
      return await this.prisma.parent.findMany({
        include: {
          students: {
            include: {
              class: true,
              grade: true,
            },
          },
        },
      });
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      throw new InternalServerErrorException('Failed to fetch parents');
    }
  }

  async getAllAttendance(userId: string) {
    try {
      await this.verifyAdmin(userId);
      return await this.prisma.attendance.findMany({
        include: {
          student: true,
          lesson: {
            include: {
              subject: true,
              teacher: true,
              class: true,
            },
          },
        },
      });
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      throw new InternalServerErrorException(
        'Failed to fetch attendance records',
      );
    }
  }

  async getAllAssignments(userId: string) {
    try {
      await this.verifyAdmin(userId);
      return await this.prisma.assignment.findMany({
        include: {
          teacher: true,
          subject: true,
          class: true,
        },
      });
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      throw new InternalServerErrorException('Failed to fetch assignments');
    }
  }

  async getAllAnnouncements(userId: string) {
    try {
      await this.verifyAdmin(userId);
      return await this.prisma.announcement.findMany({
        include: {
          admin: true,
          teacher: true,
          class: true,
        },
      });
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      throw new InternalServerErrorException('Failed to fetch announcements');
    }
  }

  async getAllClasses(userId: string) {
    try {
      await this.verifyAdmin(userId);
      return await this.prisma.class.findMany({
        include: {
          grade: true,
          students: true,
          lessons: {
            include: {
              teacher: true,
              subject: true,
            },
          },
        },
      });
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      throw new InternalServerErrorException('Failed to fetch classes');
    }
  }

  async getAllEvents(userId: string) {
    try {
      await this.verifyAdmin(userId);
      return await this.prisma.event.findMany({
        include: {
          admin: true,
          class: true,
        },
      });
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      throw new InternalServerErrorException('Failed to fetch events');
    }
  }

  async getAllExams(userId: string) {
    try {
      await this.verifyAdmin(userId);
      return await this.prisma.exam.findMany({
        include: {
          subject: true,
          class: true,
          teacher: true,
          lesson: true,
          results: {
            include: {
              student: true,
            },
          },
        },
      });
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      throw new InternalServerErrorException('Failed to fetch exams');
    }
  }

  async getAllGrades(userId: string) {
    try {
      await this.verifyAdmin(userId);
      return await this.prisma.grade.findMany({
        include: {
          classes: {
            include: {
              students: true,
              lessons: {
                include: {
                  teacher: true,
                  subject: true,
                },
              },
            },
          },
        },
      });
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      throw new InternalServerErrorException('Failed to fetch grades');
    }
  }

  async assignAdminRole(userId: string): Promise<boolean> {
    try {
      await this.prisma.admin.update({
        where: { id: userId },
        data: { role: 'ADMIN' },
      });
      return true;
    } catch (error) {
      throw new InternalServerErrorException('Failed to assign admin role');
    }
  }
}
