import {
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

@Injectable()
export class LessonService {
  constructor(private readonly prisma: PrismaService) {}

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
              // gradeId: classItem.supervisorId,
              day: daysString,
              startTime: start,
              endTime: end,
            },
          });
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

  async createLesson(
    createLessonInput: CreateLessonInput,
    subjectId: string,
    classId: string,
    userId: string,
    userRole: Roles,
  ) {
    // Verify the subject exists and belongs to the specified class
    const subject = await this.prisma.subject.findFirst({
      where: {
        id: subjectId,
        classId: classId,
      },
    });

    if (!subject) {
      throw new NotFoundException('Subject not found in this class');
    }

    // Check for duplicate lessons
    const existingLesson = await this.prisma.lesson.findFirst({
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

    // If user is a teacher
    if (userRole === Roles.TEACHER) {
      const teacher = await this.prisma.teacher.findFirst({
        where: { id: userId },
        select: { id: true },
      });

      if (!teacher) {
        throw new ForbiddenException('Teacher not found');
      }

      // Create the lesson with teacher assignment
      return this.prisma.lesson.create({
        data: {
          name: createLessonInput.name,
          day: createLessonInput.day,
          startTime: createLessonInput.startTime,
          endTime: createLessonInput.endTime,
          subject: {
            connect: { id: subjectId },
          },
          class: {
            connect: { id: classId },
          },
          teacher: {
            connect: { id: teacher.id },
          },
        },
        include: {
          subject: true,
          class: true,
          teacher: true,
          exams: true,
          assignments: true,
          attendances: true,
        },
      });
    }

    // If admin, create lesson without teacher assignment
    return this.prisma.lesson.create({
      data: {
        name: createLessonInput.name,
        day: createLessonInput.day,
        startTime: createLessonInput.startTime,
        endTime: createLessonInput.endTime,
        subject: {
          connect: { id: subjectId },
        },
        class: {
          connect: { id: classId },
        },
      },
      include: {
        subject: true,
        class: true,
        teacher: true,
        exams: true,
        assignments: true,
        attendances: true,
      },
    });
  }

  async editLesson(
    lessonId: string,
    userId: string,
    userRole: Roles,
    editLessonInput: EditLessonInput,
  ) {
    // First verify the lesson exists
    const existingLesson = await this.prisma.lesson.findUnique({
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
      const teacher = await this.prisma.teacher.findFirst({
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

    // Prepare edit data
    const editData: any = {
      name: editLessonInput.name,
      day: editLessonInput.day,
      startTime: editLessonInput.startTime,
      endTime: editLessonInput.endTime,
    };

    // If admin is updating and provides a new teacher
    if (userRole === Roles.ADMIN && editLessonInput.teacherId) {
      editData.teacher = {
        connect: { id: editLessonInput.teacherId },
      };
    }

    // edit the lesson
    return this.prisma.lesson.update({
      where: { id: lessonId },
      data: editData,
      include: {
        subject: true,
        class: true,
        teacher: true,
        exams: true,
        assignments: true,
        attendances: true,
      },
    });
  }

  async deleteLesson(lessonId: string, userRole: Roles) {
    // Only admins can delete lessons
    if (userRole !== Roles.ADMIN && userRole !== Roles.SUPER_ADMIN) {
      throw new ForbiddenException('Only administrators can delete lessons');
    }

    // First verify the lesson exists
    const existingLesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        exams: true,
        assignments: true,
        attendances: true,
      },
    });

    if (!existingLesson) {
      throw new NotFoundException('Lesson not found');
    }

    // Check if lesson has associated data
    const hasAssociatedData =
      existingLesson.exams.length > 0 ||
      existingLesson.assignments.length > 0 ||
      existingLesson.attendances.length > 0;

    if (hasAssociatedData) {
      throw new ForbiddenException(
        'Cannot delete lesson with existing exams, assignments, or attendance records. ' +
          'Please archive the lesson instead or contact system administrator for data cleanup.',
      );
    }

    // Proceed with deletion
    try {
      await this.prisma.lesson.delete({
        where: { id: lessonId },
      });

      return {
        success: true,
        message: 'Lesson successfully deleted',
      };
    } catch (error) {
      throw new InternalServerErrorException('Failed to delete lesson');
    }
  }
}
