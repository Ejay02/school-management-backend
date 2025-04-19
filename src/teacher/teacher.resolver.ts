import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import { TeacherService } from './teacher.service';
import { UseGuards } from '@nestjs/common';
import { HasRoles } from 'src/shared/auth/decorators/roles.decorator';
import { Roles } from 'src/shared/enum/role';
import { JwtAuthGuard } from 'src/shared/auth/guards/jwtAuth.guard';
import { RolesGuard } from 'src/shared/auth/guards/roles.guard';
import { Teacher } from './types/teacher.types';
import { PaginationInput } from 'src/shared/pagination/input/pagination.input';
import { UpdateProfileInput } from 'src/shared/inputs/profile-update.input';

@Resolver()
@UseGuards(JwtAuthGuard, RolesGuard)
export class TeacherResolver {
  constructor(private readonly teacherService: TeacherService) {}

  @Query(() => Teacher)
  @HasRoles(Roles.ADMIN, Roles.TEACHER, Roles.PARENT, Roles.STUDENT)
  async getTeacherById(
    @Context() context,
    @Args('teacherId', { type: () => String }) teacherId: string,
  ) {
    const userId = context.req.user.userId;
    return await this.teacherService.getTeacherById(userId, teacherId);
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
    @Args('params', { nullable: true }) params?: PaginationInput,
  ) {
    const result = await this.teacherService.getAllTeachers(
      context.req.user.userId,
      context.req.user.role,
      params || {},
    );
    return result.data;
  }

  @Mutation(() => Teacher)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @HasRoles(Roles.TEACHER)
  async updateTeacherProfile(
    @Context() context: any,
    @Args('input') input: UpdateProfileInput,
  ) {
    return this.teacherService.updateTeacherProfile(context.req.user.id, input);
  }
}
