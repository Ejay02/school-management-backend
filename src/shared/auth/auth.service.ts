import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/prisma/prisma.service';
import { BaseLoginInput } from './input/login.input';
import { AuthResponse } from './response/auth.response';
import * as bcrypt from 'bcrypt';
import {
  AdminSignupInput,
  ParentSignupInput,
  StudentSignupInput,
  TeacherSignupInput,
} from './input/signup.input';
import { Roles } from '../enum/role';
import { v4 as uuidv4 } from 'uuid';
import { ClassService } from 'src/class/class.service';
import { SubjectService } from 'src/subject/subject.service';
import { LessonService } from 'src/lesson/lesson.service';

type SignupInputType =
  | AdminSignupInput
  | TeacherSignupInput
  | StudentSignupInput
  | ParentSignupInput;
@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private classService: ClassService,
    private lessonService: LessonService,
    private subjectService: SubjectService,
  ) {}

  private async validateForeignKeys(tx: any, input: StudentSignupInput) {
    // Validate that parent exists
    const parent = await tx.parent.findUnique({
      where: { id: input.parentId },
    });
    if (!parent) {
      throw new NotFoundException(
        `Parent with ID ${input.parentId} not found. Please verify the parent ID.`,
      );
    }

    // Validate that class exists and has capacity
    const targetClass = await tx.class.findUnique({
      where: { id: input.classId },
      include: {
        students: true,
      },
    });
    if (!targetClass) {
      throw new NotFoundException(
        `Class with ID ${input.classId} not found. Please verify the class ID.`,
      );
    }

    if (targetClass.students.length >= targetClass.capacity) {
      throw new BadRequestException(
        `Class ${targetClass.name} has reached its maximum capacity of ${targetClass.capacity} students.`,
      );
    }
  }

  async signup(input: SignupInputType): Promise<AuthResponse> {
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const { username, password, email, role } = input;

        // Check if the username already exists in the relevant model
        let existingUser;
        switch (role) {
          case Roles.ADMIN:
          case Roles.SUPER_ADMIN:
            existingUser = await tx.admin.findUnique({ where: { username } });
            break;
          case Roles.TEACHER:
            existingUser = await tx.teacher.findUnique({ where: { username } });
            break;
          case Roles.STUDENT:
            existingUser = await tx.student.findUnique({ where: { username } });
            break;
          case Roles.PARENT:
            existingUser = await tx.parent.findUnique({ where: { username } });
            break;
        }

        if (existingUser) {
          throw new ConflictException(
            `${role} with this username ${username} already exists`,
          );
        }

        // Handle SUPER_ADMIN creation (only allow the first SUPER_ADMIN)

        let effectiveRole = role;
        if (role === Roles.ADMIN) {
          const adminCount = await tx.admin.count();
          if (adminCount === 0) {
            // First admin should be SUPER_ADMIN
            effectiveRole = Roles.SUPER_ADMIN;

            // Generate classes/subject
            await this.classService.setDefaultClasses(tx);
            await this.subjectService.generateAllSubjects(tx);
            await this.lessonService.generateAllLessons(tx);
          }
        }

        // Hash the password before saving
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create the user based on the role
        let newUser;
        switch (effectiveRole) {
          case Roles.ADMIN:
          case Roles.SUPER_ADMIN:
            newUser = await tx.admin.create({
              data: {
                username,
                password: hashedPassword,
                email,
                role: effectiveRole,
              },
            });
            break;

          case Roles.TEACHER:
            const teacherInput = input as TeacherSignupInput;
            newUser = await tx.teacher.create({
              data: {
                username,
                password: hashedPassword,
                email,
                role,
                name: teacherInput.name,
                surname: teacherInput.surname,
                // address: teacherInput.address,
                // bloodType: teacherInput.bloodType,
                // sex: teacherInput.sex,
                // phone: teacherInput.phone,
              },
            });
            break;

          case Roles.STUDENT:
            const studentInput = input as StudentSignupInput;

            await this.validateForeignKeys(tx, studentInput);

            newUser = await tx.student.create({
              data: {
                username,
                password: hashedPassword,
                email,
                role,
                name: studentInput.name,
                surname: studentInput.surname,
                // address: studentInput.address,
                // bloodType: studentInput.bloodType,
                // sex: studentInput.sex,
                parentId: studentInput.parentId,
                classId: studentInput.classId,
                // gradeId: '0',
              },
            });
            break;

          case Roles.PARENT:
            const parentInput = input as ParentSignupInput;
            newUser = await tx.parent.create({
              data: {
                username,
                password: hashedPassword,
                email,
                role,
                name: parentInput.name,
                surname: parentInput.surname,
                // phone: parentInput.phone,
                // address: parentInput.address,
              },
            });
            break;
        }

        // Generate the token (if this fails, it should trigger rollback)
        const token = this.generateAccessToken(newUser.id, role);

        // Build the response object with all fields
        const authResponse: AuthResponse = {
          token,

          userId: newUser.id,
          role: effectiveRole,
          username: newUser.username,
          name: newUser.name || null,
          surname: newUser.surname || null,
          email: newUser.email || null,
          // address: newUser.address || null,
          // phone: newUser.phone || null,
          // bloodType: newUser.bloodType || null,
          // sex: newUser.sex || null,
          parentId: newUser.parentId || null,
          classId: newUser.classId || null,
        };
        return authResponse;
      });

      return result;
    } catch (error) {
      throw new Error(`Signup Error: ${error}`);
    }
  }
  async login(input: BaseLoginInput): Promise<AuthResponse> {
    const { username, password } = input;

    // Find user based on role if provided
    let user = null;
    if ('role' in input) {
      switch (input.role) {
        case Roles.ADMIN:
        case Roles.SUPER_ADMIN:
          user = await this.prisma.admin.findUnique({ where: { username } });
          break;
        case Roles.TEACHER:
          user = await this.prisma.teacher.findUnique({ where: { username } });
          break;
        case Roles.STUDENT:
          user = await this.prisma.student.findUnique({ where: { username } });
          break;
        case Roles.PARENT:
          user = await this.prisma.parent.findUnique({ where: { username } });
          break;
      }
    } else {
      // Fallback to checking all tables if role not specified
      const userPromises = [
        this.prisma.admin.findUnique({ where: { username } }),
        this.prisma.teacher.findUnique({ where: { username } }),
        this.prisma.student.findUnique({ where: { username } }),
        this.prisma.parent.findUnique({ where: { username } }),
      ];
      const users = await Promise.all(userPromises);
      user = users.find((u) => u !== null);
    }

    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const token = this.generateAccessToken(user.id, user.role);
    const refreshToken = await this.generateRefreshToken(user.id);

    const authResponse: AuthResponse = {
      token,
      refreshToken,
      userId: user.id,
      role: user.role,
      username: user.username,
      name: user.name || null,
      surname: user.surname || null,
      email: user.email || null,
      address: user.address || null,
      phone: user.phone || null,
      bloodType: user.bloodType || null,
      sex: user.sex || null,
      parentId: user.parentId || null,
      classId: user.classId || null,
      gradeId: user.gradeId || null,
    };

    return authResponse;
  }

  private generateAccessToken(userId: string, role: string): string {
    try {
      return this.jwtService.sign(
        {
          sub: userId,
          role,
        },

        {
          secret: process.env.JWT_SECRET,
          expiresIn: '12h',
        },
      );
    } catch (error) {
      // Throw the error to propagate it to the transaction
      throw new Error('Failed to generate token');
    }
  }

  private async generateRefreshToken(userId: string): Promise<string> {
    // Delete any existing refresh tokens for this user
    await this.prisma.refreshToken.deleteMany({
      where: { userId },
    });

    const token = uuidv4();
    const expires = new Date();
    expires.setDate(expires.getDate() + 7); // 7 days refresh token

    await this.prisma.refreshToken.create({
      data: {
        token,
        userId,
        expires,
      },
    });

    return token;
  }

  async refreshTokens(refreshToken: string) {
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      // include: { user: true },
    });

    if (!storedToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (new Date() > storedToken.expires) {
      await this.prisma.refreshToken.delete({
        where: { token: refreshToken },
      });
      throw new UnauthorizedException('Refresh token expired');
    }

    // Get user
    const user = await this.prisma.admin.findUnique({
      where: { id: storedToken.userId },
    });

    // Generate new tokens
    const newAccessToken = this.generateAccessToken(user.id, user.role);
    const newRefreshToken = await this.generateRefreshToken(user.id);

    // Delete old refresh token
    await this.prisma.refreshToken.delete({
      where: { token: refreshToken },
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  async logout(refreshToken: string) {
    await this.prisma.refreshToken.delete({
      where: { token: refreshToken },
    });
  }

  async resetPassword(
    username: string,
    newPassword: string,
    role?: Roles,
  ): Promise<AuthResponse> {
    // Find user based on username and role
    let user = null;
    if (role) {
      switch (role) {
        case Roles.ADMIN:
        case Roles.SUPER_ADMIN:
          user = await this.prisma.admin.findUnique({ where: { username } });
          break;
        case Roles.TEACHER:
          user = await this.prisma.teacher.findUnique({ where: { username } });
          break;
        case Roles.STUDENT:
          user = await this.prisma.student.findUnique({ where: { username } });
          break;
        case Roles.PARENT:
          user = await this.prisma.parent.findUnique({ where: { username } });
          break;
      }
    } else {
      // Check all tables if role not specified
      const userPromises = [
        this.prisma.admin.findUnique({ where: { username } }),
        this.prisma.teacher.findUnique({ where: { username } }),
        this.prisma.student.findUnique({ where: { username } }),
        this.prisma.parent.findUnique({ where: { username } }),
      ];
      const users = await Promise.all(userPromises);
      user = users.find((u) => u !== null);
    }

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password in the appropriate table
    let updatedUser = null;
    switch (user.role) {
      case Roles.ADMIN:
      case Roles.SUPER_ADMIN:
        updatedUser = await this.prisma.admin.update({
          where: { username },
          data: { password: hashedPassword },
        });
        break;
      case Roles.TEACHER:
        updatedUser = await this.prisma.teacher.update({
          where: { username },
          data: { password: hashedPassword },
        });
        break;
      case Roles.STUDENT:
        updatedUser = await this.prisma.student.update({
          where: { username },
          data: { password: hashedPassword },
        });
        break;
      case Roles.PARENT:
        updatedUser = await this.prisma.parent.update({
          where: { username },
          data: { password: hashedPassword },
        });
        break;
    }

    // Generate new tokens
    const token = this.generateAccessToken(updatedUser.id, updatedUser.role);
    const refreshToken = await this.generateRefreshToken(updatedUser.id);

    return {
      token,
      refreshToken,
      userId: updatedUser.id,
      role: updatedUser.role,
      username: updatedUser.username,
      name: updatedUser.name || null,
      surname: updatedUser.surname || null,
      email: updatedUser.email || null,
      address: updatedUser.address || null,
      phone: updatedUser.phone || null,
      bloodType: updatedUser.bloodType || null,
      sex: updatedUser.sex || null,
      parentId: updatedUser.parentId || null,
      classId: updatedUser.classId || null,
      gradeId: updatedUser.gradeId || null,
    };
  }
}
