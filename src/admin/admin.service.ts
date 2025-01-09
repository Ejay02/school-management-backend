import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

import { PrismaService } from 'src/prisma/prisma.service';
import { Roles } from 'src/shared/enum/role';
import * as bcrypt from 'bcrypt';
import { EditAdminInput } from './input/edit.admin.input';
import { EditAdminResponse } from './response/edit.admin.response';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

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
          students: true, // Include students related to the grade
          submissions: true, // Include submissions related to the grade
          subjects: true, // If there is a relation to subjects
          exams: true,
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
      return this.prisma.$transaction(async (tx) => {
        await tx.admin.create({
          data: {
            id: targetId,
            username: target.username,
            email: target.email,
            password: target.password,
            role: Roles.ADMIN as Roles,
          },
        });
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

  async editAdmin(
    currentUserId: string,
    input: EditAdminInput,
  ): Promise<EditAdminResponse> {
    try {
      const { username, email, img, password } = input;

      const transaction = await this.prisma.$transaction(async (tx) => {
        if (username) {
          const usernameExists = await tx.admin.findUnique({
            where: { username },
          });

          if (usernameExists) {
            throw new ConflictException(`Username already taken`);
          }
        }

        const updatedAdmin = await tx.admin.update({
          where: { id: currentUserId },
          data: {
            ...(username && { username }),
            ...(email && { email }),
            ...(img && { img }),
            ...(password && { password: await bcrypt.hash(password, 10) }),
          },
        });

        return updatedAdmin;
      });
      return {
        success: true,
        message: 'Profile updated successfully',
        admin: {
          ...transaction,
          role: transaction.role as Roles,
        },
      };
    } catch (error) {
      throw error;
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

        // await tx.announcement.deleteMany({ where: { creatorId } });
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
        const creatorId = admin.id;

        // await tx.announcement.deleteMany({ where: { adminId } });
        await tx.event.deleteMany({ where: { creatorId } });
        await tx.admin.delete({ where: { id: targetId } });
        return true;
      }

      return false;
    });
  }
}
