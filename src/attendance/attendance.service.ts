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
// import {
//   PaginatedResponse,
//   PaginationParams,
// } from 'src/shared/pagination/types/pagination.types';
// import { PrismaQueryBuilder } from 'src/shared/pagination/utils/prisma.pagination';
import { Attendance } from './types/attendance.types';

@Injectable()
@WebSocketGateway()
export class AttendanceService {
  @WebSocketServer()
  private readonly server: Server;

  constructor(private prisma: PrismaService) {}

  async getAttendances(
    userId: string,
    userRole: Roles,
    searchQuery?: string,
  ): Promise<Attendance[]> {
    try {
      // Always include these relations to match the GraphQL type
      const queryOptions: any = {
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
          if (
            !teacherClasses ||
            !teacherClasses.classes ||
            teacherClasses.classes.length === 0
          ) {
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
          if (!parent || !parent.students || parent.students.length === 0) {
            return []; // Return empty array if parent has no students
          }

          const studentIds = parent.students.map((s) => s.id);

          queryOptions.where = {
            studentId: { in: studentIds },
          };
          break;

        default:
          throw new ForbiddenException('Invalid role');
      }

      // Add search functionality
      if (searchQuery && searchQuery.trim() !== '') {
        const searchTerm = searchQuery.trim();
        // const searchFields = ['student.name', 'lesson.subject.name'];

        // Create search conditions
        const searchConditions = {
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

        // Merge search conditions with existing where clause
        queryOptions.where = {
          ...queryOptions.where,
          ...searchConditions,
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
      console.log('error:', error);
      if (error instanceof ForbiddenException) throw error;
      throw new InternalServerErrorException('Failed to fetch attendances');
    }
  }

  // async getAttendances(
  //   userId: string,
  //   userRole: Roles,
  //   params: PaginationParams,
  // ): Promise<PaginatedResponse<any>> {
  //   try {
  //     let baseQuery: any = {
  //       include: {
  //         student: true,
  //         lesson: {
  //           include: {
  //             subject: true,
  //             class: true,
  //           },
  //         },
  //       },
  //     };

  //     switch (userRole) {
  //       case Roles.ADMIN:
  //       case Roles.SUPER_ADMIN:
  //         // Admin and super admin can see all attendances
  //         break;

  //       case Roles.TEACHER:
  //         const teacherClasses = await this.prisma.teacher.findUnique({
  //           where: { id: userId },
  //           select: { classes: { select: { id: true } } },
  //         });

  //         const classIds = teacherClasses.classes.map((c) => c.id);

  //         baseQuery.where = {
  //           lesson: {
  //             classId: { in: classIds },
  //           },
  //         };
  //         break;

  //       case Roles.STUDENT:
  //         baseQuery = {
  //           where: {
  //             studentId: userId,
  //           },
  //           include: {
  //             lesson: {
  //               include: {
  //                 subject: true,
  //                 class: true,
  //               },
  //             },
  //           },
  //         };
  //         break;

  //       case Roles.PARENT:
  //         const parent = await this.prisma.parent.findUnique({
  //           where: { id: userId },
  //           include: { students: { select: { id: true } } },
  //         });

  //         const studentIds = parent.students.map((s) => s.id);

  //         baseQuery.where = {
  //           studentId: { in: studentIds },
  //         };
  //         break;

  //       default:
  //         throw new ForbiddenException('Invalid role');
  //     }

  //     // Define searchable fields - adjust these based on your needs
  //     const searchFields = ['student.name', 'lesson.subject.name'];

  //     return await PrismaQueryBuilder.paginateResponse(
  //       this.prisma.attendance,
  //       baseQuery,
  //       params,
  //       searchFields,
  //     );
  //   } catch (error) {
  //     console.log('error:', error);
  //     if (error instanceof ForbiddenException) throw error;
  //     throw new InternalServerErrorException('Failed to fetch attendances');
  //   }
  // }
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
    if (
      userRole !== Roles.TEACHER &&
      userRole !== Roles.ADMIN &&
      userRole !== Roles.SUPER_ADMIN
    ) {
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

    // Get the classId from the lesson
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { classId: true },
    });

    if (!lesson) {
      throw new NotFoundException('Lesson not found');
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
    // Only allow admins or super-admins to access school-wide stats
    if (userRole !== Roles.ADMIN && userRole !== Roles.SUPER_ADMIN) {
      throw new ForbiddenException('Unauthorized');
    }
    // Get the total number of classes
    const classCount = await this.prisma.class.count();

    // Fetch all attendance records within the specified date range
    const attendances = await this.prisma.attendance.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    // Initialize an object for weekdays Monday to Friday
    const stats = {
      Mon: { present: 0, absent: 0 },
      Tue: { present: 0, absent: 0 },
      Wed: { present: 0, absent: 0 },
      Thu: { present: 0, absent: 0 },
      Fri: { present: 0, absent: 0 },
    };

    // Loop over each attendance record and increment counts based on the day
    for (const attendance of attendances) {
      // Convert attendance date to a JS Date object (if not already)
      const attendanceDate = new Date(attendance.date);
      // getDay() returns 0 (Sunday) to 6 (Saturday)
      const dayOfWeek = attendanceDate.getDay();
      // Only consider Monday (1) through Friday (5)
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        // Map numeric day to string label
        const weekdayMap = { 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri' };
        const dayLabel = weekdayMap[dayOfWeek];

        if (attendance.present) {
          stats[dayLabel].present++;
        } else {
          stats[dayLabel].absent++;
        }
      }
    }

    //transform the stats to a format that fits frontend needs.
    // For example, returning arrays for labels, present, and absent counts:
    const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    const present = labels.map((day) => stats[day].present);
    const absent = labels.map((day) => stats[day].absent);

    return { labels, present, absent, classCount };
  }
}
