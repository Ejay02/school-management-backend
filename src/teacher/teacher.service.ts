import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../prisma/prisma.service';
import { Roles } from '../shared/enum/role';
import { UpdateProfileInput } from '../shared/inputs/profile-update.input';
import { PaginationParams } from '../shared/pagination/types/pagination.types';
import { PrismaQueryBuilder } from '../shared/pagination/utils/prisma.pagination';
import { CloudinaryService } from '../shared/cloudinary/services/cloudinary.service';
import { Term } from '../payment/enum/term';

@Injectable()
export class TeacherService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  async getAllTeachers(
    userId: string,
    userRole: Roles,
    params: PaginationParams,
  ) {
    try {
      // Base fields to include in the response
      const baseInclude = {
        subjects: true,
        classes: true,
        // grade: true,
      };

      const baseQuery: any = {
        include: baseInclude,
        orderBy: { createdAt: 'desc' },
      };

      // Handle pagination and search
      const searchFields = ['name', 'email', 'username'];

      return await PrismaQueryBuilder.paginateResponse(
        this.prisma.teacher,
        baseQuery,
        params,
        searchFields,
      );
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      if (error instanceof ForbiddenException) throw error;
      throw new InternalServerErrorException('Failed to fetch teachers');
    }
  }

  async getTeacherById(userId: string, teacherId: string) {
    try {
      // First, get the requesting user's role and id
      const requestingUser = await this.prisma.admin.findUnique({
        where: { id: userId },
      });

      const requestingTeacher = await this.prisma.teacher.findUnique({
        where: { id: userId },
      });

      // Check if the requesting user is either an admin or the teacher themselves
      if (
        !requestingUser &&
        (!requestingTeacher || requestingTeacher.id !== teacherId)
      ) {
        throw new ForbiddenException(
          "You do not have permission to view this teacher's details",
        );
      }

      const teacher = await this.prisma.teacher.findUnique({
        where: { id: teacherId },
        include: {
          exams: true,
          subjects: true,
          lessons: true,
          classes: true,
          assignments: true,
        },
      });

      if (!teacher) {
        throw new NotFoundException(`Teacher with ID ${teacherId} not found`);
      }

      return teacher;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new Error(`Failed to get teacher: ${error.message}`);
    }
  }

  async getTeacherTodayOverview(teacherId: string) {
    const now = new Date();
    const dayIndex = now.getDay();
    const dayMap: Record<number, string> = {
      1: 'Monday',
      2: 'Tuesday',
      3: 'Wednesday',
      4: 'Thursday',
      5: 'Friday',
    };

    const today = dayMap[dayIndex];

    const parseMinutes = (value: string) => {
      const [h, m] = String(value || '').split(':');
      const hours = Number(h);
      const minutes = Number(m);
      if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
      return hours * 60 + minutes;
    };

    const lessonsToday = await this.prisma.lesson.findMany({
      where: {
        teacherId,
        ...(today ? { day: today } : { id: '__no_lessons__' }),
      },
      include: {
        class: { select: { name: true } },
        subject: { select: { name: true } },
      },
      orderBy: { startTime: 'asc' },
    });

    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const upcoming = lessonsToday
      .map((lesson) => {
        const startMinutes = parseMinutes(lesson.startTime);
        return { lesson, startMinutes };
      })
      .filter((item) => item.startMinutes !== null)
      .filter((item) => (item.startMinutes as number) >= nowMinutes)
      .slice(0, 3)
      .map(({ lesson }) => ({
        id: lesson.id,
        name: lesson.name,
        className: lesson.class?.name ?? null,
        subjectName: lesson.subject?.name ?? null,
        startTime: lesson.startTime,
        endTime: lesson.endTime,
      }));

    const lessonIds = lessonsToday.map((l) => l.id).filter(Boolean);
    let attendanceDueCount = 0;
    if (lessonIds.length) {
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);

      const markedLessons = await this.prisma.attendance.findMany({
        where: {
          lessonId: { in: lessonIds },
          date: { gte: startOfDay, lte: endOfDay },
        },
        distinct: ['lessonId'],
        select: { lessonId: true },
      });

      attendanceDueCount = Math.max(0, lessonIds.length - markedLessons.length);
    }

    const assignmentsToGradeCount = await this.prisma.submission.count({
      where: {
        status: 'SUBMITTED',
        assignment: {
          teacherId,
        },
      },
    });

    const setupState = await this.prisma.setupState.upsert({
      where: { id: 'default' },
      update: {},
      create: { id: 'default' },
      select: {
        academicYearCurrent: true,
        academicYearNext: true,
        currentTerm: true,
      },
    });

    const supervisorAcademicPeriod =
      setupState.academicYearCurrent && setupState.academicYearNext
        ? `${setupState.academicYearCurrent}/${setupState.academicYearNext}`
        : null;
    const supervisorCurrentTerm = setupState.currentTerm
      ? (setupState.currentTerm as unknown as Term)
      : null;

    let supervisorRemarkTasks: Array<{
      studentId: string;
      studentName: string;
      studentCode?: string | null;
      classId: string;
      className: string;
      academicPeriod: string;
      term: Term;
      completed: boolean;
      locked: boolean;
      remark?: string | null;
      updatedAt?: Date | null;
    }> = [];

    if (supervisorAcademicPeriod && supervisorCurrentTerm) {
      const supervisedClasses = await this.prisma.class.findMany({
        where: {
          supervisorId: teacherId,
        },
        select: {
          id: true,
          name: true,
          students: {
            select: {
              id: true,
              name: true,
              surname: true,
              studentId: true,
            },
            orderBy: [{ name: 'asc' }, { surname: 'asc' }],
          },
        },
        orderBy: { name: 'asc' },
      });

      const classIds = supervisedClasses.map((entry) => entry.id);
      const existingRemarks = classIds.length
        ? await this.prisma.termReportRemark.findMany({
            where: {
              classId: { in: classIds },
              academicPeriod: supervisorAcademicPeriod,
              term: supervisorCurrentTerm,
            },
            select: {
              studentId: true,
              remark: true,
              status: true,
              updatedAt: true,
            },
          })
        : [];

      const remarksByStudentId = new Map(
        existingRemarks.map((entry) => [entry.studentId, entry]),
      );

      supervisorRemarkTasks = supervisedClasses.flatMap((classItem) =>
        classItem.students.map((student) => {
          const existingRemark = remarksByStudentId.get(student.id);
          const remarkText = String(existingRemark?.remark || '').trim();

          return {
            studentId: student.id,
            studentName: [student.name, student.surname]
              .filter(Boolean)
              .join(' '),
            studentCode: student.studentId ?? null,
            classId: classItem.id,
            className: classItem.name,
            academicPeriod: supervisorAcademicPeriod,
            term: supervisorCurrentTerm,
            completed: remarkText.length >= 2,
            locked: existingRemark?.status === 'PUBLISHED',
            remark: remarkText || null,
            updatedAt: existingRemark?.updatedAt ?? null,
          };
        }),
      );
    }

    const supervisorRemarkPendingCount = supervisorRemarkTasks.filter(
      (task) => !task.completed,
    ).length;
    const supervisorRemarkCompletedCount = supervisorRemarkTasks.filter(
      (task) => task.completed,
    ).length;

    return {
      nextClasses: upcoming,
      attendanceDueCount,
      assignmentsToGradeCount,
      supervisorAcademicPeriod,
      supervisorCurrentTerm,
      supervisorRemarkPendingCount,
      supervisorRemarkCompletedCount,
      supervisorRemarkTasks,
    };
  }

  async updateTeacherProfile(
    id: string,
    input: UpdateProfileInput,
    file?: Express.Multer.File,
  ) {
    try {
      // Upload image if provided
      let imageUrl = input.image;
      if (file) {
        // Get the current teacher to check if they have an existing image
        const teacher = await this.prisma.teacher.findUnique({
          where: { id },
          select: { image: true },
        });

        // Delete old image if exists
        if (teacher?.image) {
          try {
            const publicId = this.cloudinaryService.getPublicIdFromUrl(
              teacher.image,
            );
            await this.cloudinaryService.deleteImage(publicId);
          } catch (error) {
            console.error('Failed to delete old image:', error);
            // Continue with upload even if delete fails
          }
        }

        // Upload new image
        imageUrl = await this.cloudinaryService.uploadImage(
          file,
          'teacher-profiles',
        );
      }

      // Hash password if provided
      let passwordData = {};
      if (input.password) {
        const hashedPassword = await bcrypt.hash(input.password, 10);
        passwordData = { password: hashedPassword };
      }

      // Update teacher profile
      return this.prisma.teacher.update({
        where: { id },
        data: {
          ...input,
          ...passwordData,
          image: imageUrl,
        },
      });
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to update teacher profile: ${error.message}`,
      );
    }
  }
}
