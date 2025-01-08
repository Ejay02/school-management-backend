import { Args, Context, Query, Resolver } from '@nestjs/graphql';
import { ParentService } from './parent.service';
import { RolesGuard } from 'src/shared/auth/guards/roles.guard';
import { JwtAuthGuard } from 'src/shared/auth/guards/jwtAuth.guard';
import { UseGuards } from '@nestjs/common';
import { HasRoles } from 'src/shared/auth/decorators/roles.decorator';
import { Parent } from './types/parent.types';
import { Roles } from 'src/shared/enum/role';

@Resolver()
@UseGuards(JwtAuthGuard, RolesGuard)
export class ParentResolver {
  constructor(private parentService: ParentService) {}

  @Query(() => [Parent])
  @HasRoles(
    Roles.ADMIN,
    Roles.TEACHER,
    Roles.PARENT,
    Roles.STUDENT,
    Roles.STUDENT,
  )
  async getAllParents(@Context() context) {
    return this.parentService.getAllParents(
      context.req.user.userId,
      context.req.user.role,
    );
  }

  @Query(() => Parent)
  @HasRoles(
    Roles.ADMIN,
    Roles.TEACHER,
    Roles.PARENT,
    Roles.STUDENT,
    Roles.STUDENT,
  )
  async getParentById(@Args('parentId') parentId: string) {
    return this.parentService.getParentById(parentId);
  }
}
