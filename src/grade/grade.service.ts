import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateGradeInput } from './input/create.grade.input';
import { GradeType } from './enum/gradeType';
import { UpdateGradeInput } from './input/update.grade.input';

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
    // params: PaginationParams,
  ) {
    return this.prisma.grade.findMany({
      where: {
        studentId,
        ...(academicPeriod && { academicPeriod }),
      },
      include: {
        exam: true,
        assignment: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Retrieve a list of all grades assigned to students in a specific class
  async getClassGrades(classId: string, academicPeriod?: string) {
    return this.prisma.grade.findMany({
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
      orderBy: [{ student: { surname: 'asc' } }, { createdAt: 'desc' }],
    });
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

    return this.prisma.grade.create({
      data: {
        studentId,
        score: averageScore,
        type: GradeType.OVERALL,
        academicPeriod,
        comments: 'Overall grade calculated from exams and assignments',
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
  async deleteGrade(adminId: string, gradeId: string) {
    // Verify admin role is handled by guard
    return this.prisma.grade.delete({
      where: { id: gradeId },
    });
  }
}
