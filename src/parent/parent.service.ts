import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/prisma/prisma.service';
import { Roles } from 'src/shared/enum/role';

@Injectable()
export class ParentService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async getAllParents(userId: string, userRole: Roles) {
    try {
      // Check the role of the user
      if (userRole === 'ADMIN' || userRole === 'SUPER_ADMIN') {
        // Admin/Super Admin can view all parents
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
      }

      if (userRole === 'TEACHER') {
        // Teacher can view parents of students they are associated with
        return await this.prisma.parent.findMany({
          where: {
            students: {
              some: {
                classId: userId, // Assuming the teacher is assigned to a class
              },
            },
          },
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

      if (userRole === 'STUDENT') {
        // Student can only view their own parent's details
        return await this.prisma.parent.findMany({
          where: {
            students: {
              some: {
                id: userId, // Assuming the student has a `studentId`
              },
            },
          },
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

      // If the role doesn't match any of the above, deny access
      throw new ForbiddenException('Access denied');
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      throw new InternalServerErrorException('Failed to fetch parents');
    }
  }

  async getParentById(parentId: string) {
    try {
      const parent = await this.prisma.parent.findUnique({
        where: { id: parentId },
        include: {
          students: true,
        },
      });

      if (!parent) {
        throw new NotFoundException(`Parent with ID: ${parentId} not found`);
      }
      return parent;
    } catch (error) {
      throw new Error(`Failed to get parent: ${error.message}`);
    }
  }
}
