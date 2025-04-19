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

import { MonthlyRevenue } from './types/income.graph.type';
import { Prisma } from '@prisma/client';
import { Term } from 'src/payment/enum/term';
import { FeeType } from 'src/payment/enum/fee.type';
import { PaymentStatus } from 'src/payment/enum/payment.status';
import { UpdateProfileInput } from 'src/shared/inputs/profile-update.input';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

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

  async getAllAdmins(userId: string) {
    try {
      const admin = await this.verifyAdmin(userId);
      const where =
        admin.role !== Roles.SUPER_ADMIN ? { role: Roles.ADMIN } : undefined;

      return await this.prisma.admin.findMany({ where });
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      throw new UnauthorizedException('User is not authorized as admin');
    }
  }

  async assignAdminRole(adminId: string, targetId: string, newRole: Roles) {
    await this.verifyAdmin(adminId);

    // Prevent assigning SUPER_ADMIN role
    if (newRole === Roles.SUPER_ADMIN) {
      throw new ForbiddenException('Cannot assign SUPER_ADMIN role');
    }

    // Find which model the target exists in
    const [teacher, student, parent, admin] = await Promise.all([
      this.prisma.teacher.findUnique({ where: { id: targetId } }),
      this.prisma.student.findUnique({ where: { id: targetId } }),
      this.prisma.parent.findUnique({ where: { id: targetId } }),
      this.prisma.admin.findUnique({ where: { id: targetId } }),
    ]);

    // Prevent modifying the SUPER_ADMIN
    if (admin?.role === Roles.SUPER_ADMIN) {
      throw new ForbiddenException('Cannot modify SUPER_ADMIN');
    }

    // Handle assigning to ADMIN role
    if (newRole === Roles.ADMIN) {
      const target = teacher || student || parent;
      if (!target) {
        throw new NotFoundException('Target user not found');
      }

      // Create new admin record
      return this.prisma.$transaction(async (tx) => {
        // Delete from original table
        if (teacher) await tx.teacher.delete({ where: { id: targetId } });
        if (student) await tx.student.delete({ where: { id: targetId } });
        if (parent) await tx.parent.delete({ where: { id: targetId } });

        // Create admin record
        return tx.admin.create({
          data: {
            id: targetId,
            username: target.username,
            email: target.email,
            password: target.password,
            role: Roles.ADMIN,
          },
        });
      });
    }

    // Handle converting from ADMIN to other roles
    if (admin) {
      return this.prisma.$transaction(async (tx) => {
        // Delete admin record
        await tx.admin.delete({ where: { id: targetId } });

        // Create in new role table
        switch (newRole) {
          case Roles.TEACHER:
            return tx.teacher.create({
              data: {
                id: targetId,
                username: admin.username,
                email: admin.email,
                password: admin.password,
                role: Roles.TEACHER,
                name: '',
                surname: '',
              },
            });
          case Roles.PARENT:
            return tx.parent.create({
              data: {
                id: targetId,
                username: admin.username,
                email: admin.email,
                password: admin.password,
                role: Roles.PARENT,
                name: '',
                surname: '',
              },
            });
          default:
            throw new BadRequestException('Invalid role');
        }
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

  async updateAdminProfile(id: string, input: UpdateProfileInput) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Check for username uniqueness if username is being updated
        if (input.username) {
          const usernameExists = await tx.admin.findUnique({
            where: { username: input.username },
          });

          if (usernameExists && usernameExists.id !== id) {
            throw new ConflictException(`Username already taken`);
          }
        }

        // Check for email uniqueness if email is being updated
        if (input.email) {
          const emailExists = await tx.admin.findFirst({
            where: { email: input.email },
          });

          if (emailExists && emailExists.id !== id) {
            throw new ConflictException(`Email already taken`);
          }
        }

        // If password is provided, hash it
        if (input.password) {
          const salt = await bcrypt.genSalt();
          input.password = await bcrypt.hash(input.password, salt);
        }

        return tx.admin.update({
          where: { id },
          data: input,
        });
      });
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Failed to update profile: ${error.message}`,
      );
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

  async getDashboardUserCardSummary(role: Roles) {
    if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Unauthorized access');
    }

    // Fetch the counts
    const [studentsCount, parentsCount, teachersCount, adminsCount] =
      await Promise.all([
        this.prisma.student.count(),
        this.prisma.parent.count(),
        this.prisma.teacher.count(),
        this.prisma.admin.count(),
      ]);

    // Determine the current academic year and next year
    const currentYear = new Date().getFullYear();

    const academicYear = {
      current: `${currentYear}`,
      next: `${currentYear + 1}`,
    };

    return {
      role: role,
      counts: {
        students: studentsCount,
        parents: parentsCount,
        teachers: teachersCount,
        admins: adminsCount,
      },
      academicYear,
    };
  }

  async getIncomeGraphData(): Promise<MonthlyRevenue> {
    const currentYear = new Date().getFullYear().toString();

    const where: Prisma.FeeStructureWhereInput = {
      academicYear: currentYear,
    };

    const feeStructures = await this.prisma.feeStructure.findMany({
      where,
      include: {
        invoices: {
          include: {
            payments: true,
          },
        },
      },
    });

    const monthlyRevenue = Array(12).fill(0);

    for (const feeStructure of feeStructures) {
      const payments = feeStructure.invoices.flatMap((invoice) =>
        invoice.payments.filter(
          (payment) => payment.status === PaymentStatus.COMPLETED,
        ),
      );

      for (const payment of payments) {
        if (feeStructure.type === FeeType.YEARLY) {
          const monthlyValue = payment.amount / 12;
          monthlyRevenue.forEach((_, index) => {
            monthlyRevenue[index] += monthlyValue;
          });
        } else if (feeStructure.type === FeeType.TERM && feeStructure.term) {
          const termMonths = this.getTermMonths(feeStructure.term as Term);
          if (termMonths.length > 0) {
            const monthlyValue = payment.amount / termMonths.length;
            termMonths.forEach((month) => {
              monthlyRevenue[month - 1] += monthlyValue;
            });
          }
        }
      }
    }

    return { revenue: monthlyRevenue };
  }

  private getTermMonths(term: Term): number[] {
    switch (term) {
      case Term.FIRST:
        return [1, 2, 3];
      case Term.SECOND:
        return [4, 5, 6];
      case Term.THIRD:
        return [9, 10, 11, 12];
      default:
        return [];
    }
  }

  async getAllAdminUsers(userId: string) {
    try {
      await this.verifyAdmin(userId);

      const [admins, teachers, parents] = await Promise.all([
        this.prisma.admin.findMany(),
        this.prisma.teacher.findMany(),
        this.prisma.parent.findMany(),
      ]);

      return {
        admins,
        teachers,
        parents,
      };
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      throw new UnauthorizedException('User is not authorized as admin');
    }
  }
}
