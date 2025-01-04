import { Injectable } from '@nestjs/common';
import { DefaultClass } from 'src/class/enum/class';
import { PrismaService } from 'src/prisma/prisma.service';
// import { SubjectsForClasses } from 'src/subject/enum/subject';
import { ClassLessons } from './enum/lesson';
import { Day } from './enum/day';

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

  // async generateAllLessons(tx: any): Promise<void> {
  //   // Fetch all classes from the database
  //   const classes = await tx.class.findMany();

  //   // Loop through each class to get its subjects and lessons
  //   for (const classItem of classes) {
  //     // Get the DefaultClass name for this class
  //     const defaultClassName = classItem.name as DefaultClass;

  //     // Get the subjects for this class from SubjectsForClasses
  //     const subjectsForClass = SubjectsForClasses[defaultClassName] || [];

  //     // Get the lessons for this class from ClassLessons
  //     const lessonsForClass = ClassLessons[defaultClassName] || {};

  //     // Loop through each subject for this class
  //     for (const subjectName of subjectsForClass) {
  //       const subjectLessons = lessonsForClass[subjectName.toUpperCase()] || [];

  //       // Loop through each lesson and create it in the database
  //       for (const lessonName of subjectLessons) {
  //         const [firstDay, secondDay] = this.getRandomDays(); // Get two random days

  //         const daysString = `${firstDay}, ${secondDay}`;

  //         // Get random start and end times for both days
  //         const { startTime1, endTime1, startTime2, endTime2 } =
  //           this.generateLessonTimes();

  //         const start = `${startTime1}, ${startTime2}`;
  //         const end = `${endTime1}, ${endTime2}`;

  //         await tx.lesson.create({
  //           data: {
  //             name: lessonName,
  //             subject: subjectName,
  //             classId: classItem.id,
  //             class: {
  //               connect: { id: classItem.id }, // Connecting the class using its ID
  //             },
  //             gradeId: classItem.supervisorId,
  //             day: daysString,
  //             startTime: start,
  //             endTime: end,
  //           },
  //         });
  //       }
  //     }
  //   }
  // }

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
}
