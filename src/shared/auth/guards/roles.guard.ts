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

    if (!requiredRoles) return false;

    const ctx = GqlExecutionContext.create(context);
    const user = ctx.getContext().req.user;
    if (!user) throw new ForbiddenException('User not authenticated');

    if (user.role === Roles.SUPER_ADMIN) return true;

    // Check if this is an announcement-related operation
    const operation = ctx.getInfo().operation?.name?.value;
    if (operation && operation.includes('announcement')) {
      return this.handleAnnouncementAccess(user, ctx);
    }

    if (requiredRoles.includes(user.role)) {
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
    return false;
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

      if (args.teacherId) {
        // Allow if the teacher is teaching the parent's child's class
        const teachesChildClass = await this.prisma.lesson.findFirst({
          where: {
            teacherId: args.teacherId,
            class: {
              students: {
                some: {
                  parentId: user.id, // Ensure the parent's child is in the class
                },
              },
            },
          },
        });
        return !!teachesChildClass;
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

      if (args.teacherId) {
        // Allow if the teacher is teaching the student's class
        const teachesStudentClass = await this.prisma.lesson.findFirst({
          where: {
            teacherId: args.teacherId,
            class: {
              students: {
                some: {
                  id: user.id, // Ensure the student is in the class
                },
              },
            },
          },
        });
        return !!teachesStudentClass;
      }

      return false;
    } catch (error) {
      throw new UnauthorizedException('Unauthorized access to student info');
    }
  }

  private async handleAnnouncementAccess(
    user: any,
    ctx: GqlExecutionContext,
  ): Promise<boolean> {
    const args = ctx.getArgs();
    const operation = ctx.getInfo().operation.name.value;

    // For getting a specific announcement
    if (args.id) {
      const announcement = await this.prisma.announcement.findUnique({
        where: { id: args.id },
        // include: { teacher: true },
      });
      if (!announcement) return false;

      switch (user.role) {
        case Roles.TEACHER:
          if (announcement.classId) {
            const teachesClass = await this.prisma.lesson.findFirst({
              where: {
                classId: announcement.classId,
                teacherId: user.id,
              },
            });
            return !!teachesClass;
          }
          return [Roles.TEACHER, Roles.ADMIN].includes(
            announcement.creatorRole as Roles,
          );

        case Roles.PARENT:
          if (announcement.classId) {
            const hasChildInClass = await this.prisma.student.findFirst({
              where: {
                parentId: user.id,
                classId: announcement.classId,
              },
            });
            return !!hasChildInClass;
          }
          return [Roles.PARENT, Roles.ADMIN].includes(
            announcement.creatorRole as Roles,
          );

        case Roles.STUDENT:
          return announcement.classId === user.classId;
      }
    }

    // For creating announcements
    if (operation.includes('create')) {
      if (user.role === Roles.TEACHER) {
        // Teachers can only create announcements for their classes
        if (!args.classId) return false; // Class ID is required
        const teachesClass = await this.prisma.lesson.findFirst({
          where: {
            classId: args.classId,
            teacherId: user.id,
          },
        });
        if (!teachesClass) return false;

        // Check if target roles are valid

        if (args.targetRoles) {
          const validRolesForTeacher = [Roles.STUDENT, Roles.PARENT];

          // Ensure all target roles are valid
          const areRolesValid = args.targetRoles.every((role: string) =>
            validRolesForTeacher.includes(role as Roles),
          );

          if (!areRolesValid) return false;

          // If targeting parents, validate the teacher's association with the class
          if (args.targetRoles.includes(Roles.PARENT)) {
            const hasParentInClass = await this.prisma.student.findFirst({
              where: {
                classId: args.classId,
                parentId: { not: null }, // Ensure parents exist for students in the class
              },
            });

            if (!hasParentInClass) return false; // No parents in the class
          }

          return true;
        }
        // If no specific roles are targeted, assume students in the class
      }

      if ([Roles.ADMIN, Roles.SUPER_ADMIN].includes(user.role)) {
        // Admins and Super Admins can create announcements for specific roles or everyone
        const validRoles = [Roles.TEACHER, Roles.PARENT, Roles.STUDENT];
        if (args.targetRoles) {
          return args.targetRoles.every((role: string) =>
            validRoles.includes(role as Roles),
          );
        }
        return true; // If no specific roles are targeted, assume global access
      }

      return false;
    }

    return false;
  }
}
