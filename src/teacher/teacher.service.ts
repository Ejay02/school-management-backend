import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { PrismaService } from 'src/prisma/prisma.service';

// import { PublicTeacherResponse } from './types/public.teacher.types';

@Injectable()
export class TeacherService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

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
