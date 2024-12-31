import {
  ConflictException,
  Injectable,
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
  ) {}

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
                address: teacherInput.address,
                bloodType: teacherInput.bloodType,
                sex: teacherInput.sex,
                phone: teacherInput.phone,
              },
            });
            break;

          case Roles.STUDENT:
            const studentInput = input as StudentSignupInput;
            newUser = await tx.student.create({
              data: {
                username,
                password: hashedPassword,
                email,
                role,
                name: studentInput.name,
                surname: studentInput.surname,
                address: studentInput.address,
                bloodType: studentInput.bloodType,
                sex: studentInput.sex,
                parentId: studentInput.parentId,
                classId: studentInput.classId,
                gradeId: studentInput.gradeId,
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
                phone: parentInput.phone,
                address: parentInput.address,
              },
            });
            break;
        }

        // Generate the token (if this fails, it should trigger rollback)
        const token = this.generateToken(newUser.id, role);

        // Build the response object with all fields
        const authResponse: AuthResponse = {
          token,
          userId: newUser.id,
          role: effectiveRole,
          username: newUser.username,
          name: newUser.name || null,
          surname: newUser.surname || null,
          email: newUser.email || null,
          address: newUser.address || null,
          phone: newUser.phone || null,
          bloodType: newUser.bloodType || null,
          sex: newUser.sex || null,
          parentId: newUser.parentId || null,
          classId: newUser.classId || null,
          gradeId: newUser.gradeId || null,
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

    const token = this.generateToken(user.id, user.role);

    const authResponse: AuthResponse = {
      token,
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

  private generateToken(userId: string, role: string): string {
    try {
      return this.jwtService.sign(
        {
          sub: userId,
          role,
        },

        {
          secret: process.env.JWT_SECRET,
          expiresIn: '1h',
        },
      );
    } catch (error) {
      // Throw the error to propagate it to the transaction
      throw new Error('Failed to generate token');
    }
  }
}
