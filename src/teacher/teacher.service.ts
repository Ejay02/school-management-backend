import {
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
import { CloudinaryService } from 'src/shared/cloudinary/services/cloudinary.service';

@Injectable()
export class TeacherService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  async getAllTeachers(
    userId: string,
    userRole: Roles,
    params: PaginationParams,
  ) {
    try {
      // Base fields to include in the response
      const baseInclude = {
        subjects: true,
        classes: true,
        // grade: true,
      };

      const baseQuery: any = {
        include: baseInclude,
        orderBy: { createdAt: 'desc' },
      };

      // Handle pagination and search
      const searchFields = ['name', 'email', 'username'];

      // Role-based access control logic
      switch (userRole) {
        case Roles.SUPER_ADMIN:
        case Roles.ADMIN:
          // Admins and Super Admins can see all teachers
          break;

        // case Roles.TEACHER:
        //   // Teachers can see only themselves
        //   baseQuery.where = {
        //     id: userId,
        //   };
        //   break;

        case Roles.TEACHER:
          // Fetch the classes and grades the teacher is associated with
          const teacher = await this.prisma.teacher.findUnique({
            where: { id: userId },
            include: {
              classes: { select: { id: true } }, // Get the classes this teacher is part of
            },
          });

          if (!teacher) {
            throw new NotFoundException('Teacher not found');
          }

          baseQuery.where = {
            classes: {
              some: {
                id: { in: teacher.classes.map((c) => c.id) },
              },
            },
          };
          break;

        case Roles.PARENT:
          // Parents see teachers of their children's classes/grades
          const children = await this.prisma.student.findMany({
            where: { parentId: userId },
            select: {
              classId: true,
              gradeId: true,
            },
          });

          if (!children.length) {
            throw new NotFoundException('No children found for this parent');
          }

          baseQuery.where = {
            OR: [
              {
                classId: {
                  in: children.map((child) => child.classId),
                },
              },
              {
                gradeId: {
                  in: children.map((child) => child.gradeId),
                },
              },
            ],
          };
          break;

        case Roles.STUDENT:
          // Students can see teachers in their class/grade
          const student = await this.prisma.student.findUnique({
            where: { id: userId },
            select: {
              classId: true,
              gradeId: true,
            },
          });

          if (!student) {
            throw new NotFoundException('Student not found');
          }

          baseQuery.where = {
            OR: [{ classId: student.classId }, { gradeId: student.gradeId }],
          };
          break;

        default:
          throw new ForbiddenException(
            'You do not have permission to view teachers',
          );
      }

      return await PrismaQueryBuilder.paginateResponse(
        this.prisma.teacher,
        baseQuery,
        params,
        searchFields,
      );
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      if (error instanceof ForbiddenException) throw error;
      throw new InternalServerErrorException('Failed to fetch teachers');
    }
  }

  async getTeacherById(userId: string, teacherId: string) {
    try {
      // First, get the requesting user's role and id
      const requestingUser = await this.prisma.admin.findUnique({
        where: { id: userId },
      });

      const requestingTeacher = await this.prisma.teacher.findUnique({
        where: { id: userId },
      });

      // Check if the requesting user is either an admin or the teacher themselves
      if (
        !requestingUser &&
        (!requestingTeacher || requestingTeacher.id !== teacherId)
      ) {
        throw new ForbiddenException(
          "You do not have permission to view this teacher's details",
        );
      }

      const teacher = await this.prisma.teacher.findUnique({
        where: { id: teacherId },
        include: {
          exams: true,
          subjects: true,
          lessons: true,
          classes: true,
          assignments: true,
        },
      });

      if (!teacher) {
        throw new NotFoundException(`Teacher with ID ${teacherId} not found`);
      }

      return teacher;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new Error(`Failed to get teacher: ${error.message}`);
    }
  }

  async updateTeacherProfile(
    id: string,
    input: UpdateProfileInput,
    file?: Express.Multer.File,
  ) {
    try {
      // Upload image if provided
      let imageUrl = input.image;
      if (file) {
        // Get the current teacher to check if they have an existing image
        const teacher = await this.prisma.teacher.findUnique({
          where: { id },
          select: { image: true },
        });

        // Delete old image if exists
        if (teacher?.image) {
          try {
            const publicId = this.cloudinaryService.getPublicIdFromUrl(
              teacher.image,
            );
            await this.cloudinaryService.deleteImage(publicId);
          } catch (error) {
            console.error('Failed to delete old image:', error);
            // Continue with upload even if delete fails
          }
        }

        // Upload new image
        imageUrl = await this.cloudinaryService.uploadImage(
          file,
          'teacher-profiles',
        );
      }

      // Hash password if provided
      let passwordData = {};
      if (input.password) {
        const hashedPassword = await bcrypt.hash(input.password, 10);
        passwordData = { password: hashedPassword };
      }

      // Update teacher profile
      return this.prisma.teacher.update({
        where: { id },
        data: {
          ...input,
          ...passwordData,
          image: imageUrl,
        },
      });
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to update teacher profile: ${error.message}`,
      );
    }
  }
}
