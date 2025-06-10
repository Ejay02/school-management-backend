import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../prisma/prisma.service';
import { Roles } from '../shared/enum/role';
import { UpdateProfileInput } from '../shared/inputs/profile-update.input';
import { PaginationParams } from '../shared/pagination/types/pagination.types';
import { PrismaQueryBuilder } from '../shared/pagination/utils/prisma.pagination';
import { CloudinaryService } from '../shared/cloudinary/services/cloudinary.service';

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
