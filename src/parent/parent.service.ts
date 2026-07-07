import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/prisma/prisma.service';
import { Roles } from 'src/shared/enum/role';
import { UpdateProfileInput } from 'src/shared/inputs/profile-update.input';
import { PaginationParams } from 'src/shared/pagination/types/pagination.types';
import { PrismaQueryBuilder } from 'src/shared/pagination/utils/prisma.pagination';
import * as bcrypt from 'bcrypt';
import { CloudinaryService } from 'src/shared/cloudinary/services/cloudinary.service';
import { EventVisibility } from 'src/event/enum/eventVisibility';

@Injectable()
export class ParentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  private async getTeacherClassIds(teacherId: string): Promise<string[]> {
    const classes = await this.prisma.class.findMany({
      where: {
        OR: [
          { supervisorId: teacherId },
          { lessons: { some: { teacherId } } },
          { subjects: { some: { teachers: { some: { id: teacherId } } } } },
        ],
      },
      select: { id: true },
    });

    return classes.map((c) => c.id);
  }

  private classifyEventCategory(event: {
    type?: string | null;
    title?: string | null;
    description?: string | null;
  }) {
    const haystack = [event?.type, event?.title, event?.description]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    if (haystack.includes('pta')) {
      return { category: 'PTA', statusLabel: 'PTA' };
    }
    if (haystack.includes('holiday') || haystack.includes('break')) {
      return { category: 'Holiday', statusLabel: 'Holiday' };
    }
    if (haystack.includes('meeting')) {
      return { category: 'Meeting', statusLabel: 'Meeting' };
    }
    return { category: 'Event', statusLabel: 'Upcoming' };
  }

  async getAllParents(
    userId: string,
    userRole: Roles,
    params?: PaginationParams,
  ) {
    try {
      const baseInclude = {
        students: {
          include: {
            class: true,
            result: true,
          },
        },
      };

      const baseQuery: any = {
        include: baseInclude,
        orderBy: { createdAt: 'desc' },
      };

      const searchFields = ['name', 'email', 'phone'];

      switch (userRole) {
        case Roles.ADMIN:
        case Roles.SUPER_ADMIN:
          // Admins can see all parents
          // baseQuery already has the include
          break;

        case Roles.TEACHER: {
          // Teachers can only see parents of students in their classes
          const classIds = await this.getTeacherClassIds(userId);

          baseQuery.where = {
            students: {
              some: {
                classId: {
                  in: classIds,
                },
              },
            },
          };
          baseQuery.include = {
            students: {
              where: { classId: { in: classIds } },
              include: {
                class: true,
                result: true,
              },
            },
          };
          break;
        }

        case Roles.STUDENT: {
          // Students can only see their own parents
          const student = await this.prisma.student.findUnique({
            where: { id: userId },
            select: {
              parentId: true,
            },
          });

          baseQuery.where = {
            id: student?.parentId,
          };
          break;
        }

        case Roles.PARENT:
          // Parents can only see their own profile
          baseQuery.where = {
            id: userId,
          };
          break;

        default:
          throw new ForbiddenException('Unauthorized access');
      }

      return await PrismaQueryBuilder.paginateResponse(
        this.prisma.parent,
        baseQuery,
        params,
        searchFields,
      );
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      throw new InternalServerErrorException('Failed to fetch parents');
    }
  }

  async getParentById(parentId: string) {
    try {
      const parent = await this.prisma.parent.findUnique({
        where: { id: parentId },
        include: {
          students: true,
        },
      });

      if (!parent) {
        throw new NotFoundException(`Parent with ID: ${parentId} not found`);
      }
      return parent;
    } catch (error) {
      throw new Error(`Failed to get parent: ${error.message}`);
    }
  }

  async getParentTodayOverview(parentId: string) {
    const parent = await this.prisma.parent.findUnique({
      where: { id: parentId },
      select: {
        id: true,
        students: {
          select: {
            id: true,
            name: true,
            surname: true,
            classId: true,
            class: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!parent) {
      throw new NotFoundException(`Parent with ID: ${parentId} not found`);
    }

    const linkedStudents = Array.isArray(parent.students)
      ? parent.students
      : [];
    const studentIds = linkedStudents.map((student) => student.id);
    const classIds = [
      ...new Set(
        linkedStudents.map((student) => student.classId).filter(Boolean),
      ),
    ];

    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfRange = new Date(startOfToday);
    endOfRange.setDate(endOfRange.getDate() + 30);

    const [assignments, studentExams, events] = await Promise.all([
      linkedStudents.length
        ? this.prisma.assignment.findMany({
            where: {
              classId: { in: classIds },
            },
            select: {
              id: true,
              title: true,
              dueDate: true,
              classId: true,
              subject: { select: { name: true } },
              submissions: {
                where: {
                  studentId: { in: studentIds },
                },
                select: {
                  studentId: true,
                },
              },
            },
            orderBy: { dueDate: 'asc' },
          })
        : Promise.resolve([]),
      linkedStudents.length
        ? this.prisma.studentExam.findMany({
            where: {
              studentId: { in: studentIds },
            },
            select: {
              id: true,
              studentId: true,
              hasTaken: true,
              exam: {
                select: {
                  id: true,
                  title: true,
                  date: true,
                  startTime: true,
                  endTime: true,
                  classId: true,
                  subject: { select: { name: true } },
                },
              },
            },
            orderBy: {
              exam: {
                date: 'asc',
              },
            },
          })
        : Promise.resolve([]),
      this.prisma.event.findMany({
        where: {
          startTime: { gte: startOfToday, lte: endOfRange },
          OR: [
            { visibility: EventVisibility.PUBLIC as any },
            { targetRoles: { has: Roles.PARENT as any } },
            ...(classIds.length
              ? [
                  { classId: { in: classIds } },
                  { class: { students: { some: { parentId } } } },
                ]
              : []),
          ],
        },
        select: {
          id: true,
          title: true,
          description: true,
          type: true,
          location: true,
          startTime: true,
          endTime: true,
          class: {
            select: {
              name: true,
            },
          },
        },
        orderBy: { startTime: 'asc' },
        take: 8,
      }),
    ]);

    const studentsById = new Map(
      linkedStudents.map((student) => [
        student.id,
        {
          studentId: student.id,
          studentName: [student.name, student.surname]
            .filter(Boolean)
            .join(' '),
          className: student.class?.name ?? null,
          classId: student.classId,
        },
      ]),
    );

    const assignmentTasks = assignments
      .flatMap((assignment) => {
        const classStudents = linkedStudents.filter(
          (student) => student.classId === assignment.classId,
        );
        return classStudents
          .filter(
            (student) =>
              !assignment.submissions.some(
                (submission) => submission.studentId === student.id,
              ),
          )
          .map((student) => {
            const dueDate = new Date(assignment.dueDate);
            const overdue = dueDate.getTime() < startOfToday.getTime();
            const dueToday =
              dueDate.getTime() >= startOfToday.getTime() &&
              dueDate.getTime() < startOfToday.getTime() + 24 * 60 * 60 * 1000;

            return {
              studentId: student.id,
              studentName: [student.name, student.surname]
                .filter(Boolean)
                .join(' '),
              className: student.class?.name ?? null,
              assignmentId: assignment.id,
              title: assignment.title,
              subjectName: assignment.subject?.name ?? null,
              dueDate,
              overdue,
              statusLabel: overdue
                ? 'Overdue'
                : dueToday
                  ? 'Due today'
                  : 'Upcoming',
            };
          });
      })
      .sort((left, right) => left.dueDate.getTime() - right.dueDate.getTime())
      .slice(0, 10);

    const examTasks = studentExams
      .filter((studentExam) => !studentExam.hasTaken && studentExam.exam)
      .map((studentExam) => {
        const student = studentsById.get(studentExam.studentId);
        const examDate = new Date(studentExam.exam.date);
        const missed = examDate.getTime() < startOfToday.getTime();
        const today =
          examDate.getTime() >= startOfToday.getTime() &&
          examDate.getTime() < startOfToday.getTime() + 24 * 60 * 60 * 1000;

        return {
          studentId: student?.studentId || studentExam.studentId,
          studentName: student?.studentName || 'Student',
          className: student?.className ?? null,
          examId: studentExam.exam.id,
          studentExamId: studentExam.id,
          title: studentExam.exam.title,
          subjectName: studentExam.exam.subject?.name ?? null,
          date: examDate,
          startTime: new Date(studentExam.exam.startTime),
          endTime: new Date(studentExam.exam.endTime),
          missed,
          statusLabel: missed ? 'Missed' : today ? 'Today' : 'Upcoming',
        };
      })
      .sort((left, right) => left.date.getTime() - right.date.getTime())
      .slice(0, 10);

    const schoolNotices = events.map((event) => {
      const classified = this.classifyEventCategory(event);
      return {
        eventId: event.id,
        title: event.title,
        category: classified.category,
        statusLabel: classified.statusLabel,
        startTime: new Date(event.startTime),
        endTime: new Date(event.endTime),
        location: event.location ?? null,
        className: event.class?.name ?? null,
      };
    });

    return {
      linkedStudentCount: linkedStudents.length,
      pendingAssignmentCount: assignmentTasks.length,
      overdueAssignmentCount: assignmentTasks.filter((item) => item.overdue)
        .length,
      upcomingExamCount: examTasks.length,
      assignmentTasks,
      examTasks,
      schoolNotices,
    };
  }

  async updateParentProfile(
    id: string,
    input: UpdateProfileInput,
    file?: Express.Multer.File,
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Check for username uniqueness if username is being updated
        if (input.username) {
          const usernameExists = await tx.parent.findUnique({
            where: { username: input.username },
          });

          if (usernameExists && usernameExists.id !== id) {
            throw new ConflictException(`Username already taken`);
          }
        }

        // Upload image if provided
        let imageUrl = input.image;
        if (file) {
          // Get the current parent to check if they have an existing image
          const parent = await tx.parent.findUnique({
            where: { id },
            select: { image: true },
          });

          // Delete old image if exists
          if (parent?.image) {
            try {
              const publicId = this.cloudinaryService.getPublicIdFromUrl(
                parent.image,
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
            'parent-profiles',
          );
        }

        // Hash password if provided
        let passwordData = {};
        if (input.password) {
          const hashedPassword = await bcrypt.hash(input.password, 10);
          passwordData = { password: hashedPassword };
        }

        // Update parent profile
        const updateData: any = {};

        if (input.name !== undefined) updateData.name = input.name;
        if (input.surname !== undefined) updateData.surname = input.surname;
        if (input.username !== undefined) updateData.username = input.username;
        if (input.email !== undefined) updateData.email = input.email;
        if (input.phone !== undefined) updateData.phone = input.phone;
        if (input.address !== undefined) updateData.address = input.address;
        if (input.aboutMe !== undefined) updateData.aboutMe = input.aboutMe;
        if (input.dateOfBirth !== undefined)
          updateData.dateOfBirth = input.dateOfBirth;

        if ((passwordData as any).password)
          updateData.password = (passwordData as any).password;
        if (imageUrl !== undefined) updateData.image = imageUrl;

        return tx.parent.update({
          where: { id },
          data: {
            ...updateData,
          },
        });
      });
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      throw new InternalServerErrorException(
        `Failed to update parent profile: ${error.message}`,
      );
    }
  }

  async updateFeeReminderPreference(id: string, optOut: boolean) {
    try {
      const parent = await this.prisma.parent.findUnique({
        where: { id },
        select: { id: true },
      });

      if (!parent) {
        throw new NotFoundException(`Parent with ID: ${id} not found`);
      }

      return await this.prisma.parent.update({
        where: { id },
        data: { feeReminderOptOut: optOut },
        include: {
          students: true,
        },
      });
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        `Failed to update fee reminder preference: ${error.message}`,
      );
    }
  }

  async updateWeeklyDigestPreference(id: string, optOut: boolean) {
    try {
      const parent = await this.prisma.parent.findUnique({
        where: { id },
        select: { id: true },
      });

      if (!parent) {
        throw new NotFoundException(`Parent with ID: ${id} not found`);
      }

      return await this.prisma.parent.update({
        where: { id },
        data: { weeklyDigestOptOut: optOut },
        include: {
          students: true,
        },
      });
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        `Failed to update weekly digest preference: ${error.message}`,
      );
    }
  }
}
