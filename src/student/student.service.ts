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
import { UpdateProfileInput } from 'src/shared/inputs/profile-update.input';
import * as bcrypt from 'bcrypt';
import { CloudinaryService } from 'src/shared/cloudinary/services/cloudinary.service';

@Injectable()
export class StudentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  async getAllStudents(
    userId: string,
    userRole: Roles,
    params?: PaginationParams,
  ) {
    try {
      const baseInclude = {
        parent: true,
        class: {
          include: {
            lessons: {
              include: {
                attendances: true,
              },
            },
          },
        },
        result: true,
        attendances: true,
      };

      const baseQuery: any = {
        include: baseInclude,
        orderBy: { createdAt: 'desc' },
      };

      const searchFields = ['name', 'email', 'studentId'];

      switch (userRole) {
        case Roles.SUPER_ADMIN:
        case Roles.ADMIN:
          // Admins can see all students
          break;

        case Roles.TEACHER: {
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
        }

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
          result: true,
          submissions: true,
          class: {
            include: {
              lessons: {
                include: {
                  attendances: true,
                },
              },
            },
          },
          parent: true,
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

  async getStudentsByGender(
    userId: string,
    userRole: Roles,
    params?: PaginationParams,
    classId?: string,
  ) {
    try {
      // Base include for student details
      const baseInclude = {
        parent: true,
        class: true,
        result: true,
      };

      // Initialize where clause
      const whereClause: any = {};

      // Add class filter if provided
      if (classId) {
        whereClause.classId = classId;
      }

      // Apply role-based restrictions
      switch (userRole) {
        case Roles.SUPER_ADMIN:
        case Roles.ADMIN:
          break;
        case Roles.TEACHER:
          const teacherClasses = await this.prisma.class.findMany({
            where: { id: userId },
            select: { id: true },
          });
          whereClause.classId = {
            in: teacherClasses.map((c) => c.id),
          };
          break;
        case Roles.PARENT:
          whereClause.parentId = userId;
          break;
        case Roles.STUDENT:
          whereClause.id = userId;
          break;
        default:
          throw new ForbiddenException(
            'You do not have permission to view students',
          );
      }

      // Get total capacity
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

      // Get gender counts and student list in parallel
      const [maleCount, femaleCount, studentList] = await Promise.all([
        this.prisma.student.count({ where: { ...whereClause, sex: 'MALE' } }),
        this.prisma.student.count({ where: { ...whereClause, sex: 'FEMALE' } }),
        params && params.page !== undefined
          ? PrismaQueryBuilder.paginateResponse(
              this.prisma.student,
              {
                include: baseInclude,
                where: whereClause,
              },
              params,
              ['name', 'email', 'studentId'],
            )
          : this.prisma.student.findMany({
              include: baseInclude,
              where: whereClause,
            }),
      ]);

      // Calculate statistics
      const totalStudents = maleCount + femaleCount;
      const baselineCapacity = totalCapacity / 2;
      const malePercentage = (maleCount / baselineCapacity) * 100;
      const femalePercentage = (femaleCount / baselineCapacity) * 100;

      // Return combined response
      return {
        statistics: {
          totalStudents,
          maleCount,
          femaleCount,
          malePercentage: Number(malePercentage.toFixed(1)),
          femalePercentage: Number(femalePercentage.toFixed(1)),
          totalCapacity,
        },
        students: studentList,
      };
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      throw new InternalServerErrorException(
        'Failed to fetch student gender statistics and list',
      );
    }
  }

  async updateStudentProfile(
    id: string,
    input: UpdateProfileInput,
    file?: Express.Multer.File,
  ) {
    try {
      // Upload image if provided
      let imageUrl = input.image;
      if (file) {
        // Get the current student to check if they have an existing image
        const student = await this.prisma.student.findUnique({
          where: { id },
          select: { image: true },
        });

        // Delete old image if exists
        if (student?.image) {
          try {
            const publicId = this.cloudinaryService.getPublicIdFromUrl(
              student.image,
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
          'student-profiles',
        );
      }

      // Hash password if provided
      let passwordData = {};
      if (input.password) {
        const hashedPassword = await bcrypt.hash(input.password, 10);
        passwordData = { password: hashedPassword };
      }

      // Update student profile
      return this.prisma.student.update({
        where: { id },
        data: {
          ...input,
          ...passwordData,
          image: imageUrl,
        },
      });
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to update student profile: ${error.message}`,
      );
    }
  }
}
