import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

import { DefaultClass } from 'src/class/enum/class';
import { SubjectsForClasses } from './enum/subject';

@Injectable()
export class SubjectService {
  constructor(private readonly prisma: PrismaService) {}

  async generateAllSubjects(tx: any): Promise<void> {
    // Fetch all classes from the database
    const classes = await tx.class.findMany();

    for (const classItem of classes) {
      // Get the DefaultClass name for this class
      const defaultClassName = classItem.name as DefaultClass;

      // Get the subjects for this class from SubjectsForClasses
      const subjectsForClass = SubjectsForClasses[defaultClassName] || [];

      for (const subjectName of subjectsForClass) {
        await tx.subject.create({
          data: {
            name: subjectName,
            classId: classItem.id,
            gradeId: classItem.supervisorId,
          },
        });
      }
    }
  }
}
