import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { PrismaService } from 'src/prisma/prisma.service';
import { Roles } from 'src/shared/enum/role';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.get<Roles[]>(
      'roles',
      context.getHandler(),
    );
    if (!requiredRoles) return true;

    const ctx = GqlExecutionContext.create(context);
    const user = ctx.getContext().req.user;
    if (!user) throw new ForbiddenException('User not authenticated');

    if (user.role === Roles.SUPER_ADMIN) return true;

    switch (user.role) {
      case Roles.ADMIN:
        return this.handleAdminAccess(user, requiredRoles);
      case Roles.TEACHER:
        return this.handleTeacherAccess(user, ctx);
      case Roles.PARENT:
        return this.handleParentAccess(user, ctx);
      case Roles.STUDENT:
        return this.handleStudentAccess(user, ctx);
      default:
        return false;
    }
  }

  private async handleAdminAccess(user: any, roles: Roles[]): Promise<boolean> {
    return roles.includes(Roles.ADMIN) || roles.includes(Roles.SUPER_ADMIN);
  }

  private async handleTeacherAccess(
    user: any,
    ctx: GqlExecutionContext,
  ): Promise<boolean> {
    try {
      const args = ctx.getArgs();

      // If accessing parent info
      if (args.parentId) {
        // Allow if the parent has students in teacher's classes
        const hasStudentWithParent = await this.prisma.student.findFirst({
          where: {
            parentId: args.parentId,
            class: {
              lessons: {
                some: {
                  teacherId: user.id,
                },
              },
            },
          },
        });
        return !!hasStudentWithParent;
      }
      // If accessing student info
      if (args.studentId || args.input?.studentId) {
        const studentId = args.studentId || args.input?.studentId;
        // Allow if student is in teacher's classes
        const student = await this.prisma.student.findFirst({
          where: {
            id: studentId,
            class: {
              lessons: {
                some: {
                  teacherId: user.id,
                },
              },
            },
          },
        });
        return !!student;
      }

      // If accessing own info (teacher's profile)
      if (args.teacherId) {
        return args.teacherId === user.id;
      }

      return false;
    } catch (error) {
      throw new UnauthorizedException('Unauthorized access to teacher info');
    }
  }

  private async handleParentAccess(
    user: any,
    ctx: GqlExecutionContext,
  ): Promise<boolean> {
    try {
      const args = ctx.getArgs();

      // If accessing parent info
      if (args.parentId) {
        // Allow if it's their own info
        return args.parentId === user.id;
      }

      // If accessing student info
      if (args.studentId || args.input?.studentId) {
        const studentId = args.studentId || args.input?.studentId;
        // Allow if it's their child
        const student = await this.prisma.student.findFirst({
          where: {
            id: studentId,
            parentId: user.id,
          },
        });
        return !!student;
      }

      return false;
    } catch (error) {
      throw new UnauthorizedException('Unauthorized access to parent info');
    }
  }

  private async handleStudentAccess(
    user: any,
    ctx: GqlExecutionContext,
  ): Promise<boolean> {
    try {
      const args = ctx.getArgs();

      // If accessing student info
      if (args.studentId || args.input?.studentId) {
        const studentId = args.studentId || args.input?.studentId;
        // Allow if it's their own info
        return studentId === user.id;
      }

      // If accessing parent info
      if (args.parentId) {
        // Allow if it's their parent
        const student = await this.prisma.student.findFirst({
          where: {
            id: user.id,
            parentId: args.parentId,
          },
        });
        return !!student;
      }

      return false;
    } catch (error) {
      throw new UnauthorizedException('Unauthorized access to student info');
    }
  }
}
