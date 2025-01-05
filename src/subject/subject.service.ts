import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

import { DefaultClass } from 'src/class/enum/class';
import { SubjectsForClasses } from './enum/subject';
import { Roles } from 'src/shared/enum/role';

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

  async assignSubjectsToClass(
    classId: string,
    subjectIds: string[],
    userRole: Roles,
  ) {
    // Verify user is admin
    if (userRole !== Roles.ADMIN && userRole !== Roles.SUPER_ADMIN) {
      throw new ForbiddenException(
        'Only administrators can assign subjects to classes',
      );
    }

    // Verify class exists
    const classExists = await this.prisma.class.findUnique({
      where: { id: classId },
    });

    if (!classExists) {
      throw new NotFoundException('Class not found');
    }

    // Verify all subjects exist
    const subjects = await this.prisma.subject.findMany({
      where: {
        id: {
          in: subjectIds,
        },
      },
    });

    if (subjects.length !== subjectIds.length) {
      throw new BadRequestException('One or more subject IDs are invalid');
    }

    // Perform the assignment
    try {
      const updatedClass = await this.prisma.class.update({
        where: { id: classId },
        data: {
          subjects: {
            connect: subjectIds.map((id) => ({ id })),
          },
        },
        include: {
          subjects: true,
        },
      });

      return {
        success: true,
        message: `Successfully assigned ${subjectIds.length} subjects to class`,
        data: updatedClass,
      };
    } catch (error) {
      throw new InternalServerErrorException(
        'Failed to assign subjects to class',
      );
    }
  }
}
