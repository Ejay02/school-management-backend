import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AdminService } from './admin.service';
import { UseGuards } from '@nestjs/common';
import { Roles } from 'src/shared/enum/role';
import { HasRoles } from 'src/shared/auth/decorators/roles.decorator';
import { RolesGuard } from 'src/shared/auth/guards/roles.guard';
import { Teacher } from 'src/teacher/types/teacher.types';
import { Admin } from './types/admin.types';
import { Grade } from 'src/grade/types/grade.types';
import { Exam } from 'src/exam/types/exam.types';
import { JwtAuthGuard } from 'src/shared/auth/guards/jwtAuth.guard';
import { EditAdminInput } from './input/edit.admin.input';
import { EditAdminResponse } from './response/edit.admin.response';

@Resolver()
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminResolver {
  constructor(private adminService: AdminService) {}

  @Query(() => [Teacher])
  @HasRoles(Roles.ADMIN)
  async getAllTeachers(@Context() context) {
    const userId = context.req.user.userId;

    return this.adminService.getAllTeachers(userId);
  }

  @Query(() => [Admin])
  @HasRoles(Roles.ADMIN)
  async getAllAdmins(@Context() context) {
    const userId = context.req.user.userId;
    return this.adminService.getAllAdmins(userId);
  }

  @Query(() => [Exam])
  @HasRoles(Roles.ADMIN)
  async getAllExams(@Context() context) {
    return this.adminService.getAllExams(context.req.user.userId);
  }

  @Query(() => [Grade])
  @HasRoles(Roles.ADMIN)
  async getAllGrades(@Context() context) {
    return this.adminService.getAllGrades(context.req.user.userId);
  }

  @Mutation(() => Admin)
  @HasRoles(Roles.SUPER_ADMIN)
  async assignAdminRole(
    @Context() context,
    @Args('targetId') targetId: string,
    @Args('role') role: Roles,
  ) {
    return this.adminService.assignAdminRole(
      context.req.user.userId,
      targetId,
      role,
    );
  }

  @UseGuards(JwtAuthGuard)
  @HasRoles(Roles.SUPER_ADMIN, Roles.ADMIN)
  @Mutation(() => EditAdminResponse)
  async editAdmin(@Context() context, @Args('input') input: EditAdminInput) {
    return this.adminService.editAdmin(context.req.user.userId, input);
  }

  @Mutation(() => Boolean)
  @HasRoles(Roles.SUPER_ADMIN)
  async deleteUser(
    @Context() context,
    @Args('targetId') targetId: string,
  ): Promise<boolean> {
    return this.adminService.deleteUser(context.req.user.userId, targetId);
  }
}
