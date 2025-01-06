import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateAssignmentInput } from './input/create.assignment.input';
import { EditAssignmentInput } from './input/edit.assignment.input';
import { Roles } from 'src/shared/enum/role';

@Injectable()
export class AssignmentService {
  constructor(private prisma: PrismaService) {}

  async getAllAssignments() {
    try {
      return await this.prisma.assignment.findMany({
        include: {
          teacher: true,
          subject: true,
          class: true,
        },
      });
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      throw new InternalServerErrorException('Failed to fetch assignments');
    }
  }

  async getAssignmentById(assignmentId: string) {
    try {
      return await this.prisma.assignment.findUnique({
        where: {
          id: assignmentId,
        },
        include: {
          results: true,
          submissions: true,
        },
      });
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      throw new InternalServerErrorException('Failed to fetch assignment');
    }
  }

  async createAssignment(teacherId: string, input: CreateAssignmentInput) {
    try {
      const subject = await this.prisma.subject.findFirst({
        where: {
          id: input.subjectId,
          classId: input.classId,
        },
      });

      if (!subject) {
        throw new NotFoundException('Subject not found in this class');
      }

      // check for dupe
      const existintAssignment = await this.prisma.assignment.findFirst({
        where: {
          title: input.title,
        },
      });

      if (existintAssignment) {
        throw new ConflictException(
          `Assignment with this title: ${input.title} already exists`,
        );
      }

      return await this.prisma.assignment.create({
        data: {
          title: input.title,
          startDate: new Date(input.startDate),
          dueDate: new Date(input.dueDate),
          lessonId: input.lessonId,
          teacherId,
          subjectId: input.subjectId,
          classId: input.classId,
        },
      });
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
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
      const assignment = await this.prisma.assignment.findUnique({
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
        const teacher = await this.prisma.teacher.findFirst({
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

      const editData: any = {
        title: editAssignmentInput.title,
        startDate: new Date(editAssignmentInput.startDate),
        dueDate: new Date(editAssignmentInput.dueDate),
        lessonId: editAssignmentInput.lessonId,
        subjectId: editAssignmentInput.subjectId,
        classId: editAssignmentInput.classId,
      };

      return this.prisma.assignment.update({
        where: { id: assignmentId },
        data: editData,
        include: {
          subject: true,
          class: true,
          teacher: true,
          lesson: true,
          results: true,
          submissions: true,
        },
      });
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      throw new InternalServerErrorException('Failed to edit assignment');
    }
  }
}
