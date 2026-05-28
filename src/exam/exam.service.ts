import {
  BadRequestException,
  ConflictException,
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
import {
  AssignExamToStudentInput,
  CompleteExamInput,
  CompleteExamWithAnswersInput,
  StartExamInput,
} from './input/student-exam.input';

@Injectable()
export class ExamService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly schoolStartMinutes = 9 * 60;
  private readonly schoolEndMinutes = 14 * 60;
  private readonly breakStartMinutes = 12 * 60;
  private readonly breakEndMinutes = 13 * 60;

  private redactAssessmentContent(content: unknown): unknown {
    if (typeof content !== 'string' || !content.trim().length) return content;
    try {
      const parsed = JSON.parse(content) as any;
      const questions = Array.isArray(parsed?.questions)
        ? parsed.questions
        : [];
      const safeQuestions = questions.map((q: any) => {
        if (!q || typeof q !== 'object') return q;
        const { correctAnswer, ...rest } = q;
        return rest;
      });
      return JSON.stringify({ ...parsed, questions: safeQuestions });
    } catch {
      return content;
    }
  }

  private canViewAnswers(userRole: Roles, userId: string, exam: any): boolean {
    if (userRole !== Roles.TEACHER) return false;
    return Boolean(exam?.teacherId && exam.teacherId === userId);
  }

  private sanitizeExamForViewer(exam: any, userId: string, userRole: Roles) {
    if (!exam) return exam;
    if (this.canViewAnswers(userRole, userId, exam)) return exam;

    if (Array.isArray(exam.questions)) {
      exam.questions = exam.questions.map((question) => ({
        ...question,
        correctAnswer: null,
      }));
    }

    if (typeof exam.content === 'string') {
      exam.content = this.redactAssessmentContent(exam.content) as string;
    }

    return exam;
  }

  private getWeekdayIndex(date: Date): number {
    return date.getDay();
  }

  private toMinutesOfDay(date: Date): number {
    return date.getHours() * 60 + date.getMinutes();
  }

  private ensureExamWithinSchoolHours(
    date: Date,
    startTime: Date,
    endTime: Date,
  ) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
      throw new BadRequestException('Invalid exam date.');
    }
    if (!(startTime instanceof Date) || Number.isNaN(startTime.getTime())) {
      throw new BadRequestException('Invalid exam start time.');
    }
    if (!(endTime instanceof Date) || Number.isNaN(endTime.getTime())) {
      throw new BadRequestException('Invalid exam end time.');
    }

    const weekday = this.getWeekdayIndex(date);
    if (weekday === 0 || weekday === 6) {
      throw new BadRequestException(
        'Exams can only be scheduled Monday to Friday.',
      );
    }

    const startMinutes = this.toMinutesOfDay(startTime);
    const endMinutes = this.toMinutesOfDay(endTime);

    if (endMinutes <= startMinutes) {
      throw new BadRequestException('End time must be after start time.');
    }

    if (
      startMinutes < this.schoolStartMinutes ||
      endMinutes > this.schoolEndMinutes
    ) {
      throw new BadRequestException(
        'Exams must be within school hours (Mon-Fri, 9:00am to 2:00pm).',
      );
    }

    if (
      this.timeRangesOverlap(
        startMinutes,
        endMinutes,
        this.breakStartMinutes,
        this.breakEndMinutes,
      )
    ) {
      throw new BadRequestException(
        'Exams cannot be scheduled during break time (12:00pm to 1:00pm).',
      );
    }

    return { startMinutes, endMinutes };
  }

  private timeRangesOverlap(
    aStart: number,
    aEnd: number,
    bStart: number,
    bEnd: number,
  ) {
    return aStart < bEnd && bStart < aEnd;
  }

  private getDateBounds(date: Date) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start, end };
  }

  private async ensureNoExamClash(
    tx: any,
    classId: string,
    teacherId: string,
    date: Date,
    startMinutes: number,
    endMinutes: number,
    excludeExamId?: string,
  ) {
    const bounds = this.getDateBounds(date);
    const whereForClass: any = {
      classId,
      date: { gte: bounds.start, lt: bounds.end },
    };
    if (excludeExamId) whereForClass.id = { not: excludeExamId };

    const classExams = await tx.exam.findMany({
      where: whereForClass,
      select: { id: true, startTime: true, endTime: true },
    });

    for (const exam of classExams) {
      const s = this.toMinutesOfDay(new Date(exam.startTime));
      const e = this.toMinutesOfDay(new Date(exam.endTime));
      if (this.timeRangesOverlap(startMinutes, endMinutes, s, e)) {
        throw new ConflictException(
          'This time conflicts with an existing exam for the class.',
        );
      }
    }

    const whereForTeacher: any = {
      teacherId,
      date: { gte: bounds.start, lt: bounds.end },
    };
    if (excludeExamId) whereForTeacher.id = { not: excludeExamId };

    const teacherExams = await tx.exam.findMany({
      where: whereForTeacher,
      select: { id: true, startTime: true, endTime: true },
    });

    for (const exam of teacherExams) {
      const s = this.toMinutesOfDay(new Date(exam.startTime));
      const e = this.toMinutesOfDay(new Date(exam.endTime));
      if (this.timeRangesOverlap(startMinutes, endMinutes, s, e)) {
        throw new ConflictException(
          'This time conflicts with another exam in your schedule.',
        );
      }
    }
  }

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

      const schedule = this.ensureExamWithinSchoolHours(
        input.date,
        input.startTime,
        input.endTime,
      );

      await this.ensureNoExamClash(
        tx,
        input.classId,
        teacherId,
        input.date,
        schedule.startMinutes,
        schedule.endMinutes,
      );

      // Create the exam within the transaction
      const exam = await tx.exam.create({
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

      // Get all students in the class
      const students = await tx.student.findMany({
        where: {
          classId: input.classId,
        },
      });

      // Create StudentExam records for each student in the class
      if (students.length > 0) {
        await tx.studentExam.createMany({
          data: students.map((student) => ({
            studentId: student.id,
            examId: exam.id,
            hasTaken: false,
          })),
          skipDuplicates: true, // Skip if a student is already assigned to this exam
        });
      }

      return exam;
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

      const effectiveClassId = input.classId || exam.classId;
      const effectiveDate = input.date || exam.date;
      const effectiveStartTime = input.startTime || exam.startTime;
      const effectiveEndTime = input.endTime || exam.endTime;

      const schedule = this.ensureExamWithinSchoolHours(
        effectiveDate,
        effectiveStartTime,
        effectiveEndTime,
      );

      await this.ensureNoExamClash(
        tx,
        effectiveClassId,
        teacherId,
        effectiveDate,
        schedule.startMinutes,
        schedule.endMinutes,
        examId,
      );

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
          //
          class: input.classId ? { connect: { id: input.classId } } : undefined,
          subject: input.subjectId
            ? { connect: { id: input.subjectId } }
            : undefined,
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
          result: {
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

      const result = await PrismaQueryBuilder.paginateResponse(
        this.prisma.exam,
        baseQuery,
        params,
        searchFields,
      );
      result.data = result.data.map((exam: any) =>
        this.sanitizeExamForViewer(exam, userId, userRole),
      );
      return result;
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

    return result.data.map((exam: any) =>
      this.sanitizeExamForViewer(exam, userId, userRole),
    );
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
      case Roles.TEACHER: {
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
      }

      case Roles.STUDENT: {
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
      }

      case Roles.PARENT: {
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
    }

    return this.sanitizeExamForViewer(exam, userId, userRole);
  }

  async startExam(input: StartExamInput, userId: string, userRole: Roles) {
    // Ensure the student can only start their own exam
    if (userRole === Roles.STUDENT && userId !== input.studentId) {
      throw new ForbiddenException('You can only start your own exams');
    }

    // Check if the student-exam assignment exists
    const studentExam = await this.prisma.studentExam.findUnique({
      where: {
        studentId_examId: {
          studentId: input.studentId,
          examId: input.examId,
        },
      },
    });

    if (!studentExam) {
      throw new NotFoundException('Student is not assigned to this exam');
    }

    // Check if the exam has already been started
    if (studentExam.startedAt) {
      throw new ForbiddenException('Exam has already been started');
    }

    // Update the student-exam record to mark it as started
    const updated = await this.prisma.studentExam.update({
      where: {
        id: studentExam.id,
      },
      data: {
        startedAt: new Date(),
        hasTaken: true,
      },
      include: {
        student: true,
        exam: true,
      },
    });
    if (updated?.exam) {
      updated.exam = this.sanitizeExamForViewer(updated.exam, userId, userRole);
    }
    return updated;
  }

  async completeExam(
    input: CompleteExamInput | CompleteExamWithAnswersInput,
    userId: string,
    userRole: Roles,
  ) {
    // Ensure the student can only complete their own exam
    if (userRole === Roles.STUDENT && userId !== input.studentId) {
      throw new ForbiddenException('You can only complete your own exams');
    }

    // Check if the student-exam assignment exists
    const studentExam = await this.prisma.studentExam.findUnique({
      where: {
        studentId_examId: {
          studentId: input.studentId,
          examId: input.examId,
        },
      },
    });

    if (!studentExam) {
      throw new NotFoundException('Student is not assigned to this exam');
    }

    // Check if the exam has been started
    if (!studentExam.startedAt) {
      throw new ForbiddenException('Exam has not been started yet');
    }

    // Check if the exam has already been completed
    if (studentExam.completedAt) {
      throw new ForbiddenException('Exam has already been completed');
    }

    if ('answers' in input) {
      return this.completeExamWithAnswers(input, userId, userRole);
    }

    // Update the student-exam record to mark it as completed
    return this.prisma.$transaction(async (tx) => {
      // Update the student-exam record to mark it as completed
      const updatedStudentExam = await tx.studentExam.update({
        where: {
          id: studentExam.id,
        },
        data: {
          completedAt: new Date(),
          hasTaken: true,
        },
        include: {
          student: true,
          exam: true,
        },
      });
      // If input.score is provided, generate a result record

      if (input.score !== undefined) {
        await tx.result.create({
          data: {
            score: input.score,
            examId: input.examId,
            studentId: input.studentId,
          },
        });
      }

      if (updatedStudentExam?.exam) {
        updatedStudentExam.exam = this.sanitizeExamForViewer(
          updatedStudentExam.exam,
          userId,
          userRole,
        );
      }
      return updatedStudentExam;
    });
  }

  async getStudentExams(
    studentId: string | undefined,
    userId: string,
    userRole: Roles,
  ) {
    // If no studentId is provided and the user is a student, use their own ID
    const targetStudentId =
      studentId || (userRole === Roles.STUDENT ? userId : null);

    if (!targetStudentId) {
      throw new ForbiddenException('Student ID is required');
    }

    // Ensure students can only view their own exams
    if (userRole === Roles.STUDENT && userId !== targetStudentId) {
      throw new ForbiddenException('You can only view your own exams');
    }

    // Check if the student exists
    const student = await this.prisma.student.findUnique({
      where: { id: targetStudentId },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    // Get all exams assigned to the student
    const rows = await this.prisma.studentExam.findMany({
      where: {
        studentId: targetStudentId,
      },
      include: {
        exam: {
          include: {
            subject: true,
            teacher: true,
          },
        },
      },
    });
    return rows.map((row: any) => {
      if (row?.exam) {
        row.exam = this.sanitizeExamForViewer(row.exam, userId, userRole);
      }
      return row;
    });
  }

  private async completeExamWithAnswers(
    input: CompleteExamWithAnswersInput,
    userId: string,
    userRole: Roles,
  ) {
    // Ensure the student can only complete their own exam
    if (userRole === Roles.STUDENT && userId !== input.studentId) {
      throw new ForbiddenException('You can only complete your own exams');
    }

    // Check if the student-exam assignment exists
    const studentExam = await this.prisma.studentExam.findUnique({
      where: {
        studentId_examId: {
          studentId: input.studentId,
          examId: input.examId,
        },
      },
    });

    if (!studentExam) {
      throw new NotFoundException('Student is not assigned to this exam');
    }

    // Check if the exam has been started
    if (!studentExam.startedAt) {
      throw new ForbiddenException('Exam has not been started yet');
    }

    // Check if the exam has already been completed
    if (studentExam.completedAt) {
      throw new ForbiddenException('Exam has already been completed');
    }

    return this.prisma.$transaction(async (tx) => {
      // Get the exam with questions
      const exam = await tx.exam.findUnique({
        where: { id: input.examId },
        include: { questions: true },
      });

      if (!exam) {
        throw new NotFoundException('Exam not found');
      }

      // Calculate score based on answers
      let totalPoints = 0;
      let earnedPoints = 0;

      // Create a map of question IDs to answers for quick lookup
      const answerMap = new Map(
        input.answers.map((a) => [a.questionId, a.answer]),
      );

      // Check each question
      for (const question of exam.questions) {
        totalPoints += question.points;

        const studentAnswer = answerMap.get(question.id);
        if (studentAnswer && studentAnswer === question.correctAnswer) {
          earnedPoints += question.points;
        }
      }

      // Calculate percentage score (0-100)
      const score = totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0;

      // Update the student-exam record to mark it as completed
      const updatedStudentExam = await tx.studentExam.update({
        where: {
          id: studentExam.id,
        },
        data: {
          completedAt: new Date(),
          hasTaken: true,
        },
        include: {
          student: true,
          exam: true,
        },
      });

      // Create a result record with the calculated score
      await tx.result.create({
        data: {
          score,
          examId: input.examId,
          studentId: input.studentId,
        },
      });

      if (updatedStudentExam?.exam) {
        updatedStudentExam.exam = this.sanitizeExamForViewer(
          updatedStudentExam.exam,
          userId,
          userRole,
        );
      }
      return updatedStudentExam;
    });
  }

  //  might want to assign an exam to only certain students in a class (for example, makeup exams, special assessments, or accommodations)
  async assignExamToStudent(input: AssignExamToStudentInput) {
    // Check if the exam exists
    const exam = await this.prisma.exam.findUnique({
      where: { id: input.examId },
    });

    if (!exam) {
      throw new NotFoundException('Exam not found');
    }

    // Check if the student exists
    const student = await this.prisma.student.findUnique({
      where: { id: input.studentId },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    // Check if the student is in the class for which the exam is scheduled
    if (student.classId !== exam.classId) {
      throw new ForbiddenException('Student is not in the class for this exam');
    }

    // Check if the student is already assigned to this exam
    const existingAssignment = await this.prisma.studentExam.findUnique({
      where: {
        studentId_examId: {
          studentId: input.studentId,
          examId: input.examId,
        },
      },
    });

    if (existingAssignment) {
      throw new ForbiddenException('Student is already assigned to this exam');
    }

    // Create the student-exam assignment
    return this.prisma.studentExam.create({
      data: {
        studentId: input.studentId,
        examId: input.examId,
        hasTaken: false,
      },
      include: {
        student: true,
        exam: true,
      },
    });
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
