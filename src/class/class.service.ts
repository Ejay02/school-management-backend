import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/prisma/prisma.service';
import { DefaultClass } from './enum/class';

import { CreateClassInput } from './input/create.class.input';

@Injectable()
export class ClassService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  private async getDefaultClasses(): Promise<DefaultClass[]> {
    return Object.values(DefaultClass);
  }

  public async setDefaultClasses(tx: any): Promise<void> {
    const defaultClasses = await this.getDefaultClasses();

    for (const className of defaultClasses) {
      // Create the class
      await tx.class.create({
        data: {
          name: className, // Class name from DefaultClass enum
          capacity: 30, // Set default capacity, adjust as needed
        },
      });
    }
  }

  async getAllClasses() {
    try {
      return await this.prisma.class.findMany({
        include: {
          students: true,
          lessons: {
            include: {
              teacher: true,
              subject: true,
            },
          },

          subjects: {
            include: {
              lessons: true,
            },
          },
          announcements: true,
        },
      });
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      throw new InternalServerErrorException('Failed to fetch classes');
    }
  }

  async createClass(data: CreateClassInput) {
    return await this.prisma.$transaction(async (tx) => {
      const existingClass = await tx.class.findUnique({
        where: { name: data.name },
      });

      if (existingClass) {
        throw new Error(`Class with this name: ${data.name} already exists`);
      }

      return await tx.class.create({
        data: {
          name: data.name,
          capacity: data.capacity,
          supervisorId: data.supervisorId,
        },
      });
    });
  }

  public async addLessonsToClass(classId: string, lessons: string[]) {
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

  async getClassById(classId: string) {
    const classData = await this.prisma.class.findUnique({
      where: { id: classId },
      include: {
        subjects: {
          include: {
            lessons: true,
          },
        },

        lessons: true,
        students: true,
        supervisor: true,
        exams: true,
        events: true,
        assignments: true,
        announcements: true,
      },
    });
    if (!classData) {
      throw new NotFoundException(`Class with id ${classId} not found`);
    }

    return classData;
  }
}

// TODO Assign teacher to class endpoint
