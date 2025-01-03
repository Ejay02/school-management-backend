import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
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

  async assignAdminRole(adminId: string, targetId: string, newRole: Roles) {
    await this.verifyAdmin(adminId);

    // Find which model the target exists in
    const [teacher, student, parent] = await Promise.all([
      this.prisma.teacher.findUnique({ where: { id: targetId } }),
      this.prisma.student.findUnique({ where: { id: targetId } }),
      this.prisma.parent.findUnique({ where: { id: targetId } }),
    ]);

    if (newRole === Roles.ADMIN) {
      const target = teacher || student || parent;
      if (!target) {
        throw new NotFoundException('Target user not found');
      }

      // Create new admin record
      return this.prisma.admin.create({
        data: {
          id: targetId,
          username: target.username,
          email: target.email,
          password: target.password,
          role: Roles.ADMIN,
        },
      });
    }

    // For non-admin role changes, use existing logic
    const target = await this.findUserByIdAndRole(targetId, newRole);
    if (!target) {
      throw new NotFoundException('Target user not found');
    }

    return this.updateUserRole(targetId, newRole);
  }

  private async findUserByIdAndRole(id: string, role: Roles) {
    switch (role) {
      case Roles.TEACHER:
        return this.prisma.teacher.findUnique({ where: { id } });
      case Roles.STUDENT:
        return this.prisma.student.findUnique({ where: { id } });
      case Roles.PARENT:
        return this.prisma.parent.findUnique({ where: { id } });

      default:
        throw new BadRequestException('Invalid role');
    }
  }

  private async updateUserRole(id: string, role: Roles) {
    switch (role) {
      case Roles.TEACHER:
        return this.prisma.teacher.update({
          where: { id },
          data: { role },
        });
      case Roles.STUDENT:
        return this.prisma.student.update({
          where: { id },
          data: { role },
        });
      case Roles.PARENT:
        return this.prisma.parent.update({
          where: { id },
          data: { role },
        });

      default:
        throw new BadRequestException('Invalid role');
    }
  }

  async deleteUser(requesterId: string, targetId: string): Promise<boolean> {
    await this.verifyAdmin(requesterId);

    return await this.prisma.$transaction(async (tx) => {
      // Find user in all possible tables
      const [teacher, student, parent, admin] = await Promise.all([
        tx.teacher.findUnique({ where: { id: targetId } }),
        tx.student.findUnique({ where: { id: targetId } }),
        tx.parent.findUnique({ where: { id: targetId } }),
        tx.admin.findUnique({ where: { id: targetId } }),
      ]);

      if (!teacher && !student && !parent && !admin) {
        throw new NotFoundException('User not found');
      }

      if (admin?.role === Roles.SUPER_ADMIN) {
        throw new ForbiddenException('Cannot delete super admin');
      }

      if (teacher) {
        const teacherId = teacher.id;

        await tx.announcement.deleteMany({ where: { teacherId } });
        await tx.assignment.deleteMany({ where: { teacherId } });
        await tx.exam.deleteMany({ where: { teacherId } });
        await tx.lesson.deleteMany({ where: { teacherId } });
        await tx.teacher.delete({ where: { id: targetId } });
        return true;
      }

      if (student) {
        const studentId = student.id;

        // Delete all associated student data
        await tx.attendance.deleteMany({ where: { studentId } });
        await tx.result.deleteMany({ where: { studentId } });
        await tx.submission.deleteMany({ where: { studentId } });
        await tx.student.delete({ where: { id: targetId } });
        return true;
      }

      if (parent) {
        const parentId = parent.id;

        // Find all students associated with this parent
        const associatedStudents = await tx.student.findMany({
          where: { parentId: parentId },
        });

        // Delete all data for each associated student
        for (const student of associatedStudents) {
          await tx.attendance.deleteMany({ where: { studentId: student.id } });
          await tx.result.deleteMany({ where: { studentId: student.id } });
          await tx.submission.deleteMany({ where: { studentId: student.id } });
        }

        // Delete all associated students
        await tx.student.deleteMany({ where: { parentId: parentId } });

        // Finally delete the parent
        await tx.parent.delete({ where: { id: targetId } });
        return true;
      }

      if (admin) {
        const adminId = admin.id;

        await tx.announcement.deleteMany({ where: { adminId } });
        await tx.event.deleteMany({ where: { adminId } });
        await tx.admin.delete({ where: { id: targetId } });
        return true;
      }

      return false;
    });
  }
}
