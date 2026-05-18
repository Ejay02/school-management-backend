import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Roles } from '../shared/enum/role';
import { MarkAttendanceInput } from './input/attendance.input';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import * as jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import type { Prisma } from '@prisma/client';

import { Attendance } from './types/attendance.types';

@Injectable()
@WebSocketGateway()
export class AttendanceService {
  @WebSocketServer()
  private readonly server: Server;

  constructor(private readonly prisma: PrismaService) {}

  private isAttendanceSessionPayload(
    value: unknown,
  ): value is { typ: 'attendance_session'; lessonId: unknown; date: unknown } {
    if (!value || typeof value !== 'object') return false;
    const record = value as Record<string, unknown>;
    return (
      record.typ === 'attendance_session' &&
      'lessonId' in record &&
      'date' in record
    );
  }

  async createAttendanceSession(
    lessonId: string,
    date: Date,
    userId: string,
    userRole: Roles,
  ) {
    if (userRole !== Roles.TEACHER) {
      throw new ForbiddenException(
        'Only teachers can start attendance sessions',
      );
    }

    const lesson = await this.prisma.lesson.findFirst({
      where: {
        id: lessonId,
        teacherId: userId,
      },
      select: { id: true },
    });

    if (!lesson) {
      throw new ForbiddenException('Unauthorized');
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new InternalServerErrorException('JWT secret is not configured');
    }

    const dateKey = new Date(date).toISOString().slice(0, 10);
    const ttlSeconds = 30;
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

    const token = jwt.sign(
      {
        typ: 'attendance_session',
        lessonId,
        date: dateKey,
        teacherId: userId,
        jti: uuidv4(),
      },
      secret,
      { expiresIn: ttlSeconds },
    );

    return {
      token,
      expiresAt,
      qrPayload: `school:v1:attendance_session:${token}`,
    };
  }

  async checkInAttendance(token: string, userId: string, userRole: Roles) {
    if (userRole !== Roles.STUDENT) {
      throw new ForbiddenException('Only students can check in attendance');
    }

    const rawToken = String(token || '')
      .trim()
      .startsWith('school:v1:attendance_session:')
      ? String(token || '')
          .trim()
          .replace('school:v1:attendance_session:', '')
          .trim()
      : String(token || '').trim();

    if (!rawToken) {
      throw new ForbiddenException('Invalid session token');
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new InternalServerErrorException('JWT secret is not configured');
    }

    let payload: unknown;
    try {
      payload = jwt.verify(rawToken, secret);
    } catch {
      throw new ForbiddenException('Invalid or expired session token');
    }

    if (!this.isAttendanceSessionPayload(payload)) {
      throw new ForbiddenException('Invalid session token');
    }

    const lessonId = String(payload.lessonId || '').trim();
    const dateKey = String(payload.date || '').trim();
    if (!lessonId || !dateKey) {
      throw new ForbiddenException('Invalid session token');
    }

    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { id: true, classId: true },
    });

    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }

    const student = await this.prisma.student.findFirst({
      where: { id: userId, classId: lesson.classId },
      select: { id: true },
    });

    if (!student) {
      throw new ForbiddenException('Unauthorized');
    }

    const attendance = await this.prisma.attendance.upsert({
      where: {
        lessonId_studentId_date: {
          lessonId,
          studentId: userId,
          date: new Date(dateKey),
        },
      },
      update: {
        present: true,
      },
      create: {
        lessonId,
        studentId: userId,
        date: new Date(dateKey),
        present: true,
        classId: lesson.classId,
      },
      include: {
        student: true,
        lesson: true,
        class: true,
      },
    });

    this.server.emit('markAttendance', {
      message: 'Attendance has been marked!',
      attendance: [attendance],
    });

    return attendance as unknown as Attendance;
  }

  async getAttendances(
    userId: string,
    userRole: Roles,
    studentId?: string,
    searchQuery?: string,
  ): Promise<Attendance[]> {
    try {
      // Always include these relations to match the GraphQL type
      const queryOptions: Prisma.AttendanceFindManyArgs = {
        include: {
          student: true,
          class: true,
          lesson: {
            include: {
              subject: true,
              class: true,
            },
          },
        },
        where: {},
        orderBy: { createdAt: 'desc' },
      };

      // Apply role-based filters
      switch (userRole) {
        case Roles.ADMIN:
        case Roles.SUPER_ADMIN:
          // Admin and super admin can see all attendances
          break;

        case Roles.TEACHER:
          const teacherClasses = await this.prisma.teacher.findUnique({
            where: { id: userId },
            select: { classes: { select: { id: true } } },
          });

          // Check if teacher exists and has classes
          if (!teacherClasses || teacherClasses.classes.length === 0) {
            return []; // Return empty array if teacher has no classes
          }

          const classIds = teacherClasses.classes.map((c) => c.id);

          queryOptions.where = {
            lesson: {
              classId: { in: classIds },
            },
          };
          break;

        case Roles.STUDENT:
          queryOptions.where = {
            studentId: userId,
          };
          break;

        case Roles.PARENT:
          const parent = await this.prisma.parent.findUnique({
            where: { id: userId },
            include: { students: { select: { id: true } } },
          });

          // Check if parent exists and has students
          if (!parent?.students || parent.students.length === 0) {
            return []; // Return empty array if parent has no students
          }

          const studentIds = parent.students.map((s) => s.id);
          const scopedStudentIds = studentId
            ? studentIds.filter((id) => id === studentId)
            : studentIds;

          if (!scopedStudentIds.length) {
            return [];
          }

          queryOptions.where = {
            studentId: { in: scopedStudentIds },
          };
          break;

        default:
          throw new ForbiddenException('Invalid role');
      }

      // Add search functionality
      if (searchQuery && searchQuery.trim() !== '') {
        const searchTerm = searchQuery.trim();

        // Create search conditions
        const searchConditions: Prisma.AttendanceWhereInput = {
          OR: [
            {
              student: {
                name: {
                  contains: searchTerm,
                  mode: 'insensitive',
                },
              },
            },
            {
              lesson: {
                subject: {
                  name: {
                    contains: searchTerm,
                    mode: 'insensitive',
                  },
                },
              },
            },
          ],
        };

        queryOptions.where = {
          AND: [queryOptions.where ?? {}, searchConditions],
        };
      }

      // Execute the query with complete includes
      const attendances = await this.prisma.attendance.findMany(queryOptions);

      // Explicitly check that each attendance has the required relations
      // This ensures type safety
      return attendances.map((attendance) => {
        if (!attendance.studentId || !attendance.lessonId) {
          throw new Error(
            `Attendance with ID ${attendance.id} is missing required relations`,
          );
        }
        return attendance as Attendance;
      });
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      throw new InternalServerErrorException('Failed to fetch attendances');
    }
  }

  async getAttendanceByLesson(
    lessonId: string,
    userId: string,
    userRole: Roles,
  ) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { class: true },
    });

    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }

    // Verify access rights
    if (userRole === Roles.TEACHER) {
      const hasAccess = await this.prisma.teacher.findFirst({
        where: {
          id: userId,
          classes: { some: { id: lesson.classId } },
        },
      });
      if (!hasAccess) throw new ForbiddenException('Unauthorized');
    }

    return this.prisma.attendance.findMany({
      where: { lessonId },
      include: {
        student: true,
        lesson: {
          include: {
            subject: true,
            class: true,
          },
        },
      },
    });
  }

  // Mark attendance for students
  async markAttendance(
    lessonId: string,
    attendanceData: MarkAttendanceInput[],
    userId: string,
    userRole: Roles,
  ) {
    // Verify teacher has access to this lesson
    if (userRole !== Roles.TEACHER) {
      throw new ForbiddenException('Only teachers can mark attendance');
    }

    if (userRole === Roles.TEACHER) {
      const hasAccess = await this.prisma.lesson.findFirst({
        where: {
          id: lessonId,
          teacherId: userId,
        },
      });
      if (!hasAccess) throw new ForbiddenException('Unauthorized');
    }

    // Get the classId from the lesson
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { classId: true },
    });

    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }

    const studentIds = Array.from(
      new Set(attendanceData.map((data) => data.studentId).filter(Boolean)),
    );

    if (studentIds.length === 0) {
      return [];
    }

    const validStudents = await this.prisma.student.findMany({
      where: {
        id: { in: studentIds },
        classId: lesson.classId,
      },
      select: { id: true },
    });

    const validStudentIdSet = new Set(validStudents.map((s) => s.id));
    const invalidStudentIds = studentIds.filter(
      (id) => !validStudentIdSet.has(id),
    );

    if (invalidStudentIds.length) {
      throw new ForbiddenException(
        'One or more students are not in this class',
      );
    }

    // Create attendance records
    const attendanceRecords = await Promise.all(
      attendanceData.map(async (data) => {
        return this.prisma.attendance.upsert({
          where: {
            lessonId_studentId_date: {
              lessonId,
              studentId: data.studentId,
              date: data.date,
            },
          },
          update: {
            present: data.present,
          },
          create: {
            lessonId,
            studentId: data.studentId,
            date: data.date,
            present: data.present,
            classId: lesson.classId,
          },
          include: {
            student: true,
            lesson: true,
            class: true,
          },
        });
      }),
    );

    // Emit socket event to notify clients
    this.server.emit('markAttendance', {
      message: 'Attendance has been marked!',
      attendance: attendanceRecords,
    });

    return attendanceRecords;
  }

  // Get attendance statistics
  async getAttendanceStats(
    studentId: string,
    startDate: Date,
    endDate: Date,
    userId: string,
    userRole: Roles,
  ) {
    // Verify access rights
    if (userRole === Roles.STUDENT && userId !== studentId) {
      throw new ForbiddenException('Unauthorized');
    }

    if (userRole === Roles.PARENT) {
      const hasAccess = await this.prisma.parent.findFirst({
        where: {
          id: userId,
          students: { some: { id: studentId } },
        },
      });
      if (!hasAccess) throw new ForbiddenException('Unauthorized');
    }

    const attendances = await this.prisma.attendance.findMany({
      where: {
        studentId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    const totalClasses = attendances.length;
    const presentClasses = attendances.filter((a) => a.present).length;
    const attendanceRate = totalClasses
      ? (presentClasses / totalClasses) * 100
      : 0;

    return {
      totalClasses,
      presentClasses,
      absentClasses: totalClasses - presentClasses,
      attendanceRate: Math.round(attendanceRate * 100) / 100, // Round to 2 decimal places
    };
  }

  /**
   * Get aggregated school attendance statistics grouped by weekdays (Mon–Fri)
   */

  async getSchoolAttendanceStats(
    startDate: Date,
    endDate: Date,
    userId: string,
    userRole: Roles,
  ) {
    const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    const empty = {
      labels,
      present: labels.map(() => 0),
      absent: labels.map(() => 0),
      studentCount: 0,
    };

    let classIds: string[] | null = null;
    if (userRole === Roles.TEACHER) {
      const teacher = await this.prisma.teacher.findUnique({
        where: { id: userId },
        select: { classes: { select: { id: true } } },
      });

      if (!teacher || teacher.classes.length === 0) {
        return empty;
      }

      classIds = teacher.classes.map((c) => c.id);
    } else if (userRole !== Roles.ADMIN && userRole !== Roles.SUPER_ADMIN) {
      throw new ForbiddenException('Unauthorized');
    }

    const studentCount = classIds
      ? await this.prisma.student.count({
          where: { classId: { in: classIds } },
        })
      : await this.prisma.student.count();

    // Initialize an object for weekdays Monday to Friday
    const stats = {
      Mon: { present: 0, absent: 0, total: 0 },
      Tue: { present: 0, absent: 0, total: 0 },
      Wed: { present: 0, absent: 0, total: 0 },
      Thu: { present: 0, absent: 0, total: 0 },
      Fri: { present: 0, absent: 0, total: 0 },
    };

    // Fetch all attendance records within the specified date range
    const attendances = await this.prisma.attendance.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        },
        ...(classIds ? { classId: { in: classIds } } : {}),
      },
      include: {
        lesson: {
          include: {
            class: {
              include: {
                students: true,
              },
            },
          },
        },
      },
    });

    // Create a map to track which lessons/classes we've already counted for each day
    const processedLessons = new Map();

    // Loop over each attendance record and properly count by day and class
    for (const attendance of attendances) {
      const attendanceDate = new Date(attendance.date);
      const dayOfWeek = attendanceDate.getDay();

      // Only consider Monday (1) through Friday (5)
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        const weekdayMap = { 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri' };
        const dayLabel = weekdayMap[dayOfWeek];

        // Create a unique key for this lesson on this day
        const lessonDayKey = `${attendance.lessonId}-${attendanceDate.toISOString().split('T')[0]}`;

        // If we haven't processed this lesson for this day yet
        if (!processedLessons.has(lessonDayKey)) {
          // Get the number of students in this class
          const studentsInClass =
            attendance.lesson?.class?.students?.length || 0;

          // Count this class's student total for this day
          stats[dayLabel].total += studentsInClass;

          // Mark this lesson as processed for this day
          processedLessons.set(lessonDayKey, {
            present: 0,
            absent: 0,
            total: studentsInClass,
          });
        }

        // Update the present/absent counts for this lesson on this day
        const lessonCounts = processedLessons.get(lessonDayKey);
        if (attendance.present) {
          lessonCounts.present++;
          stats[dayLabel].present++;
        } else {
          lessonCounts.absent++;
          stats[dayLabel].absent++;
        }
      }
    }

    // Transform the stats to a format that fits frontend needs
    const present = labels.map((day) => stats[day].present);
    const absent = labels.map((day) => stats[day].absent);

    return { labels, present, absent, studentCount };
  }
}
