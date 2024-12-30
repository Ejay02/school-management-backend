import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/prisma/prisma.service';
import { LoginInput } from './input/login.input';
import { AuthResponse } from './response/auth.response';
import * as bcrypt from 'bcrypt';
import { SignupInput } from './input/signup.input';
import { Roles } from '../enum/role';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async signup(input: SignupInput): Promise<AuthResponse> {
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const {
          username,
          password,
          email,
          role,
          name,
          surname,
          address,
          bloodType,
          sex,
          phone,
          parentId,
          classId,
          gradeId,
        } = input;

        // Check if the username already exists in the relevant model
        let existingUser;
        switch (role) {
          case Roles.ADMIN:
            existingUser = await tx.admin.findUnique({ where: { username } });
            break;
          case Roles.SUPER_ADMIN:
            existingUser = await tx.admin.findUnique({
              where: { username },
            });
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
        if (role === Roles.SUPER_ADMIN) {
          const superAdminCount = await tx.admin.count();
          if (superAdminCount > 0) {
            throw new ConflictException('A SUPER_ADMIN already exists');
          }
        }

        // Hash the password before saving
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create the user based on the role
        let newUser;
        switch (role) {
          case Roles.ADMIN:
          case Roles.SUPER_ADMIN:
            newUser = await tx.admin.create({
              data: { username, password: hashedPassword, email, role },
            });

            break;
          case Roles.TEACHER:
            newUser = await tx.teacher.create({
              data: {
                username,
                password: hashedPassword,
                email,
                role,
                name,
                surname,
                address,
                bloodType,
                sex,
                phone,
              },
            });
            break;
          case Roles.STUDENT:
            newUser = await tx.student.create({
              data: {
                username,
                password: hashedPassword,
                email,
                role,
                name,
                surname,
                address,
                bloodType,
                sex,
                parentId,
                classId,
                gradeId,
              },
            });
            break;
          case Roles.PARENT:
            newUser = await tx.parent.create({
              data: {
                username,
                password: hashedPassword,
                email,
                role,
                name,
                surname,
                phone,
                address,
              },
            });
            break;
        }

        // Generate the token (if this fails, it should trigger rollback)
        const token = this.generateToken(newUser.id, role); // pass role as string

        // Return the token and user ID
        return { token, userId: newUser.id };
      });

      return result;
    } catch (error) {
      throw new Error(`Signup Error: ${error}`);
    }
  }

  async login(input: LoginInput): Promise<AuthResponse> {
    const { username, password } = input;

    const userPromises = [
      this.prisma.admin.findUnique({ where: { username } }),
      this.prisma.teacher.findUnique({ where: { username } }),
      this.prisma.student.findUnique({ where: { username } }),
      this.prisma.parent.findUnique({ where: { username } }),
    ];

    const users = await Promise.all(userPromises);
    const user = users.find((u) => u !== null);

    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const token = this.generateToken(user.id, user.role);
    return { token, userId: user.id };
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
