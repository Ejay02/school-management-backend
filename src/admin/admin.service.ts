import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from 'src/prisma/prisma.service';
import { LoginInput } from 'src/shared/auth/input/login.input';
import { SignupInput } from 'src/shared/auth/input/signup.input';
import { AuthResponse } from 'src/shared/auth/response/auth.response';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async signup(input: SignupInput): Promise<AuthResponse> {
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        // Check if username already exists
        const existingAdmin = await tx.admin.findUnique({
          where: { username: input.username },
        });

        if (existingAdmin) {
          throw new ConflictException('Username already exists');
        }

        // Check if this is the first admin
        const adminCount = await tx.admin.count();

        const hashedPassword = await bcrypt.hash(input.password, 10);

        // Create a new admin
        const newAdmin = await tx.admin.create({
          data: {
            id: uuidv4(),
            username: input.username,
            password: hashedPassword,
            email: input.email,
            role: adminCount === 0 ? 'SUPER_ADMIN' : 'ADMIN',
          },
        });

        // Generate the token (if this fails, it should trigger rollback)
        const token = this.generateToken(
          newAdmin.id,
          newAdmin.role === 'SUPER_ADMIN',
        );

        // Return the token and user ID
        return { token, userId: newAdmin.id };
      });

      return result;
    } catch (error) {
      // console.error('Signup Error:', error);
      throw new Error(`Signup Error: ${error}`);
      // throw error; // Ensure errors are rethrown for the calling function to handle
    }
  }

  async login(input: LoginInput): Promise<AuthResponse> {
    const admin = await this.prisma.admin.findUnique({
      where: { username: input.username },
    });

    if (!admin || !(await bcrypt.compare(input.password, admin.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const token = this.generateToken(admin.id);

    return {
      token,
      userId: admin.id,
    };
  }

  async assignAdminRole(userId: string): Promise<boolean> {
    try {
      await this.prisma.admin.update({
        where: { id: userId },
        data: { role: 'ADMIN' },
        // data: { isAdmin: true },
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  async getAdminProfile(adminId: string): Promise<AuthResponse> {
    const admin = await this.prisma.admin.findUnique({
      where: { id: adminId },
      select: {
        id: true,
        username: true,
        email: true,
        createdAt: true,
      },
    });

    return {
      userId: admin.id,
      token: '', // or any default value, or generate a token if needed
    };
  }

  private generateToken(userId: string, isFirstAdmin = false): string {
    try {
      return this.jwtService.sign(
        {
          sub: userId,
          role: isFirstAdmin ? 'SUPER_ADMIN' : 'ADMIN',
        },

        {
          secret: process.env.JWT_SECRET,
          expiresIn: '1h',
        },
      );
    } catch (error) {
      console.error('Error generating token:', error);
      // Throw the error to propagate it to the transaction
      throw new Error('Failed to generate token');
    }
  }
}
