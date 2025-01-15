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
import { PrismaQueryBuilder } from 'src/shared/pagination/utils/prisma.pagination';
import { PaginationParams } from 'src/shared/pagination/types/pagination.types';

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

  async getAllSubjects(
    userId: string,
    userRole: Roles,
    params?: PaginationParams,
  ) {
    try {
      const baseInclude = {
        exams: true,
        teachers: true,
        lessons: true,
        assignments: true,
        grade: true,
        class: true,
      };

      const baseQuery: any = {
        include: baseInclude,
      };

      const searchFields = ['name', 'class'];

      switch (userRole) {
        case Roles.SUPER_ADMIN:
        case Roles.ADMIN:
          // Admins can see all subjects
          break;

        case Roles.TEACHER:
          // Teachers only see subjects they teach
          baseQuery.where = {
            teachers: {
              some: {
                id: userId,
              },
            },
          };
          break;

        case Roles.PARENT:
          // Parents see subjects their children are enrolled in
          const children = await this.prisma.student.findMany({
            where: { parentId: userId },
            select: {
              classId: true,
              gradeId: true,
            },
          });

          if (!children.length) {
            throw new NotFoundException('No children found for this parent');
          }

          baseQuery.where = {
            OR: [
              {
                class: {
                  id: {
                    in: children.map((child) => child.classId),
                  },
                },
              },
              {
                grade: {
                  id: {
                    in: children.map((child) => child.gradeId),
                  },
                },
              },
            ],
          };
          break;

        case Roles.STUDENT:
          // Students see subjects in their class/grade
          const student = await this.prisma.student.findUnique({
            where: { id: userId },
            select: {
              classId: true,
              gradeId: true,
            },
          });

          if (!student) {
            throw new NotFoundException('Student not found');
          }

          baseQuery.where = {
            OR: [{ classId: student.classId }, { gradeId: student.gradeId }],
          };
          break;

        default:
          throw new ForbiddenException(
            'You do not have permission to view subjects',
          );
      }

      return await PrismaQueryBuilder.paginateResponse(
        this.prisma.subject,
        baseQuery,
        params,
        searchFields,
      );
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      if (error instanceof ForbiddenException) throw error;
      throw new InternalServerErrorException('Failed to fetch subjects');
    }
  }
  async getSubjectById(subjectId: string) {
    const subject = await this.prisma.subject.findUnique({
      where: { id: subjectId },
      include: {
        lessons: true,
        class: true,
        teachers: true,
        exams: {
          orderBy: {
            createdAt: 'desc',
          },
        },
        assignments: {
          orderBy: {
            dueDate: 'desc',
          },
        },
      },
    });

    if (!subject) {
      throw new NotFoundException(`Subject with ID ${subjectId} not found`);
    }

    return subject;
  }
}
