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
import { UpdateStudentAdminInput } from './input/update-student-admin.input';
import { CreateStudentAdminInput } from './input/create-student-admin.input';
import { MailService } from 'src/mail/mail.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class StudentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly cloudinaryService: CloudinaryService,
    private readonly mailService: MailService,
  ) {}

  private normalizePersonName(value: string) {
    const collapsed = value
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase();

    let normalized = '';
    let shouldCapitalize = true;

    for (const char of collapsed) {
      if (shouldCapitalize) {
        normalized += char.toLocaleUpperCase();
      } else {
        normalized += char;
      }

      shouldCapitalize =
        char === ' ' || char === '-' || char === "'" || char === '.';
    }

    return normalized;
  }

  private normalizeSchoolDomain(value: unknown): string | null {
    const base = typeof value === 'string' ? value : '';
    const trimmed = base.trim().toLowerCase().replace(/^@/, '');
    return trimmed.length ? trimmed : null;
  }

  private normalizeNamePart(value: unknown): string {
    const base = typeof value === 'string' ? value : '';
    return base
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  }

  private formatDisplayName(
    name?: string | null,
    surname?: string | null,
    fallback = 'there',
  ) {
    const fullName = [name, surname].filter(Boolean).join(' ').trim();
    return fullName || fallback;
  }

  private buildParentPortalUrl() {
    const raw = process.env.FRONTEND_URL?.trim();
    if (!raw) return null;

    const base = raw.endsWith('/') ? raw.slice(0, -1) : raw;
    return `${base}/parent`;
  }

  private buildStudentPasswordSetupUrl(token: string) {
    const raw = process.env.FRONTEND_URL?.trim();
    if (!raw) return null;

    const base = raw.endsWith('/') ? raw.slice(0, -1) : raw;
    return `${base}/setup-student-password?token=${encodeURIComponent(token)}`;
  }

  private async createStudentPasswordSetupToken(studentUserId: string) {
    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.passwordSetupToken.updateMany({
      where: {
        userId: studentUserId,
        role: Roles.STUDENT as any,
        purpose: 'STUDENT_PASSWORD_SETUP' as any,
        usedAt: null,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      data: { revokedAt: now },
    });

    const token = uuidv4();
    const record = await this.prisma.passwordSetupToken.create({
      data: {
        token,
        purpose: 'STUDENT_PASSWORD_SETUP' as any,
        userId: studentUserId,
        role: Roles.STUDENT as any,
        expiresAt,
      },
      select: { token: true, expiresAt: true },
    });

    return record;
  }

  private async notifyParentAboutCreatedStudent(
    student: {
      name?: string | null;
      surname?: string | null;
      username?: string | null;
      studentId?: string | null;
      institutionalEmail?: string | null;
      class?: { name?: string | null } | null;
      parent?: {
        email?: string | null;
        name?: string | null;
        surname?: string | null;
      } | null;
    },
    options?: { setupUrl?: string | null; setupExpiresAt?: Date | null },
  ) {
    const parentEmail = student.parent?.email?.trim();
    if (!parentEmail) return;

    try {
      const setupState = await this.prisma.setupState.upsert({
        where: { id: 'default' },
        update: {},
        create: { id: 'default' },
        select: { schoolName: true },
      });

      const schoolName =
        typeof setupState.schoolName === 'string' &&
        setupState.schoolName.trim().length
          ? setupState.schoolName.trim()
          : 'your school';

      const studentName = this.formatDisplayName(
        student.name,
        student.surname,
        'your child',
      );

      await this.mailService.sendMail({
        to: parentEmail,
        subject: `${schoolName}: ${studentName} was added to your parent account`,
        template: 'parent.student-created.hbs',
        context: {
          parentName: this.formatDisplayName(
            student.parent?.name,
            student.parent?.surname,
            'Parent',
          ),
          schoolName,
          studentName,
          studentUsername: student.username || 'Not assigned',
          studentId: student.studentId || 'Pending',
          className: student.class?.name || 'Unassigned',
          institutionalEmail: student.institutionalEmail || '',
          hasInstitutionalEmail: Boolean(student.institutionalEmail),
          portalUrl: this.buildParentPortalUrl() || '',
          hasPortalUrl: Boolean(this.buildParentPortalUrl()),
          setupUrl: options?.setupUrl || '',
          hasSetupUrl: Boolean(options?.setupUrl),
          setupExpiresAt: options?.setupExpiresAt || null,
        },
        mailType: 'onboarding',
      });
    } catch {
      // Email delivery should not block student creation.
    }
  }

  private async claimNextSequence(
    tx: any,
    field: 'nextStudentSequence' | 'nextTeacherSequence' | 'nextAdminSequence',
  ): Promise<number> {
    const updated = await tx.setupState.update({
      where: { id: 'default' },
      data: { [field]: { increment: 1 } },
      select: { [field]: true } as any,
    });

    const value = Number(updated[field]);
    return value - 1;
  }

  private async generateStudentId(tx: any): Promise<string> {
    const year = new Date().getFullYear();
    const sequence = await this.claimNextSequence(tx, 'nextStudentSequence');
    return `STU-${year}-${String(sequence).padStart(4, '0')}`;
  }

  private async generateInstitutionalEmail(
    tx: any,
    name: string,
    surname: string,
    schoolDomain: string | null,
  ): Promise<string | null> {
    if (!schoolDomain) return null;

    const firstToken = String(name || '')
      .trim()
      .split(/\s+/)
      .find(Boolean);
    const lastToken = String(surname || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .pop();

    const firstInitial = this.normalizeNamePart(firstToken).slice(0, 1);
    const lastName = this.normalizeNamePart(lastToken);
    if (!firstInitial || !lastName) return null;

    const base = `${firstInitial}.${lastName}`;
    for (let n = 0; n < 1000; n++) {
      const suffix = n === 0 ? '' : String(n);
      const candidate = `${base}${suffix}@${schoolDomain}`;

      const [teacher, student] = await Promise.all([
        tx.teacher.findFirst({
          where: {
            OR: [{ institutionalEmail: candidate }, { email: candidate }],
          },
          select: { id: true },
        }),
        tx.student.findFirst({
          where: {
            OR: [{ institutionalEmail: candidate }, { email: candidate }],
          },
          select: { id: true },
        }),
      ]);

      if (!teacher && !student) return candidate;
    }

    throw new BadRequestException('Unable to generate a unique email address');
  }

  private async getTeacherClassIds(teacherId: string): Promise<string[]> {
    const classes = await this.prisma.class.findMany({
      where: {
        OR: [
          { supervisorId: teacherId },
          { lessons: { some: { teacherId } } },
          { subjects: { some: { teachers: { some: { id: teacherId } } } } },
        ],
      },
      select: { id: true },
    });

    return classes.map((c) => c.id);
  }

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
          const classIds = await this.getTeacherClassIds(userId);
          baseQuery.where = {
            classId: {
              in: classIds,
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
          whereClause.classId = {
            in: await this.getTeacherClassIds(userId),
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
        params?.page !== undefined
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

  async adminSendStudentPasswordSetupLink(studentId: string) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: { parent: true, class: true },
    });

    if (!student) {
      throw new NotFoundException(`Student with ID ${studentId} not found`);
    }

    const parentEmail = student.parent?.email?.trim();
    if (!parentEmail) {
      throw new BadRequestException('Selected parent does not have an email');
    }

    const tokenRecord = await this.createStudentPasswordSetupToken(student.id);
    await this.notifyParentAboutCreatedStudent(student, {
      setupUrl: this.buildStudentPasswordSetupUrl(tokenRecord.token),
      setupExpiresAt: tokenRecord.expiresAt,
    });
  }

  async adminCreateStudent(input: CreateStudentAdminInput) {
    try {
      const rawPassword =
        typeof input.password === 'string' ? input.password : '';
      const isPasswordProvided = rawPassword.trim().length > 0;

      const createdStudent = await this.prisma.$transaction(async (tx) => {
        const normalizedName = this.normalizePersonName(input.name);
        const normalizedSurname = this.normalizePersonName(input.surname);
        const username = String(input.username || '').trim();

        if (!username) {
          throw new BadRequestException('Username is required');
        }

        const [existingStudentUsername, existingParent, existingClass] =
          await Promise.all([
            tx.student.findUnique({
              where: { username },
              select: { id: true },
            }),
            tx.parent.findUnique({
              where: { id: input.parentId },
              include: {
                students: {
                  select: { id: true },
                },
              },
            }),
            tx.class.findUnique({
              where: { id: input.classId },
              include: {
                students: {
                  select: { id: true },
                },
              },
            }),
          ]);

        if (existingStudentUsername) {
          throw new BadRequestException('Username is already in use');
        }

        if (!existingParent) {
          throw new NotFoundException(
            `Parent with ID ${input.parentId} not found`,
          );
        }

        if (!existingClass) {
          throw new NotFoundException(
            `Class with ID ${input.classId} not found`,
          );
        }

        if (existingClass.students.length >= existingClass.capacity) {
          throw new BadRequestException(
            `Class ${existingClass.name} has reached maximum capacity`,
          );
        }

        await tx.setupState.upsert({
          where: { id: 'default' },
          update: {},
          create: { id: 'default' },
        });

        const setupState = await tx.setupState.findUnique({
          where: { id: 'default' },
          select: { schoolDomain: true },
        });

        const schoolDomain = this.normalizeSchoolDomain(
          setupState?.schoolDomain,
        );
        const passwordToHash = isPasswordProvided
          ? rawPassword
          : `${uuidv4()}${uuidv4()}`;
        const hashedPassword = await bcrypt.hash(passwordToHash, 10);
        const studentId = await this.generateStudentId(tx);
        const institutionalEmail = await this.generateInstitutionalEmail(
          tx,
          normalizedName,
          normalizedSurname,
          schoolDomain,
        );

        return tx.student.create({
          data: {
            studentId,
            username,
            password: hashedPassword,
            role: Roles.STUDENT,
            name: normalizedName,
            surname: normalizedSurname,
            email: input.email?.trim() || null,
            phone: input.phone?.trim() || null,
            address: input.address?.trim() || null,
            parentId: existingParent.id,
            classId: existingClass.id,
            institutionalEmail,
          },
          include: {
            parent: true,
            class: true,
          },
        });
      });

      if (isPasswordProvided) {
        await this.notifyParentAboutCreatedStudent(createdStudent);
        return createdStudent;
      }

      const tokenRecord = await this.createStudentPasswordSetupToken(
        createdStudent.id,
      );
      await this.notifyParentAboutCreatedStudent(createdStudent, {
        setupUrl: this.buildStudentPasswordSetupUrl(tokenRecord.token),
        setupExpiresAt: tokenRecord.expiresAt,
      });
      return createdStudent;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      const prismaCode = (error as any)?.code;
      if (prismaCode === 'P2002') {
        throw new BadRequestException(
          'Username, email, or phone number is already in use',
        );
      }
      if (prismaCode === 'P2003') {
        throw new BadRequestException(
          'Selected parent or class does not exist',
        );
      }

      throw new InternalServerErrorException('Failed to create student');
    }
  }

  async adminUpdateStudent(studentId: string, input: UpdateStudentAdminInput) {
    try {
      const existingStudent = await this.prisma.student.findUnique({
        where: { id: studentId },
        select: { id: true },
      });

      if (!existingStudent) {
        throw new NotFoundException(`Student with ID ${studentId} not found`);
      }

      if (input.parentId) {
        const parentExists = await this.prisma.parent.findUnique({
          where: { id: input.parentId },
          select: { id: true },
        });

        if (!parentExists) {
          throw new NotFoundException(
            `Parent with ID ${input.parentId} not found`,
          );
        }
      }

      if (input.classId) {
        const classExists = await this.prisma.class.findUnique({
          where: { id: input.classId },
          select: { id: true },
        });

        if (!classExists) {
          throw new NotFoundException(
            `Class with ID ${input.classId} not found`,
          );
        }
      }

      return await this.prisma.student.update({
        where: { id: studentId },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.surname !== undefined ? { surname: input.surname } : {}),
          ...(input.studentId !== undefined
            ? { studentId: input.studentId }
            : {}),
          ...(input.phone !== undefined ? { phone: input.phone } : {}),
          ...(input.address !== undefined ? { address: input.address } : {}),
          ...(input.parentId !== undefined ? { parentId: input.parentId } : {}),
          ...(input.classId !== undefined ? { classId: input.classId } : {}),
        },
        include: {
          parent: true,
          class: true,
        },
      });
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      const prismaCode = (error as any)?.code;
      if (prismaCode === 'P2002') {
        throw new BadRequestException(
          'Student ID or phone number is already in use',
        );
      }
      if (prismaCode === 'P2003') {
        throw new BadRequestException(
          'Selected parent or class does not exist',
        );
      }

      throw new InternalServerErrorException('Failed to update student');
    }
  }
}
