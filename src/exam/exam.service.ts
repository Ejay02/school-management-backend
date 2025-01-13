import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Roles } from 'src/shared/enum/role';
import { PaginationParams } from 'src/shared/pagination/types/pagination.types';
import { PrismaQueryBuilder } from 'src/shared/pagination/utils/prisma.pagination';

import { UpdateExamInput } from './input/update.exam.input';
import { CreateExamInput } from './input/create.exam.input';

@Injectable()
export class ExamService {
  constructor(private prisma: PrismaService) {}

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

      // Verify lesson belongs to the class and subject
      const lesson = await tx.lesson.findFirst({
        where: {
          id: input.lessonId,
          classId: input.classId,
          subjectId: input.subjectId,
        },
      });

      if (!lesson) {
        throw new NotFoundException('Invalid lesson for this class/subject');
      }

      // Create the exam within the transaction
      return tx.exam.create({
        data: {
          title: input.title,
          startTime: input.startTime,
          endTime: input.endTime,
          lessonId: input.lessonId,
          classId: input.classId,
          subjectId: input.subjectId,
          teacherId,
        },
        include: {
          teacher: true,
          subject: true,
          class: true,
          lesson: true,
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
        data: input,
        include: {
          teacher: true,
          subject: true,
          class: true,
          lesson: true,
        },
      });
    });

    return result;
  }

  // Retrieve a list of exams scheduled for a particular class.
  async getClassExams(
    classId: string,
    userId: string,
    userRole: Roles,
    params: PaginationParams,
  ) {
    // Verify access based on role
    switch (userRole) {
      case Roles.TEACHER:
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

      case Roles.STUDENT:
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

      case Roles.PARENT:
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

    const baseQuery = {
      where: { classId },
      include: {
        teacher: true,
        subject: true,
        lesson: true,
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
  async getExamDetails(examId: string, userId: string, userRole: Roles) {
    const exam = await this.prisma.exam.findUnique({
      where: { id: examId },
      include: {
        teacher: true,
        subject: true,
        class: true,
        lesson: true,
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

  async deleteExam(examId: string) {
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
      throw new ForbiddenException('Cannot delete exam with existing results');
    }

    await this.prisma.exam.delete({
      where: { id: examId },
    });

    return true;
  }
}
