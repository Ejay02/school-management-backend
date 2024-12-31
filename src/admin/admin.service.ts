import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { PrismaService } from 'src/prisma/prisma.service';

import { AuthResponse } from 'src/shared/auth/response/auth.response';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

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

  async getAdminProfile(adminId: string): Promise<AuthResponse> {
    const admin = await this.prisma.admin.findUnique({
      where: { id: adminId },
      select: {
        id: true,
        username: true,
        email: true,
        createdAt: true,
      },
    });

    return {
      userId: admin.id,
      token: '',
      username: admin.username,
      email: admin.email,
    };
  }
}
