import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

import { DefaultClass } from 'src/class/enum/class';
import { SubjectsForClasses } from './enum/subject';
import { Roles } from 'src/shared/enum/role';
import { PrismaQueryBuilder } from 'src/shared/pagination/utils/prisma.pagination';
import { PaginationParams } from 'src/shared/pagination/types/pagination.types';
import { CreateSubjectInput } from './input/create.subject.input';
import { UpdateSubjectInput } from './input/update.subject.input';
import { DeleteResponse } from 'src/shared/auth/response/delete.response';

@Injectable()
export class SubjectService {
  constructor(private readonly prisma: PrismaService) {}

  public async generateAllSubjects(tx: any): Promise<void> {
    // Fetch all classes from the database
    const classes = await tx.class.findMany();

    for (const classItem of classes) {
      // Get the DefaultClass name for this class
      const defaultClassName = classItem.name as DefaultClass;
      // Get the subjects for this class from your mapping
      const subjectsForClass = SubjectsForClasses[defaultClassName] || [];

      for (const subjectName of subjectsForClass) {
        // Check if the subject already exists for this class
        const existingSubject = await tx.subject.findFirst({
          where: {
            name: subjectName,
            classId: classItem.id,
          },
        });

        if (!existingSubject) {
          await tx.subject.create({
            data: {
              name: subjectName,
              classId: classItem.id,
              gradeId: classItem.supervisorId, // adjust as necessary
            },
          });
        }
      }
    }
  }

  async assignSubjectsToClass(
    classId: string,
    subjectIds: string[],
    userRole: Roles,
  ) {
    // Verify user is admin
    if (userRole !== Roles.ADMIN && userRole !== Roles.SUPER_ADMIN) {
      throw new ForbiddenException(
        'Only administrators can assign subjects to classes',
      );
    }

    // Verify class exists
    const classExists = await this.prisma.class.findUnique({
      where: { id: classId },
    });

    if (!classExists) {
      throw new NotFoundException('Class not found');
    }

    // Verify all subjects exist
    const subjects = await this.prisma.subject.findMany({
      where: {
        id: {
          in: subjectIds,
        },
      },
    });

    if (subjects.length !== subjectIds.length) {
      throw new BadRequestException('One or more subject IDs are invalid');
    }

    // Perform the assignment
    try {
      const updatedClass = await this.prisma.class.update({
        where: { id: classId },
        data: {
          subjects: {
            connect: subjectIds.map((id) => ({ id })),
          },
        },
        include: {
          subjects: true,
        },
      });

      return {
        success: true,
        message: `Successfully assigned ${subjectIds.length} subjects to class`,
        data: updatedClass,
      };
    } catch (error) {
      throw new InternalServerErrorException(
        'Failed to assign subjects to class',
      );
    }
  }

  async getAllSubjects(
    userId: string,
    userRole: Roles,
    params?: PaginationParams,
  ) {
    try {
      const baseInclude = {
        exams: true,
        teachers: true,
        lessons: true,
        assignments: true,
        grade: true,
        class: true,
      };

      const baseQuery: any = {
        include: baseInclude,
        orderBy: { createdAt: 'desc' },
      };

      const searchFields = ['name', 'class'];

      switch (userRole) {
        case Roles.SUPER_ADMIN:
        case Roles.ADMIN:
          // Admins can see all subjects
          break;

        case Roles.TEACHER:
          // Teachers only see subjects they teach
          baseQuery.where = {
            teachers: {
              some: {
                id: userId,
              },
            },
          };
          break;

        case Roles.PARENT:
          // Parents see subjects their children are enrolled in
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
                class: {
                  id: {
                    in: children.map((child) => child.classId),
                  },
                },
              },
              {
                grade: {
                  id: {
                    in: children.map((child) => child.gradeId),
                  },
                },
              },
            ],
          };
          break;

        case Roles.STUDENT:
          // Students see subjects in their class/grade
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
            'You do not have permission to view subjects',
          );
      }

      return await PrismaQueryBuilder.paginateResponse(
        this.prisma.subject,
        baseQuery,
        params,
        searchFields,
      );
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      if (error instanceof ForbiddenException) throw error;
      throw new InternalServerErrorException('Failed to fetch subjects');
    }
  }
  async getSubjectById(subjectId: string) {
    const subject = await this.prisma.subject.findUnique({
      where: { id: subjectId },
      include: {
        lessons: true,
        class: true,
        teachers: true,
        exams: {
          orderBy: {
            createdAt: 'desc',
          },
        },
        assignments: {
          orderBy: {
            dueDate: 'desc',
          },
        },
      },
    });

    if (!subject) {
      throw new NotFoundException(`Subject with ID ${subjectId} not found`);
    }

    return subject;
  }

  async createSubject(input: CreateSubjectInput) {
    return await this.prisma.$transaction(async (tx) => {
      // Check if class exists
      const classExists = await tx.class.findUnique({
        where: { id: input.classId },
      });
      if (!classExists) {
        throw new NotFoundException(`Class with ID ${input.classId} not found`);
      }

      // Check if teacher exists
      const teacherExists = await tx.teacher.findUnique({
        where: { id: input.teacherId },
      });
      if (!teacherExists) {
        throw new NotFoundException(
          `Teacher with ID ${input.teacherId} not found`,
        );
      }

      // Create the subject
      return await tx.subject.create({
        data: {
          name: input.name,
          classId: input.classId,
          teachers: {
            connect: { id: input.teacherId },
          },
        },
        include: {
          class: true,
          teachers: true,
        },
      });
    });
  }

  async updateSubject(subjectId: string, input: UpdateSubjectInput) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Check if subject exists
        const existingSubject = await tx.subject.findUnique({
          where: { id: subjectId },
          include: { teachers: true },
        });

        if (!existingSubject) {
          throw new NotFoundException(`Subject with ID ${subjectId} not found`);
        }

        // Check if class exists if provided
        if (input.classId) {
          const classExists = await tx.class.findUnique({
            where: { id: input.classId },
          });
          if (!classExists) {
            throw new NotFoundException(
              `Class with ID ${input.classId} not found`,
            );
          }
        }

        // Check if teacher exists if provided
        if (input.teacherId) {
          const teacherExists = await tx.teacher.findUnique({
            where: { id: input.teacherId },
          });
          if (!teacherExists) {
            throw new NotFoundException(
              `Teacher with ID ${input.teacherId} not found`,
            );
          }
        }

        // Check if name is being updated and if it already exists in the same class
        if (input.name && input.name !== existingSubject.name) {
          const nameExists = await tx.subject.findFirst({
            where: {
              name: input.name,
              classId: input.classId || existingSubject.classId,
              id: { not: subjectId }, // Exclude current subject
            },
          });
          if (nameExists) {
            throw new ConflictException(
              `Subject with name ${input.name} already exists in this class`,
            );
          }
        }

        // Build update data object with explicit properties
        const updateData: any = {
          ...(input.name && { name: input.name }),
          ...(input.classId && { classId: input.classId }),
        };

        // Handle teacher connection if provided
        if (input.teacherId) {
          // First disconnect existing teachers if needed
          if (existingSubject.teachers.length > 0) {
            await tx.subject.update({
              where: { id: subjectId },
              data: {
                teachers: {
                  disconnect: existingSubject.teachers.map((teacher) => ({
                    id: teacher.id,
                  })),
                },
              },
            });
          }

          // Then connect the new teacher
          updateData.teachers = {
            connect: { id: input.teacherId },
          };
        }

        // Log the update operation for debugging
        console.log('Updating subject with data:', updateData);

        // Perform the update
        const updatedSubject = await tx.subject.update({
          where: { id: subjectId },
          data: updateData,
          include: {
            class: true,
            teachers: true,
          },
        });

        console.log('Updated subject:', updatedSubject);
        return updatedSubject;
      });
    } catch (error) {
      console.error('Error updating subject:', error);
      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Failed to update subject: ${error.message}`,
      );
    }
  }

  async deleteSubject(subjectId: string): Promise<DeleteResponse> {
    try {
      await this.prisma.$transaction(async (tx) => {
        // Check if subject exists
        const existingSubject = await tx.subject.findUnique({
          where: { id: subjectId },
        });

        if (!existingSubject) {
          throw new NotFoundException(`Subject with ID ${subjectId} not found`);
        }

        // Delete related records first
        await tx.lesson.deleteMany({ where: { subjectId } });
        await tx.exam.deleteMany({ where: { subjectId } });
        await tx.assignment.deleteMany({ where: { subjectId } });

        // Remove teacher connections
        await tx.subject.update({
          where: { id: subjectId },
          data: {
            teachers: {
              set: [], // Remove all teacher connections
            },
          },
        });

        // Finally delete the subject
        await tx.subject.delete({
          where: { id: subjectId },
        });
      });

      return {
        success: true,
        message: `Subject with ID ${subjectId} has been successfully deleted`,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Failed to delete subject: ${error.message}`,
      );
    }
  }
}
