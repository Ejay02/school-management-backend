import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ClassService } from './class.service';
import { Class } from './types/class.types';
import { JwtAuthGuard } from 'src/shared/auth/guards/jwtAuth.guard';
import { UseGuards } from '@nestjs/common';
import { CreateClassInput } from './input/create.class.input';
import { HasRoles } from 'src/shared/auth/decorators/roles.decorator';
import { Roles } from 'src/shared/enum/role';
import { RolesGuard } from 'src/shared/auth/guards/roles.guard';
import { PaginationInput } from 'src/shared/pagination/input/pagination.input';
import { UpdateClassInput } from './input/update.class.input';
import { DeleteResponse } from 'src/shared/auth/response/delete.response';

@Resolver()
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClassResolver {
  constructor(private readonly classService: ClassService) {}

  @Query(() => [Class])
  @HasRoles(Roles.SUPER_ADMIN, Roles.ADMIN, Roles.TEACHER)
  async getAllClasses(
    @Context() context,
    @Args('params', { nullable: true }) params?: PaginationInput,
  ) {
    const result = await this.classService.getAllClasses(
      context.req.user,
      params || {},
    );
    return result.data;
  }

  @Mutation(() => Class)
  @HasRoles(Roles.SUPER_ADMIN, Roles.ADMIN)
  async createClass(@Args('input') input: CreateClassInput) {
    return await this.classService.createClass(input);
  }

  @Query(() => Class)
  async getClassById(@Args('id', { type: () => String }) id: string) {
    return await this.classService.getClassById(id);
  }

  @Mutation(() => Class)
  @HasRoles(Roles.SUPER_ADMIN, Roles.ADMIN, Roles.TEACHER)
  async assignClassToTeacher(
    @Args('classId') classId: string,
    @Args('teacherId') teacherId: string,
  ) {
    await this.classService.assignClassToTeacher(classId, teacherId);
  }

  @Mutation(() => Class)
  @HasRoles(Roles.SUPER_ADMIN, Roles.ADMIN)
  async updateClass(
    @Args('classId') classId: string,
    @Args('input') input: UpdateClassInput,
  ) {
    return await this.classService.updateClass(classId, input);
  }

  @Mutation(() => DeleteResponse)
  @HasRoles(Roles.SUPER_ADMIN, Roles.ADMIN)
  async deleteClass(@Args('classId') classId: string) {
    return await this.classService.deleteClass(classId);
  }
}
