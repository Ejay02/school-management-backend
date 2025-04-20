import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ParentService } from './parent.service';
import { RolesGuard } from 'src/shared/auth/guards/roles.guard';
import { JwtAuthGuard } from 'src/shared/auth/guards/jwtAuth.guard';
import { UseGuards } from '@nestjs/common';
import { HasRoles } from 'src/shared/auth/decorators/roles.decorator';
import { Parent } from './types/parent.types';
import { Roles } from 'src/shared/enum/role';
import { PaginationInput } from 'src/shared/pagination/input/pagination.input';
import { UpdateProfileInput } from 'src/shared/inputs/profile-update.input';

@Resolver()
@UseGuards(JwtAuthGuard, RolesGuard)
export class ParentResolver {
  constructor(private readonly parentService: ParentService) {}

  @Query(() => [Parent])
  @HasRoles(
    Roles.ADMIN,
    Roles.TEACHER,
    Roles.PARENT,
    Roles.STUDENT,
    Roles.SUPER_ADMIN,
  )
  async getAllParents(
    @Context() context,
    @Args('params', { nullable: true }) params?: PaginationInput,
  ) {
    const result = await this.parentService.getAllParents(
      context.req.user.userId,
      context.req.user.role,
      params || {},
    );
    return result.data;
  }

  @Query(() => Parent)
  @HasRoles(
    Roles.ADMIN,
    Roles.TEACHER,
    Roles.PARENT,
    Roles.STUDENT,
    Roles.SUPER_ADMIN,
  )
  async getParentById(@Args('parentId') parentId: string) {
    return await this.parentService.getParentById(parentId);
  }

  @Mutation(() => Parent)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @HasRoles(Roles.PARENT)
  async updateParentProfile(
    @Args('input') input: UpdateProfileInput,
    @Context() context: any,
  ) {
    return this.parentService.updateParentProfile(
      context.req.user.userId,
      input,
    );
  }
}
