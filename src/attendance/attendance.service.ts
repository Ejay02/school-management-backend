import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Roles } from 'src/shared/enum/role';
import { MarkAttendanceInput } from './input/attendance.input';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import {
  PaginatedResponse,
  PaginationParams,
} from 'src/shared/pagination/types/pagination.types';
import { PrismaQueryBuilder } from 'src/shared/pagination/utils/prisma.pagination';

@Injectable()
@WebSocketGateway()
export class AttendanceService {
  @WebSocketServer()
  private readonly server: Server;

  constructor(private prisma: PrismaService) {}

  async getAttendances(
    userId: string,
    userRole: Roles,
    params: PaginationParams,
  ): Promise<PaginatedResponse<any>> {
    try {
      let baseQuery: any = {
        include: {
          student: true,
          lesson: {
            include: {
              subject: true,
              class: true,
            },
          },
        },
      };

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

          const classIds = teacherClasses.classes.map((c) => c.id);

          baseQuery.where = {
            lesson: {
              classId: { in: classIds },
            },
          };
          break;

        case Roles.STUDENT:
          baseQuery = {
            where: {
              studentId: userId,
            },
            include: {
              lesson: {
                include: {
                  subject: true,
                  class: true,
                },
              },
            },
          };
          break;

        case Roles.PARENT:
          const parent = await this.prisma.parent.findUnique({
            where: { id: userId },
            include: { students: { select: { id: true } } },
          });

          const studentIds = parent.students.map((s) => s.id);

          baseQuery.where = {
            studentId: { in: studentIds },
          };
          break;

        default:
          throw new ForbiddenException('Invalid role');
      }

      // Define searchable fields - adjust these based on your needs
      const searchFields = ['student.name', 'lesson.subject.name'];

      return await PrismaQueryBuilder.paginateResponse(
        this.prisma.attendance,
        baseQuery,
        params,
        searchFields,
      );
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      throw new InternalServerErrorException('Failed to fetch attendances');
    }
  }
  // Get attendance by lesson
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
    if (userRole !== Roles.TEACHER && userRole !== Roles.ADMIN) {
      throw new ForbiddenException(
        'Only teachers and admins can mark attendance',
      );
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
}
