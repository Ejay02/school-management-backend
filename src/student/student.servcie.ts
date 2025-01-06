import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/prisma/prisma.service';
import { AssignStudentToClassInput } from './input/assign.student.class.input';

@Injectable()
export class StudentService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async getAllStudents() {
    try {
      return await this.prisma.student.findMany({
        include: {
          parent: true,
          class: true,
          grade: true,
        },
      });
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      throw new InternalServerErrorException('Failed to fetch students');
    }
  }

  async getStudentById(studentId: string) {
    try {
      const student = await this.prisma.student.findUnique({
        where: { id: studentId },
        include: {
          attendances: true,
          results: true,
          submissions: true,
        },
      });

      if (!student) {
        throw new NotFoundException(`Student with ID: ${studentId} not found`);
      }
      return student;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new Error(`Failed to get student: ${error.message}`);
    }
  }

  async assignStudentToClass(input: AssignStudentToClassInput) {
    const { studentId, classId } = input;

    // Check if student exists
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    // Check if class exists and has capacity
    const targetClass = await this.prisma.class.findUnique({
      where: { id: classId },
      include: {
        students: true,
      },
    });

    if (!targetClass) {
      throw new NotFoundException('Class not found');
    }

    if (targetClass.students.length >= targetClass.capacity) {
      throw new BadRequestException('Class has reached maximum capacity');
    }

    // Update student's class assignment
    return this.prisma.student.update({
      where: { id: studentId },
      data: { classId },
      include: {
        class: true,
      },
    });
  }
}
