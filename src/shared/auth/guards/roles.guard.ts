import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
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
      default:
        return false;
    }
  }

  private async handleAdminAccess(user: any, roles: Roles[]): Promise<boolean> {
    return roles.includes(Roles.ADMIN);
  }

  private async handleTeacherAccess(
    user: any,
    ctx: GqlExecutionContext,
  ): Promise<boolean> {
    const args = ctx.getArgs();
    const studentId = args.studentId || args.input?.studentId;

    if (!studentId) return true;

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

  private async handleParentAccess(
    user: any,
    ctx: GqlExecutionContext,
  ): Promise<boolean> {
    const args = ctx.getArgs();
    const studentId = args.studentId || args.input?.studentId;

    if (!studentId) return true;

    const student = await this.prisma.student.findFirst({
      where: {
        id: studentId,
        parentId: user.id,
      },
    });

    return !!student;
  }
}
