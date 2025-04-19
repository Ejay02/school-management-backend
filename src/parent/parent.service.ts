import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/prisma/prisma.service';
import { Roles } from 'src/shared/enum/role';
import { UpdateProfileInput } from 'src/shared/inputs/profile-update.input';
import { PaginationParams } from 'src/shared/pagination/types/pagination.types';
import { PrismaQueryBuilder } from 'src/shared/pagination/utils/prisma.pagination';
import * as bcrypt from 'bcrypt';

@Injectable()
export class ParentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
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

  async updateParentProfile(id: string, input: UpdateProfileInput) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Check for username uniqueness if username is being updated
        if (input.username) {
          const usernameExists = await tx.parent.findUnique({
            where: { username: input.username },
          });

          if (usernameExists && usernameExists.id !== id) {
            throw new ConflictException(`Username already taken`);
          }
        }

        // Check for email uniqueness if email is being updated
        if (input.email) {
          const emailExists = await tx.parent.findFirst({
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

        return tx.parent.update({
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
}
