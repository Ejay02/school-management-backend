import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { DefaultClass } from 'src/class/enum/class';
import { PrismaService } from 'src/prisma/prisma.service';
import { ClassLessons } from './enum/lesson';
import { Day } from './enum/day';
import { CreateLessonInput } from './input/create.lesson.input';
import { Roles } from 'src/shared/enum/role';
import { EditLessonInput } from './input/edit.lesson.input';
import { PrismaQueryBuilder } from 'src/shared/pagination/utils/prisma.pagination';
import { PaginationParams } from 'src/shared/pagination/types/pagination.types';

@Injectable()
export class LessonService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly schoolStartMinutes = 9 * 60;
  private readonly schoolEndMinutes = 14 * 60;
  private readonly breakStartMinutes = 12 * 60;
  private readonly breakEndMinutes = 13 * 60;
  private readonly weekdayNames = [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
  ];

  private normalizeWeekday(value: string): string | null {
    const trimmed = String(value || '')
      .trim()
      .toLowerCase();
    const match = this.weekdayNames.find((d) => d.toLowerCase() === trimmed);
    return match || null;
  }

  private parseTimeToMinutes(value: string): number {
    const trimmed = String(value || '').trim();
    const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(trimmed);
    if (!match)
      throw new BadRequestException('Invalid time format. Use HH:MM.');
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    return hours * 60 + minutes;
  }

  private ensureWithinSchoolHours(
    day: string,
    startTime: string,
    endTime: string,
  ) {
    const normalizedDay = this.normalizeWeekday(day);
    if (!normalizedDay) {
      throw new BadRequestException(
        'Lessons can only be scheduled Monday to Friday.',
      );
    }

    const startMinutes = this.parseTimeToMinutes(startTime);
    const endMinutes = this.parseTimeToMinutes(endTime);

    if (endMinutes <= startMinutes) {
      throw new BadRequestException('End time must be after start time.');
    }

    if (
      startMinutes < this.schoolStartMinutes ||
      endMinutes > this.schoolEndMinutes
    ) {
      throw new BadRequestException(
        'Lessons must be within school hours (Mon-Fri, 9:00am to 2:00pm).',
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
        'Lessons cannot be scheduled during break time (12:00pm to 1:00pm).',
      );
    }

    return { normalizedDay, startMinutes, endMinutes };
  }

  private timeRangesOverlap(
    aStart: number,
    aEnd: number,
    bStart: number,
    bEnd: number,
  ) {
    return aStart < bEnd && bStart < aEnd;
  }

  private parseScheduleSlots(value: string): string[] {
    return String(value || '')
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
  }

  private async ensureNoLessonClash(
    tx: any,
    classId: string,
    teacherId: string | null,
    day: string,
    startMinutes: number,
    endMinutes: number,
    excludeLessonId?: string,
  ) {
    const baseWhere: any = {
      classId,
      day: { contains: day, mode: 'insensitive' },
    };

    if (excludeLessonId) baseWhere.id = { not: excludeLessonId };

    const classLessons = await tx.lesson.findMany({
      where: baseWhere,
      select: {
        id: true,
        name: true,
        day: true,
        startTime: true,
        endTime: true,
        teacherId: true,
      },
    });

    for (const lesson of classLessons) {
      const days = this.parseScheduleSlots(lesson.day);
      const starts = this.parseScheduleSlots(lesson.startTime);
      const ends = this.parseScheduleSlots(lesson.endTime);
      const slots = Math.min(days.length, starts.length, ends.length);

      for (let i = 0; i < slots; i++) {
        const slotDay = this.normalizeWeekday(days[i]);
        if (slotDay?.toLowerCase() !== day.toLowerCase()) continue;
        let slotStart: number;
        let slotEnd: number;
        try {
          slotStart = this.parseTimeToMinutes(starts[i]);
          slotEnd = this.parseTimeToMinutes(ends[i]);
        } catch {
          continue;
        }

        if (
          this.timeRangesOverlap(startMinutes, endMinutes, slotStart, slotEnd)
        ) {
          throw new ConflictException(
            'This time conflicts with an existing lesson for the class.',
          );
        }
      }
    }

    if (!teacherId) return;

    const teacherLessons = await tx.lesson.findMany({
      where: {
        teacherId,
        day: { contains: day, mode: 'insensitive' },
        ...(excludeLessonId ? { id: { not: excludeLessonId } } : {}),
      },
      select: {
        id: true,
        name: true,
        day: true,
        startTime: true,
        endTime: true,
        classId: true,
      },
    });

    for (const lesson of teacherLessons) {
      const days = this.parseScheduleSlots(lesson.day);
      const starts = this.parseScheduleSlots(lesson.startTime);
      const ends = this.parseScheduleSlots(lesson.endTime);
      const slots = Math.min(days.length, starts.length, ends.length);

      for (let i = 0; i < slots; i++) {
        const slotDay = this.normalizeWeekday(days[i]);
        if (slotDay?.toLowerCase() !== day.toLowerCase()) continue;
        let slotStart: number;
        let slotEnd: number;
        try {
          slotStart = this.parseTimeToMinutes(starts[i]);
          slotEnd = this.parseTimeToMinutes(ends[i]);
        } catch {
          continue;
        }

        if (
          this.timeRangesOverlap(startMinutes, endMinutes, slotStart, slotEnd)
        ) {
          throw new ConflictException(
            'This time conflicts with another lesson in your schedule.',
          );
        }
      }
    }
  }

  async generateAllLessons(tx: any): Promise<void> {
    // Fetch all classes from the database
    const classes = await tx.class.findMany();

    // Loop through each class
    for (const classItem of classes) {
      const defaultClassName = classItem.name as DefaultClass;
      const lessonsForClass = ClassLessons[defaultClassName] || {};

      // First, fetch all subjects for this class
      const subjects = await tx.subject.findMany({
        where: {
          classId: classItem.id,
        },
      });

      // Loop through each subject
      for (const subject of subjects) {
        // Get lessons for this subject from ClassLessons
        const subjectLessons =
          lessonsForClass[subject.name.toUpperCase()] || [];

        // Create lessons for this subject
        for (const lessonName of subjectLessons) {
          const existingLesson = await tx.lesson.findFirst({
            where: {
              name: lessonName,
              subject: { id: subject.id },
              class: { id: classItem.id },
            },
          });

          if (!existingLesson) {
            const [firstDay, secondDay] = this.getRandomDays();
            const daysString = `${firstDay}, ${secondDay}`;

            const { startTime1, endTime1, startTime2, endTime2 } =
              this.generateLessonTimes();

            const start = `${startTime1}, ${startTime2}`;
            const end = `${endTime1}, ${endTime2}`;

            await tx.lesson.create({
              data: {
                name: lessonName,
                subject: {
                  connect: { id: subject.id }, // Connect to existing subject using its ID
                },
                class: {
                  connect: { id: classItem.id },
                },

                day: daysString,
                startTime: start,
                endTime: end,
              },
            });
          }
        }
      }
    }
  }

  private getRandomDays(): Day[] {
    const days = Object.values(Day);
    const randomDays = [];

    while (randomDays.length < 2) {
      const randomIndex = Math.floor(Math.random() * days.length);
      const selectedDay = days[randomIndex];

      // Ensure that no duplicate day is selected
      if (!randomDays.includes(selectedDay)) {
        randomDays.push(selectedDay);
      }
    }

    return randomDays;
  }

  private getRandomStartTime(): string {
    // School hours: 9 AM to 4 PM, but no lectures from 12 PM to 1 PM

    // Randomly choose from valid time periods
    const validPeriods = [
      { start: 9, end: 12 }, // 9 AM to 12 PM
      { start: 13, end: 16 }, // 1 PM to 4 PM
    ];

    const randomPeriod =
      validPeriods[Math.floor(Math.random() * validPeriods.length)];
    const randomHour =
      Math.floor(Math.random() * (randomPeriod.end - randomPeriod.start)) +
      randomPeriod.start;
    const randomMinute = Math.floor(Math.random() * 60); // Random minutes between 0 and 59
    const time = new Date();
    time.setHours(randomHour, randomMinute, 0, 0); // Set random time
    return time.toISOString().slice(11, 16); // Return HH:mm format
  }

  private generateLessonTimes() {
    const startTime1 = this.getRandomStartTime();
    const endTime1 = this.getEndTime(startTime1);

    const startTime2 = this.getRandomStartTime();
    const endTime2 = this.getEndTime(startTime2);

    return {
      startTime1,
      endTime1,
      startTime2,
      endTime2,
    };
  }

  private getEndTime(startTime: string): string {
    const [hours, minutes] = startTime.split(':').map(Number);
    const endDate = new Date();
    endDate.setHours(hours, minutes + 60); // Add one hour to the start time
    return endDate.toISOString().slice(11, 16); // Return HH:mm format
  }

  async getAllLessons(
    userId: string,
    role: Roles,
    params?: PaginationParams,
    studentId?: string,
  ) {
    try {
      const searchFields = ['name', 'description'];
      let baseQuery: any = {};

      // Admin and super admin get full access to all lessons
      if ([Roles.SUPER_ADMIN, Roles.ADMIN].includes(role)) {
        baseQuery = {
          include: {
            teacher: true,
            subject: true,
            class: {
              include: {
                students: true,
              },
            },

            assignments: {
              include: {
                submissions: true,
              },
            },
            attendances: {
              include: {
                student: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        };
      }
      // Teachers get full access but only to their assigned lessons
      else if (role === Roles.TEACHER) {
        baseQuery = {
          where: {
            teacherId: userId,
          },
          include: {
            teacher: true,
            subject: true,
            class: {
              include: {
                students: true,
              },
            },
            // exams: true,
            assignments: {
              include: {
                submissions: true,
              },
            },
            attendances: {
              include: {
                student: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        };
      }
      // Students get access to their class lessons with limited details
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
            teacher: {
              select: {
                id: true,
                name: true,
                surname: true,
              },
            },
            subject: true,
            class: {
              select: {
                id: true,
                name: true,
              },
            },
            assignments: {
              include: {
                submissions: {
                  where: {
                    studentId: userId,
                  },
                },
              },
            },
            attendances: {
              where: {
                studentId: userId,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        };
      }
      // Parents get summary view of their children's lessons
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
            name: true,
            day: true,
            startTime: true,
            endTime: true,
            subject: {
              select: {
                id: true,
                name: true,
              },
            },
            class: {
              select: {
                id: true,
                name: true,
              },
            },
            teacher: {
              select: {
                id: true,
                name: true,
                surname: true,
              },
            },
            assignments: {
              select: {
                id: true,
                title: true,
                dueDate: true,
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
            },
            attendances: {
              where: {
                studentId: {
                  in: childrenIds,
                },
              },
              select: {
                date: true,
                studentId: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        };
      } else {
        throw new ForbiddenException(
          'You do not have permission to view lessons',
        );
      }

      return await PrismaQueryBuilder.paginateResponse(
        this.prisma.lesson,
        baseQuery,
        params,
        searchFields,
      );
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      if (error instanceof ForbiddenException) throw error;
      throw new InternalServerErrorException('Failed to fetch lessons');
    }
  }

  async getLessonById(lessonId: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        subject: true,
        class: true,
        teacher: true,
        assignments: {
          orderBy: {
            dueDate: 'desc',
          },
        },
        attendances: {
          orderBy: {
            date: 'desc',
          },
          include: {
            student: true,
          },
        },
      },
    });

    if (!lesson) {
      throw new NotFoundException(`Lesson with ID ${lessonId} not found`);
    }

    return lesson;
  }

  async createLesson(
    createLessonInput: CreateLessonInput,
    subjectId: string,
    classId: string,
    userId: string,
    userRole: Roles,
  ) {
    return await this.prisma.$transaction(async (tx) => {
      // Verify the subject exists and belongs to the specified class
      const subject = await tx.subject.findFirst({
        where: {
          id: subjectId,
          classId: classId,
        },
      });

      if (!subject) {
        throw new NotFoundException('Subject not found in this class');
      }

      const schedule = this.ensureWithinSchoolHours(
        createLessonInput.day,
        createLessonInput.startTime,
        createLessonInput.endTime,
      );

      // Check for duplicate lessons
      const existingLesson = await tx.lesson.findFirst({
        where: {
          name: createLessonInput.name,
          classId: classId,
        },
      });

      if (existingLesson) {
        throw new ConflictException(
          `A lesson with the same name: ${createLessonInput.name} already exists in this class`,
        );
      }

      // Base lesson data
      const lessonData = {
        name: createLessonInput.name,
        day: schedule.normalizedDay,
        startTime: createLessonInput.startTime,
        endTime: createLessonInput.endTime,
        description: createLessonInput.description,
        content: createLessonInput.content,
        subject: {
          connect: { id: subjectId },
        },
        class: {
          connect: { id: classId },
        },
      };

      // If user is a teacher
      if (userRole === Roles.TEACHER) {
        const teacher = await tx.teacher.findFirst({
          where: { id: userId },
          select: { id: true },
        });

        if (!teacher) {
          throw new ForbiddenException('Teacher not found');
        }

        await this.ensureNoLessonClash(
          tx,
          classId,
          teacher.id,
          schedule.normalizedDay,
          schedule.startMinutes,
          schedule.endMinutes,
        );

        // Create the lesson with teacher assignment
        return await tx.lesson.create({
          data: {
            ...lessonData,
            teacher: {
              connect: { id: teacher.id },
            },
          },
          include: {
            subject: true,
            class: true,
            teacher: true,
            assignments: true,
            attendances: true,
          },
        });
      }

      await this.ensureNoLessonClash(
        tx,
        classId,
        null,
        schedule.normalizedDay,
        schedule.startMinutes,
        schedule.endMinutes,
      );

      // If admin, create lesson without teacher assignment
      const lesson = await tx.lesson.create({
        data: {
          ...lessonData,
          // Only connect teacher if admin provides a teacherId in the input
          // This is undefined by default
          teacher: undefined,
        },
        include: {
          subject: true,
          class: true,
          teacher: true,
          assignments: true,
          attendances: true,
        },
      });

      return lesson;
    });
  }

  async editLesson(
    lessonId: string,
    userId: string,
    userRole: Roles,
    editLessonInput: EditLessonInput,
  ) {
    return await this.prisma.$transaction(async (tx) => {
      // First verify the lesson exists
      const existingLesson = await tx.lesson.findUnique({
        where: { id: lessonId },
        include: {
          teacher: true,
          subject: true,
          class: true,
        },
      });

      if (!existingLesson) {
        throw new NotFoundException('Lesson not found');
      }

      // If user is a teacher, verify they are assigned to this lesson
      if (userRole === Roles.TEACHER) {
        const teacher = await tx.teacher.findFirst({
          where: { id: userId },
          select: { id: true },
        });

        if (!teacher) {
          throw new ForbiddenException('Teacher not found');
        }

        if (existingLesson.teacher?.id !== teacher.id) {
          throw new ForbiddenException('You can only edit your own lessons');
        }
      }

      const schedule = this.ensureWithinSchoolHours(
        editLessonInput.day,
        editLessonInput.startTime,
        editLessonInput.endTime,
      );

      // Prepare edit data
      const editData: any = {
        name: editLessonInput.name,
        day: schedule.normalizedDay,
        startTime: editLessonInput.startTime,
        endTime: editLessonInput.endTime,
        description: editLessonInput.description,
        content: editLessonInput.content,
      };

      // If admin is updating and provides a new teacher
      if (userRole === Roles.ADMIN && editLessonInput.teacherId) {
        editData.teacher = {
          connect: { id: editLessonInput.teacherId },
        };
      }

      const effectiveTeacherId =
        userRole === Roles.ADMIN && editLessonInput.teacherId
          ? editLessonInput.teacherId
          : existingLesson.teacher?.id || null;

      await this.ensureNoLessonClash(
        tx,
        existingLesson.classId,
        effectiveTeacherId,
        schedule.normalizedDay,
        schedule.startMinutes,
        schedule.endMinutes,
        lessonId,
      );

      // edit the lesson
      return tx.lesson.update({
        where: { id: lessonId },
        data: editData,
        include: {
          subject: true,
          class: true,
          teacher: true,
          assignments: true,
          attendances: true,
        },
      });
    });
  }

  public async assignLessonsToClass(classId: string, lessons: string[]) {
    return this.prisma.$transaction(async (tx) => {
      // Validate class existence
      const classExists = await tx.class.findUnique({
        where: { id: classId },
      });

      if (!classExists) {
        throw new Error(`Class with ID ${classId} not found.`);
      }

      // Validate lesson existence
      const existingLessons = await tx.lesson.findMany({
        where: {
          id: { in: lessons },
        },
      });

      if (existingLessons.length !== lessons.length) {
        throw new Error(`Some lessons do not exist.`);
      }

      // Update the class with the lessons
      return tx.class.update({
        where: { id: classId },
        data: {
          lessons: {
            connect: lessons.map((lessonId) => ({ id: lessonId })),
          },
        },
      });
    });
  }

  public async assignLessonsToTeacher(teacherId: string, lessons: string[]) {
    return this.prisma.$transaction(async (tx) => {
      // Validate teacher existence
      const teacherExists = await tx.teacher.findUnique({
        where: { id: teacherId },
      });

      if (!teacherExists) {
        throw new Error(`Teacher with ID ${teacherId} not found.`);
      }

      // Validate lesson existence
      const existingLessons = await tx.lesson.findMany({
        where: {
          id: { in: lessons },
        },
      });

      if (existingLessons.length !== lessons.length) {
        throw new Error(`Some lessons do not exist.`);
      }

      // Assign teacherId to the specified lessons
      await tx.lesson.updateMany({
        where: { id: { in: lessons } },
        data: { teacherId },
      });
    });
  }

  async deleteLesson(lessonId: string, userRole: Roles) {
    try {
      // Use transaction for the entire operation
      return await this.prisma.$transaction(
        async (tx) => {
          // Only admins can delete lessons
          if (userRole !== Roles.ADMIN && userRole !== Roles.SUPER_ADMIN) {
            throw new ForbiddenException(
              'Only administrators can delete lessons',
            );
          }

          // First verify the lesson exists
          const existingLesson = await tx.lesson.findUnique({
            where: { id: lessonId },
            include: {
              assignments: true,
              attendances: true,
            },
          });

          if (!existingLesson) {
            throw new NotFoundException('Lesson not found');
          }

          // Check if lesson has associated data
          const hasAssociatedData =
            existingLesson.assignments.length > 0 ||
            existingLesson.attendances.length > 0;

          if (hasAssociatedData) {
            throw new ForbiddenException(
              'Cannot delete lesson with existing assignments, or attendance records. ' +
                'Please archive the lesson instead or contact system administrator for data cleanup.',
            );
          }

          // Proceed with deletion

          await tx.lesson.delete({
            where: { id: lessonId },
          });

          return {
            success: true,
            message: 'Lesson successfully deleted',
          };
        },
        {
          // Transaction options
          maxWait: 5000, // 5 seconds maximum wait time
          timeout: 10000, // 10 seconds timeout
        },
      );
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to delete lesson');
    }
  }
}
