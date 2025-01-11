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

// import { PublicTeacherResponse } from './types/public.teacher.types';

@Injectable()
export class TeacherService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
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
        class: true,
        grade: true,
      };

      const baseQuery: any = {
        include: baseInclude,
      };

      // Role-based access control logic
      switch (userRole) {
        case Roles.SUPER_ADMIN:
        case Roles.ADMIN:
          // Admins and Super Admins can see all teachers
          break;

        case Roles.TEACHER:
          // Teachers can see only themselves
          baseQuery.where = {
            id: userId,
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

      // Handle pagination and search
      const searchFields = ['name', 'email']; // Adjust these fields based on your teacher model
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
          // announcements: true,
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

  // async publicTeacherProfile(id: string): Promise<PublicTeacherResponse> {
  //   const teacher = await this.prisma.teacher.findUnique({
  //     where: { id },
  //     select: {
  //       id: true,
  //       name: true,
  //       surname: true,
  //       img: true,
  //       subjects: {
  //         select: {
  //           id: true,
  //           name: true,
  //           // teachers: true,
  //           // lessons: true,
  //           // createdAt: true,
  //           // updatedAt: true,
  //         },
  //       },
  //       classes: {
  //         select: {
  //           id: true,
  //           name: true,
  //         },
  //       },
  //     },
  //   });

  //   if (!teacher) {
  //     throw new NotFoundException(`Teacher with ID ${id} not found`);
  //   }

  //   return {
  //     id: teacher.id,
  //     name: teacher.name,
  //     surname: teacher.surname,
  //     img: teacher.img,
  //     subjects: teacher.subjects,
  //     classes: teacher.classes,
  //   };
  // }
}
