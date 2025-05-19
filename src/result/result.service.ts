import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { AnnouncementService } from 'src/announcement/announcement.service';
import { Roles } from 'src/shared/enum/role';
import { ClassService } from '../class/class.service';

import { PrismaQueryBuilder } from 'src/shared/pagination/utils/prisma.pagination';
import {
  PaginatedResponse,
  PaginationParams,
} from 'src/shared/pagination/types/pagination.types';
import { UpdateResultInput } from 'src/result/input/update.result.input';
import { CreateResultInput } from 'src/result/input/create.result.input';
import { DeleteResponse } from 'src/shared/auth/response/delete.response';
import { ResultType } from './enum/resultType';
import { Term } from 'src/payment/enum/term';

@Injectable()
export class ResultService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly announcementService: AnnouncementService,
    private readonly classService: ClassService,
  ) {}

  async generateResults(data: {
    examId?: string;
    assignmentId?: string;
    studentId: string;
    score: number;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const result = await tx.result.create({
        data: {
          score: data.score,
          examId: data.examId,
          assignmentId: data.assignmentId,
          studentId: data.studentId,
        },
        include: {
          exam: true,
          assignment: true,
          student: true,
        },
      });
      return result;
    });
  }

  async getStudentResults(studentId: string) {
    return this.prisma.$transaction(async (tx) => {
      const results = await tx.result.findMany({
        where: { studentId },
        include: {
          exam: true,
          assignment: true,
          student: true,
        },
      });
      return results;
    });
  }

  // Assign a grade to a student's exam or assignment.
  async assignResult(teacherId: string, input: CreateResultInput) {
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

      return tx.result.create({
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
  async updateResult(teacherId: string, input: UpdateResultInput) {
    return this.prisma.$transaction(async (tx) => {
      const result = await this.prisma.result.findUnique({
        where: { id: input.id },
        include: { student: true },
      });

      if (!result) {
        throw new NotFoundException('Result not found');
      }

      const hasAccess = await this.verifyTeacherAccess(
        teacherId,
        result.studentId,
      );
      if (!hasAccess) {
        throw new ForbiddenException(
          'You do not have access to modify this result',
        );
      }

      return tx.result.update({
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
  async getMyResult(
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
      const data = await this.prisma.result.findMany({
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
      this.prisma.result,
      baseQuery,
      params,
      searchFields,
    );
  }

  async getChildrenResults(
    parentId: string,
    studentId?: string,
    academicPeriod?: string,
    params?: PaginationParams,
  ): Promise<PaginatedResponse<any>> {
    // First verify this parent has access to the requested student(s)
    let studentIds: string[] = [];

    if (studentId) {
      // If a specific student is requested, verify parent relationship
      const hasAccess = await this.prisma.parent.findFirst({
        where: {
          id: parentId,
          students: {
            some: {
              id: studentId,
            },
          },
        },
      });

      if (!hasAccess) {
        throw new ForbiddenException(
          "You can only view your children's grades",
        );
      }

      studentIds = [studentId];
    } else {
      // Get all children of this parent
      const parent = await this.prisma.parent.findUnique({
        where: { id: parentId },
        include: {
          students: {
            select: { id: true },
          },
        },
      });

      if (!parent || parent.students.length === 0) {
        return {
          data: [],
          meta: {
            total: 0,
            page: 1,
            lastPage: 1,
            limit: 0,
          },
        };
      }

      studentIds = parent.students.map((student) => student.id);
    }

    // Now use the existing getMyGrades logic but with an array of student IDs
    const baseQuery = {
      where: {
        studentId: { in: studentIds },
        ...(academicPeriod && { academicPeriod }),
      },
      include: {
        student: true,
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
      'student.firstName',
      'student.surname',
    ];

    if (!params) {
      const data = await this.prisma.result.findMany({
        ...baseQuery,
        orderBy: [{ student: { surname: 'asc' } }, { createdAt: 'desc' }],
      });

      return {
        data,
        meta: {
          total: data.length,
          page: 1,
          lastPage: 1,
          limit: data.length,
        },
      };
    }

    return PrismaQueryBuilder.paginateResponse(
      this.prisma.result,
      baseQuery,
      params,
      searchFields,
    );
  }

  async getClassResults(
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

    let data;
    if (!params) {
      data = await this.prisma.result.findMany({
        ...baseQuery,
        orderBy: [{ student: { surname: 'asc' } }, { createdAt: 'desc' }],
      });
    } else {
      const paginatedResponse = await PrismaQueryBuilder.paginateResponse(
        this.prisma.result,
        baseQuery,
        params,
        ['comments', 'student.firstName', 'student.surname'],
      );
      data = paginatedResponse.data;
    }

    // Group results by student
    const studentMap = {};

    // Process each result and organize by student
    data.forEach((result) => {
      const studentId = result.studentId;

      // Initialize student object if not exists
      studentMap[studentId] ??= {
        id: result.student.id,
        name: result.student.name,
        surname: result.student.surname,
        image: result.student.image,
        termResults: {
          FIRST: { exams: [], assignments: [], averageScore: 0 },
          SECOND: { exams: [], assignments: [], averageScore: 0 },
          THIRD: { exams: [], assignments: [], averageScore: 0 },
          OVERALL: { score: 0 },
        },
      };

      // Add result to appropriate term array
      if (result.term) {
        const termData = studentMap[studentId].termResults[result.term];

        if (result.examId) {
          termData.exams.push({
            id: result.id,
            examId: result.examId,
            examTitle: result.exam?.title ?? 'Unknown Exam',
            score: result.score,
            comments: result.comments,
            createdAt: result.createdAt,
          });
        } else if (result.assignmentId) {
          termData.assignments.push({
            id: result.id,
            assignmentId: result.assignmentId,
            assignmentTitle: result.assignment?.title ?? 'Unknown Assignment',
            score: result.score,
            comments: result.comments,
            createdAt: result.createdAt,
          });
        }

        // Recalculate average score for the term
        const allScores = [...termData.exams, ...termData.assignments].map(
          (item) => item.score,
        );
        termData.averageScore =
          allScores.length > 0
            ? Math.round(
                allScores.reduce((sum, score) => sum + score, 0) /
                  allScores.length,
              )
            : 0;
      } else if (result.type === 'OVERALL') {
        studentMap[studentId].termResults.OVERALL.score = result.score;
      }
    });

    // Calculate overall scores if not explicitly provided
    Object.values(studentMap).forEach((student: any) => {
      if (student.termResults.OVERALL.score === 0) {
        const termScores = [
          student.termResults.FIRST.averageScore,
          student.termResults.SECOND.averageScore,
          student.termResults.THIRD.averageScore,
        ].filter((score) => score > 0);

        if (termScores.length > 0) {
          student.termResults.OVERALL.score = Math.round(
            termScores.reduce((sum, score) => sum + score, 0) /
              termScores.length,
          );
        }
      }
    });

    // Convert to array format
    const formattedResults = Object.values(studentMap);

    return {
      data: formattedResults,
      meta: {
        total: formattedResults.length,
        page: params?.page || 1,
        lastPage: params?.page || 1,
        limit: params?.limit || formattedResults.length,
      },
    };
  }

  async assignAssignmentResult(
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
        return tx.result.create({
          data: {
            studentId,
            assignmentId,
            score,
            type: ResultType.ASSIGNMENT,
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

  // term
  async calculateFinalResult(studentId: string, classId: string, term: Term) {
    // Get all results for this student in this class
    const results = await this.prisma.result.findMany({
      where: {
        studentId,
        term,
        OR: [{ exam: { classId } }, { assignment: { classId } }],
      },
      include: {
        exam: true,
        assignment: true,
      },
    });

    // Separate exam and assignment results
    const examResults = results.filter((r) => r.examId);
    const assignmentResults = results.filter((r) => r.assignmentId);

    // Calculate average scores
    const examAverage =
      examResults.length > 0
        ? examResults.reduce((sum, r) => sum + r.score, 0) / examResults.length
        : 0;

    const assignmentAverage =
      assignmentResults.length > 0
        ? assignmentResults.reduce((sum, r) => sum + r.score, 0) /
          assignmentResults.length
        : 0;

    // Apply weights: 60% exam, 40% assignment
    const finalGrade = examAverage * 0.6 + assignmentAverage * 0.4;

    return finalGrade;
  }

  // year
  async calculateOverallResult(studentId: string, academicPeriod: string) {
    const grades = await this.prisma.result.findMany({
      where: {
        studentId,
        academicPeriod,
        type: {
          in: [ResultType.EXAM, ResultType.ASSIGNMENT],
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
    return this.prisma.result.create({
      data: {
        studentId,
        score: averageScore,
        type: ResultType.OVERALL,
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

  async deleteResult(resultId: string): Promise<DeleteResponse> {
    await this.prisma.$transaction(async (tx) => {
      await tx.result.delete({
        where: { id: resultId },
      });
    });

    return {
      success: true,
      message: `Result has been successfully deleted`,
    };
  }

  async getResultStatistics(className: string) {
    return this.prisma.$transaction(async (tx) => {
      const classId = await this.classService.getClassId(className);

      // Fetch all results related to the specified class (linked to exams or assignments)
      const results = await tx.result.findMany({
        where: {
          OR: [{ exam: { classId } }, { assignment: { classId } }],
        },
      });

      // Extract scores from the fetched results
      const scores = results.map((r) => r.score);

      // Handle case with no results
      if (scores.length === 0) {
        return {
          average: 0,
          highest: 0,
          lowest: 0,
          totalStudents: 0,
          distribution: {
            above90: 0,
            above80: 0,
            above70: 0,
            above60: 0,
            below50: 0,
          },
        };
      }

      // Calculate the average score by summing all scores and dividing by the total count
      const average = scores.reduce((a, b) => a + b, 0) / scores.length;

      // Determine the highest and lowest scores among all results
      const highest = Math.max(...scores);
      const lowest = Math.min(...scores);

      return {
        average,
        highest,
        lowest,
        totalStudents: scores.length,
        distribution: {
          above90: scores.filter((s) => s >= 90).length,
          above80: scores.filter((s) => s >= 80 && s < 90).length,
          above70: scores.filter((s) => s >= 70 && s < 80).length,
          above60: scores.filter((s) => s >= 60 && s < 70).length,
          below50: scores.filter((s) => s < 50).length,
        },
      };
    });
  }

  async getResultHistory(studentId: string, academicYear?: string) {
    return this.prisma.$transaction(async (tx) => {
      const where: Prisma.ResultWhereInput = { studentId };
      if (academicYear) {
        where.createdAt = {
          gte: new Date(academicYear + '-01-01'),
          lte: new Date(academicYear + '-12-31'),
        };
      }

      const results = await tx.result.findMany({
        where,
        include: {
          exam: true,
          assignment: true,
          student: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
      return results;
    });
  }

  async publishResults(data: {
    classId: string;
    creatorId: string;
    term: string;
    message?: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      // First, publish the results
      const results = await tx.result.findMany({
        where: {
          OR: [
            { exam: { classId: data.classId } },
            { assignment: { classId: data.classId } },
          ],
        },
        include: {
          exam: true,
          assignment: true,
          student: true,
        },
      });

      // Create announcement for notification
      const defaultMessage = `Results for ${data.term} are now published. Please log in to your account to view the details.`;

      await this.announcementService.createAnnouncement({
        title: `${data.term} Results Published`,
        content: data.message || defaultMessage,
        creatorId: data.creatorId,
        creatorRole: Roles.TEACHER,
        classId: data.classId,
        targetRoles: [Roles.STUDENT, Roles.PARENT],
      });

      return results;
    });
  }

  //  might want to assign an exam to only certain students in a class (for example, makeup exams, special assessments, or accommodations)
  async notifySpecificStudent(data: {
    studentId: string;
    creatorId: string;
    term: string;
    message?: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const student = await tx.student.findUnique({
        where: { id: data.studentId },
        include: { class: true },
      });

      if (!student) {
        throw new Error('Student not found');
      }

      const defaultMessage = `Results for ${data.term} are now published. Please log in to your account to view the details.`;

      await this.announcementService.createAnnouncement({
        title: `${data.term} Results Published`,
        content: data.message || defaultMessage,
        creatorId: data.creatorId,
        creatorRole: Roles.TEACHER,
        classId: student.classId,
        targetRoles: [Roles.STUDENT, Roles.PARENT],
      });

      return await tx.result.findMany({
        where: { studentId: data.studentId },
        include: {
          exam: true,
          assignment: true,
          student: true,
        },
      });
    });
  }
}
