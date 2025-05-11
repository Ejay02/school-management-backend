import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Roles } from 'src/shared/enum/role';
import {
  PaginatedResponse,
  PaginationParams,
} from 'src/shared/pagination/types/pagination.types';
import { PrismaQueryBuilder } from 'src/shared/pagination/utils/prisma.pagination';

import { UpdateExamInput } from './input/update.exam.input';
import { CreateExamInput } from './input/create.exam.input';
import { Exam } from './types/exam.types';
import { DeleteResponse } from 'src/shared/auth/response/delete.response';

@Injectable()
export class ExamService {
  constructor(private readonly prisma: PrismaService) {}

  async createExam(teacherId: string, input: CreateExamInput) {
    // Start a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Verify teacher has access to this class and subject
      const hasAccess = await tx.teacher.findFirst({
        where: {
          id: teacherId,
          subjects: {
            some: {
              id: input.subjectId,
              classId: input.classId,
            },
          },
        },
      });

      if (!hasAccess) {
        throw new ForbiddenException(
          'You do not have access to this class/subject',
        );
      }

      // Create the exam within the transaction
      return tx.exam.create({
        data: {
          title: input.title,
          startTime: input.startTime,
          endTime: input.endTime,
          date: input.date,
          description: input.description,
          instructions: input.instructions,
          content: input.content,
          class: {
            connect: { id: input.classId },
          },
          subject: {
            connect: { id: input.subjectId },
          },
          teacher: {
            connect: { id: teacherId },
          },
          // Create questions if provided
          questions: input.questions
            ? {
                create: input.questions.map((q) => ({
                  type: q.questionType,
                  content: q.content,
                  options: q.options,
                  correctAnswer: q.correctAnswer,
                  points: q.points,
                })),
              }
            : undefined,
        },
        include: {
          teacher: true,
          subject: true,
          class: true,
          // lesson: true,
        },
      });
    });

    return result;
  }

  async updateExam(examId: string, teacherId: string, input: UpdateExamInput) {
    // Start a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      const exam = await tx.exam.findUnique({
        where: { id: examId },
      });

      if (!exam) {
        throw new NotFoundException('Exam not found');
      }

      if (exam.teacherId !== teacherId) {
        throw new ForbiddenException('You can only edit your own exams');
      }

      // Update the exam within the transaction
      return tx.exam.update({
        where: { id: examId },
        data: {
          title: input.title,
          startTime: input.startTime,
          endTime: input.endTime,
          date: input.date,
          description: input.description,
          instructions: input.instructions,
          content: input.content,
          // Handle questions update if provided
          questions: input.questions
            ? {
                deleteMany: {}, // Remove existing questions
                create: input.questions.map((q) => ({
                  type: q.questionType,
                  content: q.content,
                  options: q.options,
                  correctAnswer: q.correctAnswer,
                  points: q.points,
                })),
              }
            : undefined,
        },
        include: {
          teacher: true,
          subject: true,
          class: true,
          // lesson: true,
        },
      });
    });

    return result;
  }

  async getAllExams(
    userId: string,
    userRole: Roles,
    params: PaginationParams,
  ): Promise<PaginatedResponse<Exam>> {
    try {
      // Base query that will be modified based on user role
      const baseQuery: any = {
        include: {
          subject: true,
          class: true,
          teacher: true,
          results: {
            include: {
              student: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      };

      // Apply role-based filtering
      switch (userRole) {
        case Roles.SUPER_ADMIN:
        case Roles.ADMIN: {
          // Admins can see all exams
          // No additional filters needed
          break;
        }

        case Roles.TEACHER: {
          // Teachers can only see exams they've created
          baseQuery.where = {
            teacherId: userId,
          };
          break;
        }

        case Roles.STUDENT: {
          // Students can only see exams for their class
          const student = await this.prisma.student.findUnique({
            where: { id: userId },
            select: { classId: true },
          });

          if (!student) {
            throw new NotFoundException('Student not found');
          }

          baseQuery.where = {
            classId: student.classId,
          };
          break;
        }

        default:
          throw new ForbiddenException('Unauthorized access to exams');
      }

      // Define searchable fields for exam name, teacher name, subject name, and class name
      const searchFields = [
        'title',
        'teacher.name',
        'subject.name',
        'class.name',
      ];

      return await PrismaQueryBuilder.paginateResponse(
        this.prisma.exam,
        baseQuery,
        params,
        searchFields,
      );
    } catch (error) {
      if (
        error instanceof ForbiddenException ||
        error instanceof NotFoundException
      )
        throw error;
      throw new InternalServerErrorException('Failed to fetch exams');
    }
  }

  // Retrieve a list of exams scheduled for a particular class.
  async getClassExams(
    classId: string,
    userId: string,
    userRole: Roles,
    params?: PaginationParams,
  ) {
    // Verify access based on role
    switch (userRole) {
      case Roles.TEACHER: {
        const teacherAccess = await this.prisma.class.findFirst({
          where: {
            id: classId,
            OR: [
              { supervisorId: userId },
              { subjects: { some: { teachers: { some: { id: userId } } } } },
            ],
          },
        });
        if (!teacherAccess) {
          throw new ForbiddenException('You do not have access to this class');
        }
        break;
      }

      case Roles.STUDENT: {
        const studentAccess = await this.prisma.student.findFirst({
          where: {
            id: userId,
            classId,
          },
        });
        if (!studentAccess) {
          throw new ForbiddenException('You do not have access to this class');
        }
        break;
      }

      case Roles.PARENT: {
        const parentAccess = await this.prisma.parent.findFirst({
          where: {
            id: userId,
            students: {
              some: {
                classId,
              },
            },
          },
        });
        if (!parentAccess) {
          throw new ForbiddenException('You do not have access to this class');
        }
        break;
      }
    }

    const baseQuery = {
      where: { classId },
      include: {
        teacher: true,
        subject: true,
        // lesson: true,
      },
      orderBy: {
        startTime: 'asc',
      },
    };

    const searchFields = ['title'];

    const result = await PrismaQueryBuilder.paginateResponse(
      this.prisma.exam,
      baseQuery,
      params,
      searchFields,
    );

    return result.data;
  }

  // Retrieve detailed information about a specific exam.
  async getExamById(examId: string, userId: string, userRole: Roles) {
    const exam = await this.prisma.exam.findUnique({
      where: { id: examId },
      include: {
        teacher: true,
        subject: true,
        class: true,
        questions: true,
        // lesson: true,
      },
    });

    if (!exam) {
      throw new NotFoundException('Exam not found');
    }

    // Verify access based on role
    switch (userRole) {
      case Roles.TEACHER:
        const teacherAccess = await this.prisma.class.findFirst({
          where: {
            id: exam.classId,
            OR: [
              { supervisorId: userId },
              { subjects: { some: { teachers: { some: { id: userId } } } } },
            ],
          },
        });
        if (!teacherAccess) {
          throw new ForbiddenException('You do not have access to this exam');
        }
        break;

      case Roles.STUDENT:
        const studentAccess = await this.prisma.student.findFirst({
          where: {
            id: userId,
            classId: exam.classId,
          },
        });
        if (!studentAccess) {
          throw new ForbiddenException('You do not have access to this exam');
        }
        break;

      case Roles.PARENT:
        const parentAccess = await this.prisma.parent.findFirst({
          where: {
            id: userId,
            students: {
              some: {
                classId: exam.classId,
              },
            },
          },
        });
        if (!parentAccess) {
          throw new ForbiddenException('You do not have access to this exam');
        }
        break;
    }

    return exam;
  }

  async deleteExam(examId: string): Promise<DeleteResponse> {
    try {
      const exam = await this.prisma.exam.findUnique({
        where: { id: examId },
      });

      if (!exam) {
        throw new NotFoundException('Exam not found');
      }

      // Check if exam has any results
      const hasResults = await this.prisma.result.findFirst({
        where: { examId },
      });

      if (hasResults) {
        throw new ForbiddenException(
          'Cannot delete exam with existing results',
        );
      }

      // Delete questions first
      await this.prisma.question.deleteMany({
        where: { examId },
      });

      // Then delete the exam
      await this.prisma.exam.delete({
        where: { id: examId },
      });

      return {
        success: true,
        message: `Exam with ID ${examId} has been successfully deleted`,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Failed to delete exam: ${error.message}`,
      );
    }
  }
}
