import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AttendanceService } from './attendance.service';
import { JwtAuthGuard } from 'src/shared/auth/guards/jwtAuth.guard';
import { RolesGuard } from 'src/shared/auth/guards/roles.guard';
import { UseGuards } from '@nestjs/common';

@Resolver()
@UseGuards(JwtAuthGuard, RolesGuard)
export class AttendanceResolver {
  constructor(private attendanceService: AttendanceService) {}

  @Query()
  async attendances(@Context() context) {
    const { userId, role } = context.req.user;
    return this.attendanceService.getAttendances(userId, role);
  }

  @Query()
  async attendanceByLesson(
    @Args('lessonId') lessonId: string,
    @Context() context,
  ) {
    const { userId, role } = context.req.user;
    return this.attendanceService.getAttendanceByLesson(lessonId, userId, role);
  }

  @Mutation()
  async markAttendance(
    @Args('lessonId') lessonId: string,
    @Args('attendanceData')
    attendanceData: { studentId: string; present: boolean; date: Date }[],
    @Context() context,
  ) {
    const { userId, role } = context.req.user;
    return this.attendanceService.markAttendance(
      lessonId,
      attendanceData,
      userId,
      role,
    );
  }

  @Query()
  async attendanceStats(
    @Args('studentId') studentId: string,
    @Args('startDate') startDate: Date,
    @Args('endDate') endDate: Date,
    @Context() context,
  ) {
    const { userId, role } = context.req.user;
    return this.attendanceService.getAttendanceStats(
      studentId,
      startDate,
      endDate,
      userId,
      role,
    );
  }
}
