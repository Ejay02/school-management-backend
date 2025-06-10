import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AttendanceService } from './attendance.service';
import { JwtAuthGuard } from '../shared/auth/guards/jwtAuth.guard';
import { RolesGuard } from '../shared/auth/guards/roles.guard';
import { UseGuards } from '@nestjs/common';
import { HasRoles } from '../shared/auth/decorators/roles.decorator';
import { Roles } from '../shared/enum/role';
import { Attendance } from './types/attendance.types';
import { MarkAttendanceInput } from './input/attendance.input';

import { SchoolAttendanceStats } from './types/attendance.stat.types';

@Resolver()
@UseGuards(JwtAuthGuard, RolesGuard)
export class AttendanceResolver {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Query(() => [Attendance])
  @HasRoles(
    Roles.ADMIN,
    Roles.TEACHER,
    Roles.SUPER_ADMIN,
    Roles.STUDENT,
    Roles.PARENT,
  )
  async getAttendances(@Context() context) {
    return await this.attendanceService.getAttendances(
      context.req.user.userId,
      context.req.user.role,
    );
  }

  @Query(() => Attendance)
  @HasRoles(Roles.ADMIN, Roles.TEACHER, Roles.SUPER_ADMIN)
  async attendanceByLesson(
    @Args('lessonId') lessonId: string,
    @Context() context,
  ) {
    return await this.attendanceService.getAttendanceByLesson(
      lessonId,
      context.req.user.userId,
      context.req.user.role,
    );
  }

  @Mutation(() => [Attendance])
  @HasRoles(Roles.ADMIN, Roles.TEACHER, Roles.SUPER_ADMIN)
  async markAttendance(
    @Args('lessonId') lessonId: string,
    @Args('attendanceData', { type: () => [MarkAttendanceInput] })
    attendanceData: MarkAttendanceInput[],
    @Context() context,
  ) {
    return await this.attendanceService.markAttendance(
      lessonId,
      attendanceData,
      context.req.user.userId,
      context.req.user.role,
    );
  }

  @Query(() => Attendance)
  @HasRoles(
    Roles.ADMIN,
    Roles.TEACHER,
    Roles.SUPER_ADMIN,
    Roles.STUDENT,
    Roles.PARENT,
  )
  async attendanceStats(
    @Args('studentId') studentId: string,
    @Args('startDate') startDate: Date,
    @Args('endDate') endDate: Date,
    @Context() context,
  ) {
    return await this.attendanceService.getAttendanceStats(
      studentId,
      startDate,
      endDate,
      context.req.user.userId,
      context.req.user.role,
    );
  }

  @Query(() => SchoolAttendanceStats)
  @HasRoles(Roles.ADMIN, Roles.SUPER_ADMIN)
  async getSchoolAttendanceStats(
    @Args('startDate') startDate: Date,
    @Args('endDate') endDate: Date,
    @Context() context,
  ) {
    return await this.attendanceService.getSchoolAttendanceStats(
      startDate,
      endDate,
      context.req.user.userId,
      context.req.user.role,
    );
  }
}
