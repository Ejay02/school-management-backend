import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ClassService } from './class.service';
import { Class } from './types/class.types';
import { JwtAuthGuard } from 'src/shared/auth/guards/jwtAuth.guard';
import { UseGuards } from '@nestjs/common';
import { CreateClassInput } from './input/create.class.input';
import { HasRoles } from 'src/shared/auth/decorators/roles.decorator';
import { Roles } from 'src/shared/enum/role';
import { RolesGuard } from 'src/shared/auth/guards/roles.guard';

@Resolver()
export class ClassResolver {
  constructor(private classService: ClassService) {}

  @Query(() => [Class])
  @HasRoles(Roles.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getAllClasses() {
    return this.classService.getAllClasses();
  }

  @Mutation(() => Class)
  @UseGuards(JwtAuthGuard)
  @HasRoles(Roles.SUPER_ADMIN, Roles.ADMIN)
  async createClass(@Args('input') input: CreateClassInput) {
    return this.classService.createClass(input);
  }

  @Query(() => Class)
  @UseGuards(JwtAuthGuard)
  async getClassById(@Args('id', { type: () => String }) id: string) {
    return this.classService.getClassById(id);
  }

  @Mutation(() => Class)
  async assignClassToTeacher(
    @Args('classId') classId: string,
    @Args('teacherId') teacherId: string,
  ) {
    await this.classService.assignClassToTeacher(classId, teacherId);
  }
}
