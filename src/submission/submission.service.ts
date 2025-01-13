import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { PaginationParams } from 'src/shared/pagination/types/pagination.types';
import { PrismaQueryBuilder } from 'src/shared/pagination/utils/prisma.pagination';
import { UpdateSubmissionInput } from './input/update.submission.input';
import { CreateSubmissionInput } from './input/create.submission.input';

@Injectable()
export class SubmissionService {
  constructor(private prisma: PrismaService) {}

  async getSubmissionsByAssignment(
    assignmentId: string,
    teacherId: string,
    params: PaginationParams,
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

  async getMySubmissions(studentId: string, params: PaginationParams) {
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

  async getAllClassSubmissions(classId: string, params: PaginationParams) {
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
        gradeId: (
          await this.prisma.student.findUnique({
            where: { id: studentId },
            select: { gradeId: true },
          })
        ).gradeId,
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
