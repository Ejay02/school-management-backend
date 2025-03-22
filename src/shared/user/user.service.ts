import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async findUserById(id: string) {
    const admin = await this.prisma.admin.findUnique({ where: { id } });
    if (admin) return admin;

    const teacher = await this.prisma.teacher.findUnique({ where: { id } });
    if (teacher) return teacher;

    const student = await this.prisma.student.findUnique({ where: { id } });
    if (student) return student;

    const parent = await this.prisma.parent.findUnique({ where: { id } });
    if (parent) return parent;

    throw new NotFoundException('User not found');
  }
}
