import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ClassService } from './class.service';
import { Class } from './types/class.types';
import { JwtAuthGuard } from 'src/shared/auth/guards/jwtAuth.guard';
import { UseGuards } from '@nestjs/common';
import { CreateClassInput } from './input/create.class.input';
import { HasRoles } from 'src/shared/auth/decorators/roles.decorator';
import { Roles } from 'src/shared/enum/role';
import { RolesGuard } from 'src/shared/auth/guards/roles.guard';
import { PaginationInput } from 'src/shared/pagination/input/pagination.input';

@Resolver()
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClassResolver {
  constructor(private classService: ClassService) {}

  @Query(() => [Class])
  @HasRoles(Roles.SUPER_ADMIN, Roles.ADMIN)
  async getAllClasses(
    @Args('pagination', { nullable: true }) pagination?: PaginationInput,
  ) {
    return this.classService.getAllClasses(pagination || {});
  }

  @Mutation(() => Class)
  @HasRoles(Roles.SUPER_ADMIN, Roles.ADMIN)
  async createClass(@Args('input') input: CreateClassInput) {
    return this.classService.createClass(input);
  }

  @Query(() => Class)
  async getClassById(@Args('id', { type: () => String }) id: string) {
    return this.classService.getClassById(id);
  }

  @Mutation(() => Class)
  @HasRoles(Roles.SUPER_ADMIN, Roles.ADMIN, Roles.TEACHER)
  async assignClassToTeacher(
    @Args('classId') classId: string,
    @Args('teacherId') teacherId: string,
  ) {
    await this.classService.assignClassToTeacher(classId, teacherId);
  }
}
