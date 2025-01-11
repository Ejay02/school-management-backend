import { Args, Context, Query, Resolver } from '@nestjs/graphql';
import { TeacherService } from './teacher.service';
import { UseGuards } from '@nestjs/common';
import { HasRoles } from 'src/shared/auth/decorators/roles.decorator';
import { Roles } from 'src/shared/enum/role';
import { JwtAuthGuard } from 'src/shared/auth/guards/jwtAuth.guard';
import { RolesGuard } from 'src/shared/auth/guards/roles.guard';
import { Teacher } from './types/teacher.types';
import { PaginationInput } from 'src/shared/pagination/input/pagination.input';
// import { PublicTeacherResponse } from './types/public.teacher.types';

@Resolver()
@UseGuards(JwtAuthGuard, RolesGuard)
export class TeacherResolver {
  constructor(private teacherService: TeacherService) {}

  @Query(() => Teacher)
  @HasRoles(Roles.ADMIN, Roles.TEACHER, Roles.PARENT, Roles.STUDENT)
  async getTeacherById(
    @Context() context,
    @Args('teacherId', { type: () => String }) teacherId: string,
  ) {
    const userId = context.req.user.userId;
    return this.teacherService.getTeacherById(userId, teacherId);
  }

  @Query(() => [Teacher])
  @HasRoles(
    Roles.SUPER_ADMIN,
    Roles.ADMIN,
    Roles.TEACHER,
    Roles.PARENT,
    Roles.STUDENT,
  )
  async getAllTeachers(
    @Context() context,
    @Args('pagination', { nullable: true }) pagination?: PaginationInput,
  ) {
    const result = await this.teacherService.getAllTeachers(
      context.req.user.userId,
      context.req.user.role,
      pagination || {},
    );
    return result.data;
  }

  // @Query(() => PublicTeacherResponse)
  // async publicTeacherProfile(@Args('id') id: string) {
  //   return this.teacherService.publicTeacherProfile(id);
  // }

  // @Query()
  // @HasRoles(Roles.TEACHER)

  // async getStudentGrades(@Args('studentId') studentId: string) {
  //   // Only assigned teachers can access
  // }
}
