import {
  ConflictException,
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
import { DeleteResponse } from 'src/shared/auth/response/delete.response';

@Injectable()
export class ClassService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  private async getDefaultClasses(): Promise<DefaultClass[]> {
    return Object.values(DefaultClass);
  }

  public async setDefaultClasses(tx: any): Promise<void> {
    const defaultClasses = await this.getDefaultClasses();

    for (const className of defaultClasses) {
      await tx.class.upsert({
        where: { name: className },
        update: {}, // No update needed if it exists
        create: {
          name: className,
          capacity: 30, // default capacity, adjust as needed
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
          students: true,
          feeStructure: true,
          supervisor: true,
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
        orderBy: { createdAt: 'desc' },
      };

      // Define searchable fields
      const searchFields = ['name'];

      // const totalCount = await this.prisma.class.count();

      // If no limit is specified, set it to a higher value to fetch all classes
      const enhancedParams = {
        ...params,
        limit: params.limit || 100, // Use 100 as default limit instead of 10
      };

      const result = await PrismaQueryBuilder.paginateResponse<Class>(
        this.prisma.class,
        baseQuery,
        enhancedParams,
        searchFields,
      );

      return result;
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

  async getClassId(className: string): Promise<string> {
    const classRecord = await this.prisma.class.findUnique({
      where: { name: className },
    });
    if (!classRecord) {
      throw new NotFoundException(`Class with name "${className}" not found.`);
    }
    return classRecord.id;
  }

  async updateClass(classId: string, data: Partial<CreateClassInput>) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existingClass = await tx.class.findUnique({
          where: { id: classId },
        });

        if (!existingClass) {
          throw new NotFoundException(`Class with ID ${classId} not found`);
        }

        // Check if name is being updated and if it already exists
        if (data.name && data.name !== existingClass.name) {
          const nameExists = await tx.class.findFirst({
            where: { name: data.name },
          });
          if (nameExists) {
            throw new ConflictException(
              `Class with name ${data.name} already exists`,
            );
          }
        }

        return await tx.class.update({
          where: { id: classId },
          data: {
            name: data.name,
            capacity: data.capacity,
            supervisorId: data.supervisorId,
          },
        });
      });
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to update class: ${error.message}`,
      );
    }
  }

  async deleteClass(classId: string): Promise<DeleteResponse> {
    try {
      await this.prisma.$transaction(async (tx) => {
        // First check if class exists
        const existingClass = await tx.class.findUnique({
          where: { id: classId },
        });

        if (!existingClass) {
          throw new NotFoundException(`Class with ID ${classId} not found`);
        }

        // Delete related records first
        await tx.announcement.deleteMany({ where: { classId } });
        await tx.assignment.deleteMany({ where: { classId } });
        await tx.exam.deleteMany({ where: { classId } });
        await tx.lesson.deleteMany({ where: { classId } });
        await tx.subject.deleteMany({ where: { classId } });

        // Find all students in this class
        const students = await tx.student.findMany({
          where: { classId },
          select: { id: true },
        });

        // Update each student individually to remove class association
        for (const student of students) {
          await tx.student.update({
            where: { id: student.id },
            data: { classId: null },
          });
        }

        // Finally delete the class
        await tx.class.delete({
          where: { id: classId },
        });
      });

      return {
        success: true,
        message: `Class with ID ${classId} has been successfully deleted`,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Failed to delete class: ${error.message}`,
      );
    }
  }
}
