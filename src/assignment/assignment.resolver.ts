import { Query, Resolver, Args, Mutation, Context } from '@nestjs/graphql';
import { AssignmentService } from './assignment.service';
import { Assignment } from './types/assignment.types';
import { HasRoles } from 'src/shared/auth/decorators/roles.decorator';
import { UseGuards } from '@nestjs/common';
import { RolesGuard } from 'src/shared/auth/guards/roles.guard';
import { JwtAuthGuard } from 'src/shared/auth/guards/jwtAuth.guard';
import { Roles } from 'src/shared/enum/role';
import { CreateAssignmentInput } from './input/create.assignment.input';
import { EditAssignmentInput } from './input/edit.assignment.input';

@Resolver()
export class AssignmentResolver {
  constructor(private assignmentService: AssignmentService) {}

  @Query(() => [Assignment])
  @HasRoles(Roles.ADMIN, Roles.TEACHER)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getAllAssignments() {
    return this.assignmentService.getAllAssignments();
  }

  @Query(() => [Assignment])
  @HasRoles(Roles.ADMIN, Roles.TEACHER, Roles.PARENT, Roles.STUDENT)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getAssignmentById(@Args('assignmentId') assignmentId: string) {
    return this.assignmentService.getAssignmentById(assignmentId);
  }

  @Mutation(() => Assignment)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @HasRoles(Roles.TEACHER)
  async createAssignment(
    @Context() context,
    @Args('createAssignmentInput') createAssignmentInput: CreateAssignmentInput,
  ) {
    return this.assignmentService.createAssignment(
      context.req.user.userId,
      createAssignmentInput,
    );
  }

  @Mutation(() => Assignment)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @HasRoles(Roles.TEACHER)
  async editAssignment(
    @Context() context,
    @Args('editAssignmentInput') editAssignmentInput: EditAssignmentInput,
  ) {
    return this.assignmentService.createAssignment(
      context.req.user.userId,
      editAssignmentInput,
    );
  }
}
