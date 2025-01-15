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
import { PaginationParams } from 'src/shared/pagination/types/pagination.types';
import { Roles } from 'src/shared/enum/role';
import { PrismaQueryBuilder } from 'src/shared/pagination/utils/prisma.pagination';

@Injectable()
export class StudentService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async getAllStudents(
    userId: string,
    userRole: Roles,
    params?: PaginationParams,
  ) {
    try {
      const baseInclude = {
        parent: true,
        class: true,
        grade: true,
      };

      const baseQuery: any = {
        include: baseInclude,
      };

      const searchFields = ['name', 'email', 'studentId'];

      switch (userRole) {
        case Roles.SUPER_ADMIN:
        case Roles.ADMIN:
          // Admins can see all students
          break;

        case Roles.TEACHER:
          // Teachers can only see students in their assigned classes
          const teacherClasses = await this.prisma.class.findMany({
            where: {
              id: userId,
            },
            select: {
              id: true,
            },
          });

          baseQuery.where = {
            classId: {
              in: teacherClasses.map((c) => c.id),
            },
          };
          break;

        case Roles.PARENT:
          // Parents can only see their own children
          baseQuery.where = {
            parentId: userId,
          };
          break;

        case Roles.STUDENT:
          // Students should only see their own profile
          baseQuery.where = {
            id: userId,
          };
          break;

        default:
          throw new ForbiddenException(
            'You do not have permission to view students',
          );
      }

      return await PrismaQueryBuilder.paginateResponse(
        this.prisma.student,
        baseQuery,
        params,
        searchFields,
      );
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

  async getStudentGenderStatistics(
    userId: string,
    userRole: Roles,
    classId?: string,
  ) {
    try {
      // Define the query filter
      const whereClause: any = {};

      // Add class filter if provided
      if (classId) {
        whereClause.classId = classId;
      }

      // Get total capacity based on class or school
      const totalCapacity = classId
        ? (
            await this.prisma.class.findUnique({
              where: { id: classId },
              select: { capacity: true },
            })
          )?.capacity || 0
        : (
            await this.prisma.class.findMany({
              select: { capacity: true },
            })
          ).reduce((sum, cls) => sum + cls.capacity, 0);

      if (totalCapacity === 0) {
        throw new Error('No capacity found for the given class or school.');
      }

      // Calculate student counts
      const [maleCount, femaleCount] = await Promise.all([
        this.prisma.student.count({ where: { ...whereClause, sex: 'MALE' } }),
        this.prisma.student.count({ where: { ...whereClause, sex: 'FEMALE' } }),
      ]);

      // Total students
      const totalStudents = maleCount + femaleCount;

      // Define baseline for male and female percentages
      const baselineCapacity = totalCapacity / 2;

      // Calculate percentages relative to capacity
      const malePercentage = (maleCount / baselineCapacity) * 100;
      const femalePercentage = (femaleCount / baselineCapacity) * 100;

      return {
        totalStudents,
        maleCount,
        femaleCount,
        malePercentage: Number(malePercentage.toFixed(1)),
        femalePercentage: Number(femalePercentage.toFixed(1)),
      };
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      throw new InternalServerErrorException(
        'Failed to fetch student gender statistics',
      );
    }
  }

  // Add a method to filter students by sex
  async getStudentsBySex(
    userId: string,
    userRole: Roles,
    sex: 'MALE' | 'FEMALE',
    params?: PaginationParams,
  ) {
    try {
      const baseInclude = {
        parent: true,
        class: true,
        grade: true,
      };

      const baseQuery: any = {
        include: baseInclude,
        where: { sex },
      };

      const searchFields = ['name', 'email', 'studentId'];

      // Apply the same role-based restrictions
      switch (userRole) {
        case Roles.SUPER_ADMIN:
        case Roles.ADMIN:
          break;
        case Roles.TEACHER:
          const teacherClasses = await this.prisma.class.findMany({
            where: { id: userId },
            select: { id: true },
          });
          baseQuery.where.classId = {
            in: teacherClasses.map((c) => c.id),
          };
          break;
        case Roles.PARENT:
          baseQuery.where.parentId = userId;
          break;
        case Roles.STUDENT:
          baseQuery.where.id = userId;
          break;
        default:
          throw new ForbiddenException(
            'You do not have permission to view students',
          );
      }

      return await PrismaQueryBuilder.paginateResponse(
        this.prisma.student,
        baseQuery,
        params,
        searchFields,
      );
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      throw new InternalServerErrorException('Failed to fetch students');
    }
  }
}
