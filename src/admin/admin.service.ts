import { ForbiddenException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { PrismaService } from 'src/prisma/prisma.service';
import { Roles } from 'src/shared/enum/role';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  private async verifyAdmin(userId: string) {
    const admin = await this.prisma.admin.findUnique({
      where: { id: userId },
    });

    if (!admin) {
      throw new ForbiddenException('Only admins can access this resource');
    }
    return admin;
  }

  async getAllStudents(userId: string) {
    await this.verifyAdmin(userId);
    return this.prisma.student.findMany({
      include: {
        parent: true,
        class: {
          include: {
            grade: true,
          },
        },
      },
    });
  }

  async getAllTeachers(userId: string) {
    await this.verifyAdmin(userId);
    return this.prisma.teacher.findMany({
      include: {
        lessons: {
          include: {
            subject: true,
            class: {
              include: {
                grade: true,
              },
            },
          },
        },
      },
    });
  }

  async getAllAdmins(userId: string) {
    const admin = await this.verifyAdmin(userId);
    const where =
      admin.role !== Roles.SUPER_ADMIN ? { role: Roles.ADMIN } : undefined;

    return this.prisma.admin.findMany({ where });
  }

  async getAllParents(userId: string) {
    await this.verifyAdmin(userId);
    return this.prisma.parent.findMany({
      include: {
        students: {
          include: {
            class: true,
            grade: true,
          },
        },
      },
    });
  }

  async getAllAttendance(userId: string) {
    await this.verifyAdmin(userId);
    return this.prisma.attendance.findMany({
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
  }

  async getAllAssignments(userId: string) {
    await this.verifyAdmin(userId);
    return this.prisma.assignment.findMany({
      include: {
        teacher: true,
        subject: true,
        class: true,
      },
    });
  }

  async getAllAnnouncements(userId: string) {
    await this.verifyAdmin(userId);
    return this.prisma.announcement.findMany({
      include: {
        admin: true,
        teacher: true,
      },
    });
  }

  async getAllClasses(userId: string) {
    await this.verifyAdmin(userId);
    return this.prisma.class.findMany({
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
  }

  async getAllEvents(userId: string) {
    await this.verifyAdmin(userId);
    return this.prisma.event.findMany({
      include: {
        admin: true,
      },
    });
  }

  async getAllExams(userId: string) {
    await this.verifyAdmin(userId);
    return this.prisma.exam.findMany({
      include: {
        subject: true,
        class: true,
        teacher: true,
        results: {
          include: {
            student: true,
          },
        },
      },
    });
  }

  async getAllGrades(userId: string) {
    await this.verifyAdmin(userId);
    return this.prisma.grade.findMany({
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
  }

  async assignAdminRole(userId: string): Promise<boolean> {
    try {
      await this.prisma.admin.update({
        where: { id: userId },
        data: { role: 'ADMIN' },
        // data: { isAdmin: true },
      });
      return true;
    } catch (error) {
      return false;
    }
  }
}
