import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/prisma/prisma.service';
import { DefaultClass } from './enum/class';

import { CreateClassInput } from './input/create.class.input';
import { PrismaQueryBuilder } from 'src/shared/pagination/utils/prisma.pagination';
import {
  PaginatedResponse,
  PaginationParams,
} from 'src/shared/pagination/types/pagination.types';
import { Class } from './types/class.types';

@Injectable()
export class ClassService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  private async getDefaultClasses(): Promise<DefaultClass[]> {
    return Object.values(DefaultClass);
  }

  public async setDefaultClasses(tx: any): Promise<void> {
    const defaultClasses = await this.getDefaultClasses();

    for (const className of defaultClasses) {
      // Create the class
      await tx.class.create({
        data: {
          name: className, // Class name from DefaultClass enum
          capacity: 30, // Set default capacity, adjust as needed
        },
      });
    }
  }

  async getAllClasses(
    params: PaginationParams,
  ): Promise<PaginatedResponse<Class>> {
    try {
      const baseQuery = {
        include: {
          announcements: true,
          subjects: {
            include: {
              teachers: true,
              lessons: {
                select: {
                  id: true,
                  name: true,
                  day: true,
                  startTime: true,
                  endTime: true,
                },
              },
            },
          },
        },
      };

      // Define searchable fields
      const searchFields = ['name'];

      return await PrismaQueryBuilder.paginateResponse(
        this.prisma.class,
        baseQuery,
        params,
        searchFields,
      );
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      throw new InternalServerErrorException('Failed to fetch classes');
    }
  }

  async createClass(data: CreateClassInput) {
    return await this.prisma.$transaction(async (tx) => {
      const existingClass = await tx.class.findUnique({
        where: { name: data.name },
      });

      if (existingClass) {
        throw new Error(`Class with this name: ${data.name} already exists`);
      }

      return await tx.class.create({
        data: {
          name: data.name,
          capacity: data.capacity,
          supervisorId: data.supervisorId,
        },
      });
    });
  }

  async getClassById(classId: string) {
    const classData = await this.prisma.class.findUnique({
      where: { id: classId },
      include: {
        subjects: {
          include: {
            lessons: true,
          },
        },

        lessons: true,
        students: true,
        supervisor: true,
        exams: true,
        events: true,
        assignments: true,
        announcements: true,
      },
    });
    if (!classData) {
      throw new NotFoundException(`Class with id ${classId} not found`);
    }

    return classData;
  }

  public async assignClassToTeacher(classId: string, teacherId: string) {
    return this.prisma.$transaction(async (tx) => {
      // Validate class existence
      const classExists = await tx.class.findUnique({
        where: { id: classId },
      });

      if (!classExists) {
        throw new Error(`Class with ID ${classId} not found.`);
      }

      // Validate teacher existence
      const teacherExists = await tx.teacher.findUnique({
        where: { id: teacherId },
      });

      if (!teacherExists) {
        throw new Error(`Teacher with ID ${teacherId} not found.`);
      }

      // Assign teacher as the supervisor of the class
      await tx.class.update({
        where: { id: classId },
        data: {
          supervisorId: teacherId,
        },
      });
    });
  }
}
