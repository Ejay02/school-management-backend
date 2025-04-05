import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/prisma/prisma.service';
import { Roles } from 'src/shared/enum/role';
import { PaginationParams } from 'src/shared/pagination/types/pagination.types';
import { PrismaQueryBuilder } from 'src/shared/pagination/utils/prisma.pagination';

@Injectable()
export class ParentService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async getAllParents(
    userId: string,
    userRole: Roles,
    params?: PaginationParams,
  ) {
    try {
      const baseInclude = {
        students: {
          include: {
            class: true,
            grade: true,
          },
        },
      };

      const baseQuery: any = {
        include: baseInclude,
        orderBy: { createdAt: 'desc' },
      };

      const searchFields = ['name', 'email', 'phone'];

      switch (userRole) {
        case Roles.ADMIN:
        case Roles.SUPER_ADMIN:
          // Admins can see all parents
          // baseQuery already has the include
          break;

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

          baseQuery.where = {
            students: {
              some: {
                classId: {
                  in: classIds,
                },
              },
            },
          };
          break;

        case Roles.STUDENT:
          // Students can only see their own parents
          const student = await this.prisma.student.findUnique({
            where: { id: userId },
            select: {
              parentId: true,
            },
          });

          baseQuery.where = {
            id: student?.parentId,
          };
          break;

        case Roles.PARENT:
          // Parents can only see their own profile
          baseQuery.where = {
            id: userId,
          };
          break;

        default:
          throw new ForbiddenException('Unauthorized access');
      }

      return await PrismaQueryBuilder.paginateResponse(
        this.prisma.parent,
        baseQuery,
        params,
        searchFields,
      );
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
