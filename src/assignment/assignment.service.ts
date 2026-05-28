import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAssignmentInput } from './input/create.assignment.input';
import { EditAssignmentInput } from './input/edit.assignment.input';
import { Roles } from '../shared/enum/role';
import { Server } from 'socket.io';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import {
  PaginatedResponse,
  PaginationParams,
} from '../shared/pagination/types/pagination.types';
import { PrismaQueryBuilder } from '../shared/pagination/utils/prisma.pagination';

@Injectable()
@WebSocketGateway()
export class AssignmentService {
  constructor(private readonly prisma: PrismaService) {}
  @WebSocketServer()
  private readonly server: Server;

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

  private canViewAnswers(userRole: Roles, userId: string, assignment: any) {
    if (userRole !== Roles.TEACHER) return false;
    return Boolean(assignment?.teacherId && assignment.teacherId === userId);
  }

  private sanitizeAssignmentForViewer(
    assignment: any,
    userId: string,
    userRole: Roles,
  ) {
    if (!assignment) return assignment;
    if (this.canViewAnswers(userRole, userId, assignment)) return assignment;

    if (Array.isArray(assignment.questions)) {
      assignment.questions = assignment.questions.map((question) => ({
        ...question,
        correctAnswer: null,
      }));
    }

    if (typeof assignment.content === 'string') {
      assignment.content = this.redactAssessmentContent(
        assignment.content,
      ) as string;
    }

    return assignment;
  }

  async getAllAssignments(
    userId: string,
    role: Roles,
    params: PaginationParams,
    studentId?: string,
  ): Promise<PaginatedResponse<any>> {
    try {
      let baseQuery: any = {};

      // Admin and super admin can see all assignments with full details
      if ([Roles.SUPER_ADMIN, Roles.ADMIN].includes(role)) {
        baseQuery = {
          include: {
            teacher: true,
            subject: true,
            class: true,
            submissions: true,
            questions: true,
          },
          orderBy: { createdAt: 'desc' },
        };
      }

      // Teachers can only see assignments they created
      else if (role === Roles.TEACHER) {
        baseQuery = {
          where: {
            teacherId: userId,
          },
          include: {
            teacher: true,
            subject: true,
            class: true,
            submissions: true,
            questions: true,
          },
          orderBy: { createdAt: 'desc' },
        };
      }

      // Students can only see assignments for their class
      else if (role === Roles.STUDENT) {
        const student = await this.prisma.student.findUnique({
          where: { id: userId },
          select: { classId: true },
        });

        if (!student) {
          throw new NotFoundException('Student not found');
        }

        baseQuery = {
          where: {
            classId: student.classId,
          },
          include: {
            teacher: true,
            subject: true,
            class: true,
            submissions: {
              where: {
                studentId: userId,
              },
            },
            questions: true,
          },
          orderBy: { createdAt: 'desc' },
        };
      }

      // Parents can see limited assignment information for their children
      else if (role === Roles.PARENT) {
        const children = await this.prisma.student.findMany({
          where: {
            parentId: userId,
            ...(studentId ? { id: studentId } : {}),
          },
          select: {
            id: true,
            classId: true,
          },
        });

        if (!children.length) {
          return {
            data: [],
            meta: {
              total: 0,
              page: params?.page || 1,
              lastPage: 1,
              limit: params?.limit || 10,
            },
          };
        }

        const childrenClassIds = children.map((child) => child.classId);
        const childrenIds = children.map((child) => child.id);

        baseQuery = {
          where: {
            classId: {
              in: childrenClassIds,
            },
          },
          select: {
            id: true,
            title: true,
            startDate: true,
            dueDate: true,
            class: {
              select: {
                id: true,
                name: true,
              },
            },
            subject: {
              select: {
                id: true,
                name: true,
              },
            },
            submissions: {
              where: {
                studentId: {
                  in: childrenIds,
                },
              },
              select: {
                status: true,
                submissionDate: true,
                studentId: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        };
      } else {
        throw new ForbiddenException(
          'You do not have permission to view assignments',
        );
      }

      // Define searchable fields
      const searchFields = ['title', 'description'];

      // Use the PrismaQueryBuilder to handle pagination and search
      const result = await PrismaQueryBuilder.paginateResponse(
        this.prisma.assignment,
        baseQuery,
        params,
        searchFields,
      );
      result.data = result.data.map((assignment: any) =>
        this.sanitizeAssignmentForViewer(assignment, userId, role),
      );
      return result;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      if (error instanceof ForbiddenException) throw error;
      throw new InternalServerErrorException('Failed to fetch assignments');
    }
  }

  async getAssignmentById(assignmentId: string, userId: string, role: Roles) {
    try {
      const assignment = await this.prisma.assignment.findUnique({
        where: {
          id: assignmentId,
        },
        include: {
          result: true,
          submissions: true,
          teacher: true,
          subject: true,
          class: true,
          lesson: true,
          questions: true,
        },
      });

      if (!assignment) {
        throw new NotFoundException('Assignment not found');
      }

      switch (role) {
        case Roles.SUPER_ADMIN:
        case Roles.ADMIN:
          break;

        case Roles.TEACHER: {
          if (assignment.teacherId !== userId) {
            throw new ForbiddenException(
              'Nice try — you can only view assignments you created',
            );
          }
          break;
        }

        case Roles.STUDENT: {
          const student = await this.prisma.student.findUnique({
            where: { id: userId },
            select: { classId: true },
          });

          if (!student) {
            throw new NotFoundException('Student not found');
          }

          if (assignment.classId !== student.classId) {
            throw new ForbiddenException(
              'Nice try — you do not have access to this assignment',
            );
          }

          if (Array.isArray(assignment.submissions)) {
            assignment.submissions = assignment.submissions.filter(
              (s: any) => s?.studentId === userId,
            );
          }
          break;
        }

        case Roles.PARENT: {
          const children = await this.prisma.student.findMany({
            where: { parentId: userId },
            select: { id: true, classId: true },
          });

          const childIds = children.map((c) => c.id);
          const hasAccess = children.some(
            (c) => c.classId === assignment.classId,
          );
          if (!hasAccess) {
            throw new ForbiddenException(
              'Nice try — you do not have access to this assignment',
            );
          }

          if (Array.isArray(assignment.submissions)) {
            assignment.submissions = assignment.submissions.filter((s: any) =>
              childIds.includes(s?.studentId),
            );
          }
          break;
        }

        default:
          throw new ForbiddenException(
            'You do not have permission to view assignments',
          );
      }

      return this.sanitizeAssignmentForViewer(assignment, userId, role);
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Failed to fetch assignment');
    }
  }

  async createAssignment(teacherId: string, input: CreateAssignmentInput) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Validate teacher is assigned to the class
        const teacherClass = await tx.teacher.findFirst({
          where: {
            id: teacherId,
            classes: {
              some: {
                id: input.classId,
              },
            },
          },
        });

        if (!teacherClass) {
          throw new ForbiddenException('You are not assigned to this class');
        }

        const subject = await tx.subject.findFirst({
          where: {
            id: input.subjectId,
            classId: input.classId,
          },
        });

        if (!subject) {
          throw new NotFoundException('Subject not found in this class');
        }

        // Validate lesson exists
        const lesson = await tx.lesson.findUnique({
          where: { id: input.lessonId },
          include: { subject: true },
        });

        if (!lesson) {
          throw new NotFoundException('Lesson not found');
        }

        if (lesson.subject.id !== input.subjectId) {
          throw new BadRequestException('Lesson and subject do not match');
        }

        // check for dupe
        const existingAssignment = await tx.assignment.findFirst({
          where: {
            title: input.title,
          },
        });

        if (existingAssignment) {
          throw new ConflictException(
            `Assignment with this title: ${input.title} already exists`,
          );
        }

        const startDate = new Date(input.startDate);
        const dueDate = new Date(input.dueDate);
        if (
          Number.isNaN(startDate.getTime()) ||
          Number.isNaN(dueDate.getTime())
        ) {
          throw new BadRequestException('Invalid assignment date.');
        }
        if (dueDate.getTime() < startDate.getTime()) {
          throw new BadRequestException(
            'Due date must be on or after start date.',
          );
        }
        const startDay = startDate.getDay();
        const dueDay = dueDate.getDay();
        if (startDay === 0 || startDay === 6 || dueDay === 0 || dueDay === 6) {
          throw new BadRequestException(
            'Assignments must be scheduled Monday to Friday.',
          );
        }

        const createData = {
          title: input.title,
          startDate,
          dueDate,
          description: input.description,
          instructions: input.instructions,
          content: input.content,
          lesson: {
            connect: { id: input.lessonId },
          },
          teacher: {
            connect: { id: teacherId },
          },
          subject: {
            connect: { id: input.subjectId },
          },
          class: {
            connect: { id: input.classId },
          },
        };

        // Add questions if provided
        if (input.questions && input.questions.length > 0) {
          createData['questions'] = {
            create: input.questions.map((q) => ({
              type: q.questionType,
              content: q.content,
              options: q.options,
              correctAnswer: q.correctAnswer,
              points: q.points,
            })),
          };
        }

        const newAssignment = await tx.assignment.create({
          data: createData,
          include: {
            lesson: true,
            teacher: true,
            subject: true,
            class: true,
            questions: true,
          },
        });

        this.server.emit('createAssignment', {
          message: 'A new assignment has been created!',
          assignment: newAssignment,
        });

        return newAssignment;
      });
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      if (error instanceof ForbiddenException) throw error;
      if (error instanceof NotFoundException) throw error;
      if (error instanceof ConflictException) throw error;
      console.log('error:', error);
      throw new InternalServerErrorException('Failed to create assignment');
    }
  }

  async editAssignment(
    assignmentId: string,
    userId: string,
    userRole: Roles,
    editAssignmentInput: EditAssignmentInput,
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const assignment = await tx.assignment.findUnique({
          where: {
            id: assignmentId,
          },
          include: {
            teacher: true,
            subject: true,
            class: true,
            lesson: true,
          },
        });

        if (!assignment) {
          throw new NotFoundException('Assignment not found');
        }

        // If user is a teacher, verify they are assigned to the class
        if (userRole === Roles.TEACHER) {
          const teacher = await tx.teacher.findFirst({
            where: { id: userId },
            select: { id: true },
          });

          if (!teacher) {
            throw new ForbiddenException('Teacher not found');
          }

          if (assignment.teacher?.id !== teacher.id) {
            throw new ForbiddenException(
              'You can only edit your own assignments',
            );
          }
        }

        const effectiveClassId =
          editAssignmentInput.classId ?? assignment.classId;
        const effectiveSubjectId =
          editAssignmentInput.subjectId ?? assignment.subjectId;
        const effectiveLessonId =
          editAssignmentInput.lessonId ?? assignment.lessonId;

        const startDate = editAssignmentInput.startDate
          ? new Date(editAssignmentInput.startDate)
          : assignment.startDate;
        const dueDate = editAssignmentInput.dueDate
          ? new Date(editAssignmentInput.dueDate)
          : assignment.dueDate;

        if (
          Number.isNaN(startDate.getTime()) ||
          Number.isNaN(dueDate.getTime())
        ) {
          throw new BadRequestException('Invalid assignment date.');
        }
        if (dueDate.getTime() < startDate.getTime()) {
          throw new BadRequestException(
            'Due date must be on or after start date.',
          );
        }
        const startDay = startDate.getDay();
        const dueDay = dueDate.getDay();
        if (startDay === 0 || startDay === 6 || dueDay === 0 || dueDay === 6) {
          throw new BadRequestException(
            'Assignments must be scheduled Monday to Friday.',
          );
        }

        if (userRole === Roles.TEACHER && effectiveClassId) {
          const teacherClass = await tx.teacher.findFirst({
            where: {
              id: userId,
              classes: {
                some: {
                  id: effectiveClassId,
                },
              },
            },
            select: { id: true },
          });
          if (!teacherClass) {
            throw new ForbiddenException('You are not assigned to this class');
          }
        }

        if (effectiveClassId && effectiveSubjectId) {
          const subject = await tx.subject.findFirst({
            where: {
              id: effectiveSubjectId,
              classId: effectiveClassId,
            },
            select: { id: true },
          });
          if (!subject) {
            throw new NotFoundException('Subject not found in this class');
          }
        }

        if (effectiveLessonId) {
          const lesson = await tx.lesson.findUnique({
            where: { id: effectiveLessonId },
            select: {
              id: true,
              classId: true,
              subject: { select: { id: true } },
            },
          });
          if (!lesson) {
            throw new NotFoundException('Lesson not found');
          }
          if (effectiveClassId && lesson.classId !== effectiveClassId) {
            throw new BadRequestException('Lesson not found in this class');
          }
          if (effectiveSubjectId && lesson.subject.id !== effectiveSubjectId) {
            throw new BadRequestException('Lesson and subject do not match');
          }
        }

        const editData: any = {
          title: editAssignmentInput.title,
          startDate,
          dueDate,
        };

        if (editAssignmentInput.description !== undefined) {
          editData.description = editAssignmentInput.description;
        }
        if (editAssignmentInput.instructions !== undefined) {
          editData.instructions = editAssignmentInput.instructions;
        }
        if (editAssignmentInput.content !== undefined) {
          editData.content = editAssignmentInput.content;
        }
        if (editAssignmentInput.lessonId !== undefined) {
          editData.lessonId = editAssignmentInput.lessonId;
        }
        if (editAssignmentInput.subjectId !== undefined) {
          editData.subjectId = editAssignmentInput.subjectId;
        }
        if (editAssignmentInput.classId !== undefined) {
          editData.classId = editAssignmentInput.classId;
        }

        // Update the assignment with the provided data
        return await tx.assignment.update({
          where: { id: assignmentId },
          data: editData,
          include: {
            subject: true,
            class: true,
            teacher: true,
            lesson: true,
            result: true,
            submissions: true,
          },
        });
      });
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Failed to edit assignment');
    }
  }

  async deleteAssignment(
    assignmentId: string,
    userId: string,
    userRole: Roles,
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const assignment = await tx.assignment.findUnique({
          where: {
            id: assignmentId,
          },
          include: {
            teacher: true,
            submissions: true,
          },
        });

        if (!assignment) {
          throw new NotFoundException('Assignment not found');
        }

        // If user is a teacher, verify they created the assignment
        if (userRole === Roles.TEACHER) {
          if (assignment.teacher?.id !== userId) {
            throw new ForbiddenException(
              'You can only delete your own assignments',
            );
          }
        }

        // Check if there are any submissions for this assignment
        if (assignment.submissions.length > 0) {
          throw new BadRequestException(
            'Cannot delete assignment with existing submissions',
          );
        }

        // Delete related questions first
        await tx.question.deleteMany({
          where: {
            assignmentId: assignmentId,
          },
        });

        // Delete the assignment
        await tx.assignment.delete({
          where: {
            id: assignmentId,
          },
        });

        this.server.emit('deleteAssignment', {
          message: 'An assignment has been deleted!',
          assignmentId: assignmentId,
        });

        return {
          success: true,
          message: 'Assignment successfully deleted',
        };
      });
    } catch (error) {
      throw new InternalServerErrorException('Failed to delete assignment');
    }
  }
}
