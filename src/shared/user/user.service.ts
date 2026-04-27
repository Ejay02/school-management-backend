import { Injectable, NotFoundException } from '@nestjs/common';
import type { Admin } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureAdminId(admin: Admin): Promise<Admin> {
    if (admin.adminId) return admin;

    return this.prisma.$transaction(async (tx) => {
      const currentAdmin = await tx.admin.findUnique({
        where: { id: admin.id },
      });

      if (!currentAdmin) {
        throw new NotFoundException('User not found');
      }

      if (currentAdmin.adminId) return currentAdmin;

      const updatedSetup = await tx.setupState.update({
        where: { id: 'default' },
        data: { nextAdminSequence: { increment: 1 } },
        select: { nextAdminSequence: true },
      });

      const sequence = Number(updatedSetup.nextAdminSequence) - 1;
      const year = new Date().getFullYear();
      const adminId = `ADM-${year}-${String(sequence).padStart(4, '0')}`;

      return tx.admin.update({
        where: { id: admin.id },
        data: { adminId },
      });
    });
  }

  async findUserById(id: string) {
    const admin = await this.prisma.admin.findUnique({ where: { id } });
    if (admin) return this.ensureAdminId(admin);

    const teacher = await this.prisma.teacher.findUnique({ where: { id } });
    if (teacher) return teacher;

    const student = await this.prisma.student.findUnique({ where: { id } });
    if (student) return student;

    const parent = await this.prisma.parent.findUnique({ where: { id } });
    if (parent) return parent;

    throw new NotFoundException('User not found');
  }
}
