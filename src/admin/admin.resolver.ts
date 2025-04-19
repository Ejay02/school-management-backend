import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AdminService } from './admin.service';
import { UseGuards } from '@nestjs/common';
import { Roles } from 'src/shared/enum/role';
import { HasRoles } from 'src/shared/auth/decorators/roles.decorator';
import { RolesGuard } from 'src/shared/auth/guards/roles.guard';
import { Admin } from './types/admin.types';
import { JwtAuthGuard } from 'src/shared/auth/guards/jwtAuth.guard';

import { DashboardSummary } from './types/dashboard.summary.type';
import { MonthlyRevenue } from './types/income.graph.type';
import { AdminUsersResponse } from './response/admin.users.response';
import { UpdateProfileInput } from 'src/shared/inputs/profile-update.input';

@Resolver()
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminResolver {
  constructor(private readonly adminService: AdminService) {}

  @Query(() => [Admin])
  @HasRoles(Roles.ADMIN, Roles.SUPER_ADMIN)
  async getAllAdmins(@Context() context) {
    const userId = context.req.user.userId;
    return await this.adminService.getAllAdmins(userId);
  }

  @Mutation(() => Admin)
  @HasRoles(Roles.SUPER_ADMIN)
  async assignAdminRole(
    @Context() context,
    @Args('targetId') targetId: string,
    @Args('role') role: Roles,
  ) {
    return await this.adminService.assignAdminRole(
      context.req.user.userId,
      targetId,
      role,
    );
  }

  @Mutation(() => Admin)
  @HasRoles(Roles.SUPER_ADMIN, Roles.ADMIN)
  async updateAdminProfile(
    @Context() context,
    @Args('input') input: UpdateProfileInput,
  ) {
    return this.adminService.updateAdminProfile(context.req.user.id, input);
  }

  @UseGuards(JwtAuthGuard)
  @Mutation(() => Boolean)
  @HasRoles(Roles.SUPER_ADMIN)
  async deleteUser(
    @Context() context,
    @Args('targetId') targetId: string,
  ): Promise<boolean> {
    return await this.adminService.deleteUser(
      context.req.user.userId,
      targetId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Query(() => DashboardSummary)
  @HasRoles(Roles.ADMIN, Roles.SUPER_ADMIN)
  async getDashboardUserCardSummary(@Context() context) {
    return await this.adminService.getDashboardUserCardSummary(
      context.req.user.role,
    );
  }

  @Query(() => MonthlyRevenue)
  @HasRoles(Roles.ADMIN, Roles.SUPER_ADMIN)
  async getIncomeGraphData() {
    return await this.adminService.getIncomeGraphData();
  }

  @Query(() => AdminUsersResponse)
  @HasRoles(Roles.ADMIN, Roles.SUPER_ADMIN)
  async getAllAdminUsers(@Context() context) {
    return await this.adminService.getAllAdminUsers(context.req.user.userId);
  }
}
