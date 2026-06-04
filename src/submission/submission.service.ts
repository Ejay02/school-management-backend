import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

import { PrismaQueryBuilder } from '../shared/pagination/utils/prisma.pagination';
import { UpdateSubmissionInput } from './input/update.submission.input';
import { CreateSubmissionInput } from './input/create.submission.input';
import { PaginationParams } from '../shared/pagination/types/pagination.types';
import { GradeSubmissionInput } from './input/grade.submission.input';
import { ResultType } from '../result/enum/resultType';

@Injectable()
export class SubmissionService {
  constructor(private readonly prisma: PrismaService) {}

  async getTeacherSubmissions(teacherId: string, params?: PaginationParams) {
    const baseQuery = {
      where: {
        assignment: { teacherId },
      },
      include: {
        student: true,
        result: true,
        assignment: {
          include: {
            class: true,
            subject: true,
          },
        },
      },
      orderBy: [{ updatedAt: 'desc' as const }, { submissionDate: 'desc' as const }],
    };

    const searchFields = ['content', 'status'];

    return PrismaQueryBuilder.paginateResponse(
      this.prisma.submission,
      baseQuery,
      params,
      searchFields,
    );
  }

  async getTeacherPendingSubmissions(
    teacherId: string,
    params?: PaginationParams,
  ) {
    const baseQuery = {
      where: {
        assignment: { teacherId },
        OR: [{ status: 'SUBMITTED' }, { status: 'submitted' }],
      },
      include: {
        student: true,
        assignment: {
          include: {
            class: true,
            subject: true,
          },
        },
      },
      orderBy: { submissionDate: 'desc' as const },
    };

    const searchFields = ['content', 'status'];

    return PrismaQueryBuilder.paginateResponse(
      this.prisma.submission,
      baseQuery,
      params,
      searchFields,
    );
  }

  async gradeSubmission(teacherId: string, input: GradeSubmissionInput) {
    const roundedScore = Math.round(Number(input.score));
    if (Number.isNaN(roundedScore) || roundedScore < 0 || roundedScore > 100) {
      throw new ForbiddenException('Score must be between 0 and 100');
    }

    return this.prisma.$transaction(async (tx) => {
      const submission = await tx.submission.findUnique({
        where: { id: input.submissionId },
        include: {
          student: true,
          assignment: {
            include: {
              class: true,
              subject: true,
            },
          },
          result: true,
        },
      });

      if (!submission) {
        throw new NotFoundException('Submission not found');
      }

      if (submission.assignment.teacherId !== teacherId) {
        throw new ForbiddenException(
          'You do not have permission to grade this submission',
        );
      }

      const reusableResult =
        submission.result &&
        submission.result.studentId === submission.studentId &&
        submission.result.assignmentId === submission.assignmentId
          ? submission.result
          : null;

      const result = reusableResult
        ? await tx.result.update({
            where: { id: reusableResult.id },
            data: {
              score: roundedScore,
              comments: input.comments?.trim() || null,
              academicPeriod: input.academicPeriod?.trim() || null,
              term: input.term,
              type: ResultType.ASSIGNMENT,
              isOfficialResult: true,
            },
          })
        : await tx.result.create({
            data: {
              studentId: submission.studentId,
              assignmentId: submission.assignmentId,
              score: roundedScore,
              comments: input.comments?.trim() || null,
              academicPeriod: input.academicPeriod?.trim() || null,
              term: input.term,
              type: ResultType.ASSIGNMENT,
              isOfficialResult: true,
            },
          });

      return tx.submission.update({
        where: { id: submission.id },
        data: {
          status: 'GRADED',
          resultId: result.id,
        },
        include: {
          student: true,
          result: true,
          assignment: {
            include: {
              class: true,
              subject: true,
            },
          },
        },
      });
    });
  }

  async getSubmissionsByAssignment(
    assignmentId: string,
    teacherId: string,
    params?: PaginationParams,
  ) {
    // Verify teacher has access to this assignment
    const assignment = await this.prisma.assignment.findFirst({
      where: {
        id: assignmentId,
        teacherId,
      },
    });

    if (!assignment) {
      throw new ForbiddenException('You do not have access to this assignment');
    }

    const baseQuery = {
      where: { assignmentId },
      include: {
        student: true,
        assignment: true,
      },
    };

    const searchFields = ['content', 'status'];

    return PrismaQueryBuilder.paginateResponse(
      this.prisma.submission,
      baseQuery,
      params,
      searchFields,
    );
  }

  async getMySubmissions(studentId: string, params?: PaginationParams) {
    const baseQuery = {
      where: { studentId },
      include: {
        assignment: true,
      },
    };

    const searchFields = ['content', 'status'];

    return PrismaQueryBuilder.paginateResponse(
      this.prisma.submission,
      baseQuery,
      params,
      searchFields,
    );
  }

  async getAllClassSubmissions(classId: string, params?: PaginationParams) {
    const baseQuery = {
      where: {
        assignment: {
          classId,
        },
      },
      include: {
        student: true,
        assignment: true,
      },
    };

    const searchFields = ['content', 'status'];

    return PrismaQueryBuilder.paginateResponse(
      this.prisma.submission,
      baseQuery,
      params,
      searchFields,
    );
  }

  async createSubmission(studentId: string, input: CreateSubmissionInput) {
    // Verify assignment exists and is active
    const assignment = await this.prisma.assignment.findUnique({
      where: { id: input.assignmentId },
      include: { submissions: true },
    });

    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }

    // Check if submission deadline has passed
    if (new Date() > assignment.dueDate) {
      throw new ForbiddenException('Submission deadline has passed');
    }

    // Check if student has already submitted
    const existingSubmission = assignment.submissions.find(
      (sub) => sub.studentId === studentId,
    );

    if (existingSubmission) {
      throw new ForbiddenException(
        'You have already submitted for this assignment',
      );
    }

    return this.prisma.submission.create({
      data: {
        studentId,
        assignmentId: input.assignmentId,
        content: input.content,
        status: 'SUBMITTED',
        resultId: (
          await this.prisma.student.findUnique({
            where: { id: studentId },
            select: {
              result: {
                take: 1,
                orderBy: { createdAt: 'desc' },
                select: { id: true },
              },
            },
          })
        ).result[0]?.id,
      },
      include: {
        student: true,
        assignment: true,
      },
    });
  }

  async editSubmission(
    submissionId: string,
    studentId: string,
    input: UpdateSubmissionInput,
  ) {
    const submission = await this.prisma.submission.findUnique({
      where: { id: submissionId },
      include: { assignment: true },
    });

    if (!submission) {
      throw new NotFoundException('Submission not found');
    }

    if (submission.studentId !== studentId) {
      throw new ForbiddenException('You can only edit your own submissions');
    }

    if (new Date() > submission.assignment.dueDate) {
      throw new ForbiddenException('Cannot edit submission after deadline');
    }

    return this.prisma.submission.update({
      where: { id: submissionId },
      data: {
        content: input.content,
        updatedAt: new Date(),
      },
      include: {
        student: true,
        assignment: true,
      },
    });
  }

  async deleteSubmission(submissionId: string, studentId: string) {
    const submission = await this.prisma.submission.findUnique({
      where: { id: submissionId },
      include: { assignment: true },
    });

    if (!submission) {
      throw new NotFoundException('Submission not found');
    }

    if (submission.studentId !== studentId) {
      throw new ForbiddenException('You can only delete your own submissions');
    }

    if (new Date() > submission.assignment.dueDate) {
      throw new ForbiddenException('Cannot delete submission after deadline');
    }

    await this.prisma.submission.delete({
      where: { id: submissionId },
    });

    return true;
  }
}
