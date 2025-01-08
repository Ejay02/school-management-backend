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
      const baseInclude = {
        students: {
          include: {
            class: true,
            grade: true,
          },
        },
      };

      switch (userRole) {
        case Roles.ADMIN:
        case Roles.SUPER_ADMIN:
          // Admins can see all parents
          return await this.prisma.parent.findMany({
            include: baseInclude,
          });

        case Roles.TEACHER:
          // Teachers can only see parents of students in their classes
          const teacherClasses = await this.prisma.class.findMany({
            where: {
              id: userId,
            },
            select: {
              id: true,
            },
          });

          const classIds = teacherClasses.map((c) => c.id);

          return await this.prisma.parent.findMany({
            where: {
              students: {
                some: {
                  classId: {
                    in: classIds,
                  },
                },
              },
            },
            include: baseInclude,
          });

        case Roles.STUDENT:
          // Students can only see their own parents
          const student = await this.prisma.student.findUnique({
            where: { id: userId },
            include: {
              parent: {
                include: baseInclude,
              },
            },
          });

          return student?.parent || [];

        case Roles.PARENT:
          // Parents can only see their own profile
          return await this.prisma.parent.findMany({
            where: {
              id: userId,
            },
            include: baseInclude,
          });

        default:
          throw new ForbiddenException('Unauthorized access');
      }
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
