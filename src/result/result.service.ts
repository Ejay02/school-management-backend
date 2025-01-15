import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { AnnouncementService } from 'src/announcement/announcement.service';
import { Roles } from 'src/shared/enum/role';

@Injectable()
export class ResultService {
  constructor(
    private prisma: PrismaService,
    private announcementService: AnnouncementService,
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

  async updateResult(
    id: string,
    data: {
      score?: number;
      examId?: string;
      assignmentId?: string;
    },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const result = await tx.result.update({
        where: { id },
        data,
        include: {
          exam: true,
          assignment: true,
          student: true,
        },
      });
      return result;
    });
  }

  async deleteResult(id: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.result.delete({
        where: { id },
      });
      return true;
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

  async getClassResults(classId: string) {
    return this.prisma.$transaction(async (tx) => {
      const results = await tx.result.findMany({
        where: {
          OR: [{ exam: { classId } }, { assignment: { classId } }],
        },
        include: {
          exam: true,
          assignment: true,
          student: true,
        },
      });
      return results;
    });
  }

  async getResultStatistics(classId: string) {
    return this.prisma.$transaction(async (tx) => {
      const results = await tx.result.findMany({
        where: {
          OR: [{ exam: { classId } }, { assignment: { classId } }],
        },
      });

      const scores = results.map((r) => r.score);
      const average = scores.reduce((a, b) => a + b, 0) / scores.length;
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
          below60: scores.filter((s) => s < 60).length,
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
