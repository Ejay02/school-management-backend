import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateGradeInput } from './input/create.grade.input';
import { GradeType } from './enum/gradeType';
import { UpdateGradeInput } from './input/update.grade.input';
import { PrismaQueryBuilder } from 'src/shared/pagination/utils/prisma.pagination';
import {
  PaginatedResponse,
  PaginationParams,
} from 'src/shared/pagination/types/pagination.types';

@Injectable()
export class GradeService {
  constructor(private prisma: PrismaService) {}

  // Assign a grade to a student's exam or assignment.
  async assignGrade(teacherId: string, input: CreateGradeInput) {
    return this.prisma.$transaction(async (tx) => {
      // Verify teacher has access to this student's class
      const hasAccess = await this.verifyTeacherAccess(
        teacherId,
        input.studentId,
      );
      if (!hasAccess) {
        throw new ForbiddenException(
          'You do not have access to grade this student',
        );
      }

      return tx.grade.create({
        data: {
          ...input,
        },
        include: {
          student: true,
          exam: true,
          assignment: true,
        },
      });
    });
  }

  // Modify a grade previously assigned to a student.
  async updateGrade(teacherId: string, input: UpdateGradeInput) {
    return this.prisma.$transaction(async (tx) => {
      const grade = await this.prisma.grade.findUnique({
        where: { id: input.id },
        include: { student: true },
      });

      if (!grade) {
        throw new NotFoundException('Grade not found');
      }

      const hasAccess = await this.verifyTeacherAccess(
        teacherId,
        grade.studentId,
      );
      if (!hasAccess) {
        throw new ForbiddenException(
          'You do not have access to modify this grade',
        );
      }

      return tx.grade.update({
        where: { id: input.id },
        data: {
          score: input.score,
          comments: input.comments,
        },
        include: {
          student: true,
          exam: true,
          assignment: true,
        },
      });
    });
  }

  // Retrieve a list of grades for a specific/signed in student.
  async getMyGrades(
    studentId: string,
    academicPeriod?: string,
    params?: PaginationParams,
  ): Promise<PaginatedResponse<any>> {
    const baseQuery = {
      where: {
        studentId,
        ...(academicPeriod && { academicPeriod }),
      },
      include: {
        exam: true,
        assignment: true,
      },
    };

    const searchFields = [
      'score',
      'exam',
      'academicPeriod',
      'exams',
      'comments',
    ];

    if (!params) {
      const data = await this.prisma.grade.findMany({
        ...baseQuery,
        orderBy: { createdAt: 'desc' },
      });
      return {
        data,
        meta: {
          total: data.length,
          page: 1,
          lastPage: 1, // Since all records are returned in one go, lastPage is 1
          limit: data.length,
        },
      };
    }

    return await PrismaQueryBuilder.paginateResponse(
      this.prisma.grade,
      baseQuery,
      params,
      searchFields,
    );
  }

  async getClassGrades(
    classId: string,
    academicPeriod?: string,
    params?: PaginationParams,
  ): Promise<PaginatedResponse<any>> {
    const baseQuery = {
      where: {
        student: {
          classId,
        },
        ...(academicPeriod && { academicPeriod }),
      },
      include: {
        student: true,
        exam: true,
        assignment: true,
      },
    };

    if (!params) {
      const data = await this.prisma.grade.findMany({
        ...baseQuery,
        orderBy: [{ student: { surname: 'asc' } }, { createdAt: 'desc' }],
      });

      return {
        data,
        meta: {
          total: data.length,
          page: 1,
          lastPage: 1, // Since all records are returned in one go, lastPage is 1
          limit: data.length,
        },
      };
    }

    return PrismaQueryBuilder.paginateResponse(
      this.prisma.grade,
      baseQuery,
      params,
      ['comments', 'student.firstName', 'student.surname'],
    );
  }

  async assignAssignmentGrade(
    studentId: string,
    assignmentId: string,
    score: number,
    academicPeriod: string,
    comments?: string,
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Check if student exists
        const student = await tx.student.findUnique({
          where: { id: studentId },
        });

        if (!student) {
          throw new Error(`Student with ID ${studentId} not found`);
        }

        // Check if assignment exists
        const assignment = await tx.assignment.findUnique({
          where: { id: assignmentId },
        });

        if (!assignment) {
          throw new Error(`Assignment with ID ${assignmentId} not found`);
        }

        // Create the grade
        return tx.grade.create({
          data: {
            studentId,
            assignmentId,
            score,
            type: GradeType.ASSIGNMENT,
            academicPeriod,
            comments,
          },
          include: {
            student: true,
            assignment: true,
          },
        });
      });
    } catch (error) {
      throw new Error(
        error instanceof Error
          ? error.message
          : 'An error occurred while creating the assignment grade',
      );
    }
  }

  async assignExamGrade(
    studentId: string,
    examId: string,
    score: number,
    academicPeriod: string,
    comments?: string,
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Check if student exists
        const student = await tx.student.findUnique({
          where: { id: studentId },
        });

        if (!student) {
          throw new Error(`Student with ID ${studentId} not found`);
        }

        // Check if exam exists
        const exam = await tx.exam.findUnique({
          where: { id: examId },
        });

        if (!exam) {
          throw new Error(`Exam with ID ${examId} not found`);
        }

        // Create the grade
        return tx.grade.create({
          data: {
            studentId,
            examId,
            score,
            type: GradeType.EXAM,
            academicPeriod,
            comments,
          },
          include: {
            student: true,
            exam: true,
          },
        });
      });
    } catch (error) {
      throw new Error(
        error instanceof Error
          ? error.message
          : 'An error occurred while creating the exam grade',
      );
    }
  }

  async calculateOverallGrade(studentId: string, academicPeriod: string) {
    const grades = await this.prisma.grade.findMany({
      where: {
        studentId,
        academicPeriod,
        type: {
          in: [GradeType.EXAM, GradeType.ASSIGNMENT],
        },
      },
    });

    if (grades.length === 0) {
      return null;
    }

    const averageScore =
      grades.reduce((sum, grade) => sum + grade.score, 0) / grades.length;

    // First, fetch the student to include in the grade creation
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
    });

    if (!student) {
      throw new Error(`Student with ID ${studentId} not found`);
    }

    // Create the grade with the student relation
    return this.prisma.grade.create({
      data: {
        studentId,
        score: averageScore,
        type: GradeType.OVERALL,
        academicPeriod,
        comments: 'Overall grade calculated from exams and assignments',
      },
      include: {
        student: true,
      },
    });
  }

  private async verifyTeacherAccess(teacherId: string, studentId: string) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: { classId: true },
    });

    if (!student) return false;

    const teacherClass = await this.prisma.class.findFirst({
      where: {
        id: student.classId,
        OR: [
          { supervisorId: teacherId },
          { subjects: { some: { teachers: { some: { id: teacherId } } } } },
        ],
      },
    });

    return !!teacherClass;
  }

  // Remove a grade from the system.
  async deleteGrade(gradeId: string): Promise<boolean> {
    try {
      await this.prisma.$transaction(async (tx) => {
        const grade = await tx.grade.findUnique({
          where: { id: gradeId },
        });

        if (!grade) {
          throw new Error('Grade not found');
        }

        await tx.grade.delete({
          where: { id: gradeId },
        });
      });
      return true;
    } catch (error) {
      throw new Error(`Error deleting grade: ${gradeId}`);
    }
  }
}
