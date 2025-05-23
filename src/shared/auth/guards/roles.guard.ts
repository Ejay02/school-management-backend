import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { PrismaService } from 'src/prisma/prisma.service';
import { Roles } from 'src/shared/enum/role';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
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

    const operation = ctx.getInfo().operation?.name?.value;
    const fieldName = ctx.getInfo().fieldName;

    // Check if this is an announcement-related operation
    if (
      fieldName === 'createAnnouncement' ||
      operation?.toLowerCase().includes('announcement')
    ) {
      return this.handleAnnouncementAccess(user, ctx);
    }

    // Check if this is an event-related operation
    if (
      (operation &&
        (operation.includes('event') || operation.includes('Event'))) ||
      (fieldName &&
        (fieldName.includes('event') || fieldName.includes('Event')))
    ) {
      return this.handleEventAccess(user, ctx);
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
      const fieldName = ctx.getInfo().fieldName;

      // Define allowed endpoints for teachers
      const allowedEndpoints = [
        'getUserById',
        'getAllTeachers',
        'getAllParents',
        'getAllStudents',
        'getStudentById',
        'getAllClasses',
        'getAllLessons',
        'getLessonById',
        'editLesson',
        'getAllSubjects',
        'updateSubject',
        'deleteSubject',
        'createSubject',
        'getAllExams',
        'getExamById',
        'createExam', // T
        'updateExam', // T
        'deleteExam', //T
        'getAllAssignments',
        'getAssignmentById',
        'createAssignment',
        'deleteAssignment',
        'editAssignment',
        'getAllResults',
        'getClassResults',
        'getResultStatistics',
        'getAttendances',
        'updateTeacherProfile', //T
        'getAllAdminUsers',
      ];

      //
      console.log('Teacher access check - User:', user);
      console.log('Teacher access check - Args:', args);

      console.log('Teacher access check - Field Name:', fieldName);
      console.log(
        'Teacher access check - Allowed Endpoints:',
        allowedEndpoints,
      );
      console.log(
        'Teacher access check - Is in allowed list:',
        allowedEndpoints.includes(fieldName),
      );
      //

      // If accessing getUserById endpoint
      if (fieldName === 'getUserById' && args.id) {
        return true;
      }

      if (allowedEndpoints.includes(fieldName)) {
        return true;
      }

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
        const studentId = args.studentId ?? args.input?.studentId;

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
      const info = ctx.getInfo();
      const fieldName = ctx.getInfo().fieldName;

      // If accessing getUserById endpoint
      if (
        (fieldName === 'getUserById' && args.id) ||
        fieldName === 'getAllTeachers'
      ) {
        return true; // Allow parents to access user information
      }

      // If accessing parent info
      if (args.parentId) {
        return args.parentId === user.id; // Allow if it's their own info
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

      // Allow if the teacher is teaching the parent's child's class
      if (args.teacherId) {
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

      // Handle invoice generation and fee structure access
      if (info.fieldName === 'generateInvoice' && args.feeStructureId) {
        const parentStudents = await this.prisma.student.findMany({
          where: {
            parentId: user.id,
          },
          include: {
            class: true,
          },
        });
        if (!parentStudents)
          throw new Error(`You don't have any child in this class`);

        // Then, check if any of these students' classes have the fee structure
        const feeStructure = await this.prisma.feeStructure.findFirst({
          where: {
            id: args.feeStructureId,
            OR: [
              {
                // Check direct class association
                classes: {
                  some: {
                    students: {
                      some: {
                        parentId: user.id,
                      },
                    },
                  },
                },
              },
              {
                // Check school-wide fee structures

                classes: {
                  some: {
                    students: {
                      some: {
                        parentId: user.id,
                      },
                    },
                  },
                },
              },
            ],
          },
        });

        return !!feeStructure;
      }

      // Handle payment initiation
      if (info.fieldName === 'initiatePayment' && args.invoiceId) {
        const invoice = await this.prisma.invoice.findFirst({
          where: {
            id: args.invoiceId,
            parentId: user.id, // Ensure the invoice belongs to the parent
          },
        });
        return !!invoice; // Allow if the invoice exists and belongs to the parent
      }

      // Handle getting invoices for the parent
      if (info.fieldName === 'getMyInvoices') {
        return user.id === args.parentId; // Allow if parentId matches the user ID
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
      const fieldName = ctx.getInfo().fieldName;

      const allowedEndpoints = ['getAllExams', 'getExamById'];

      // If accessing getUserById endpoint
      if (fieldName === 'getUserById' && args.id) {
        return true; // Allow parents to access user information
      }

      if (allowedEndpoints.includes(fieldName)) {
        return true;
      }

      // If accessing student info
      if (args.studentId || args.input?.studentId) {
        const studentId = args.studentId ?? args.input?.studentId;
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
    const operation = ctx.getInfo().operation?.name?.value;
    const fieldName = ctx.getInfo().fieldName;

    if (fieldName === 'getAllAnnouncements') {
      // Allow access for all authenticated users with valid roles
      // The actual filtering of announcements based on user role is handled in the service
      if (
        [
          Roles.ADMIN,
          Roles.SUPER_ADMIN,
          Roles.TEACHER,
          Roles.PARENT,
          Roles.STUDENT,
        ].includes(user.role)
      ) {
        return true;
      }
    }

    // For creating announcements
    if (fieldName === 'createAnnouncement') {
      // Allow admin and super admin to create any announcement
      if ([Roles.ADMIN, Roles.SUPER_ADMIN].includes(user.role)) {
        return true;
      }

      if (user.role === Roles.TEACHER) {
        if (!args.classId) {
          return false;
        }

        // Check if teacher teaches in this class
        const teacherAccess = await this.prisma.lesson.findFirst({
          where: {
            classId: args.classId,
            teacherId: user.userId,
          },
        });

        // If not teaching, check if they're a supervisor
        if (!teacherAccess) {
          const supervisorAccess = await this.prisma.class.findFirst({
            where: {
              id: args.classId,
              supervisorId: user.userId,
            },
          });

          if (!supervisorAccess) {
            return false;
          }
        }

        // Check target roles if specified
        if (args.targetRoles) {
          const validRolesForTeacher = [Roles.STUDENT, Roles.PARENT];
          const areRolesValid = args.targetRoles.every((role: string) =>
            validRolesForTeacher.includes(role as Roles),
          );

          if (!areRolesValid) {
            throw new Error(' Invalid target roles');
            // return false;
          }
        }

        return true;
      }
    }

    // For getting a specific announcement
    if (args.id) {
      const announcement = await this.prisma.announcement.findUnique({
        where: { id: args.id },
        // include: { teacher: true },
      });

      if (!announcement) {
        throw new Error('Announcement not found. Returning false.');
      }

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
    if (operation?.includes('createAnnouncement')) {
      if (user.role === Roles.TEACHER) {
        // Teachers can only create announcements for their classes
        if (!args.classId) {
          throw new Error(' No classId provided for teacher. Returning false.');
        } // Class ID is required

        // Check if teacher has lessons in the class
        const teachesClass = await this.prisma.lesson.findFirst({
          where: {
            classId: args.classId,
            teacherId: user.id,
          },
        });

        // If not teaching, check if they're a supervisor
        if (!teachesClass) {
          const isSupervisor = await this.prisma.class.findFirst({
            where: {
              id: args.classId,
              supervisorId: user.id,
            },
          });

          if (!isSupervisor) return false;
        }

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

  private async handleEventAccess(
    user: any,
    ctx: GqlExecutionContext,
  ): Promise<boolean> {
    try {
      const args = ctx.getArgs();
      const fieldName = ctx.getInfo().fieldName;

      // Handle createEvent
      if (fieldName === 'createEvent') {
        // For teachers, check class access if classId is provided
        if (user.role === Roles.TEACHER) {
          const classId = args.data?.classId;

          if (!classId) {
            return true; // Allow if no specific class
          }

          // Check if teacher has access to the class
          const teacherClass = await this.prisma.class.findFirst({
            where: {
              id: classId,
              OR: [
                { supervisorId: user.id },
                {
                  subjects: {
                    some: {
                      teachers: {
                        some: { id: user.id },
                      },
                    },
                  },
                },
                // Also check lessons table
                {
                  lessons: {
                    some: {
                      teacherId: user.id,
                    },
                  },
                },
              ],
            },
          });

          return !!teacherClass;
        }

        // Admin and Super Admin can create any event
        if ([Roles.ADMIN, Roles.SUPER_ADMIN].includes(user.role)) {
          return true;
        }

        // Parents and students can create private events
        if ([Roles.PARENT, Roles.STUDENT].includes(user.role)) {
          return true;
        }
      }

      // Handle getEvents and getEventById
      if (fieldName === 'getEvents' || fieldName === 'getEventById') {
        // Allow access for all authenticated users with valid roles
        // The actual filtering of events based on user role is handled in the service
        if (
          [
            Roles.ADMIN,
            Roles.SUPER_ADMIN,
            Roles.TEACHER,
            Roles.PARENT,
            Roles.STUDENT,
          ].includes(user.role)
        ) {
          return true;
        }
      }

      return false;
    } catch (error) {
      throw new InternalServerErrorException(
        'Error in handleEventAccess:',
        error,
      );
    }
  }
}
