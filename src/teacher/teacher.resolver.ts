import { Args, Context, Query, Resolver } from '@nestjs/graphql';
import { TeacherService } from './teacher.service';
import { UseGuards } from '@nestjs/common';
import { HasRoles } from 'src/shared/auth/decorators/roles.decorator';
import { Roles } from 'src/shared/enum/role';
import { JwtAuthGuard } from 'src/shared/auth/guards/jwtAuth.guard';
import { RolesGuard } from 'src/shared/auth/guards/roles.guard';
import { Teacher } from './types/teacher.types';
// import { PublicTeacherResponse } from './types/public.teacher.types';

@Resolver()
export class TeacherResolver {
  constructor(private teacherService: TeacherService) {}

  @Query(() => Teacher)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @HasRoles(Roles.ADMIN, Roles.TEACHER)
  async getTeacherById(
    @Context() context,
    @Args('teacherId', { type: () => String }) teacherId: string,
  ) {
    const userId = context.req.user.userId;
    return this.teacherService.getTeacherById(userId, teacherId);
  }

  // @Query(() => PublicTeacherResponse)
  // async publicTeacherProfile(@Args('id') id: string) {
  //   return this.teacherService.publicTeacherProfile(id);
  // }

  // @Query()
  // @HasRoles(Roles.TEACHER)
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // async getStudentGrades(@Args('studentId') studentId: string) {
  //   // Only assigned teachers can access
  // }
}
