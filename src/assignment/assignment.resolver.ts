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
import { PaginationInput } from 'src/shared/pagination/input/pagination.input';
import { DeleteResponse } from 'src/shared/auth/response/delete.response';

@Resolver()
@UseGuards(JwtAuthGuard, RolesGuard)
export class AssignmentResolver {
  constructor(private assignmentService: AssignmentService) {}

  @Query(() => [Assignment])
  @HasRoles(
    Roles.ADMIN,
    Roles.TEACHER,
    Roles.PARENT,
    Roles.STUDENT,
    Roles.ADMIN,
    Roles.SUPER_ADMIN,
  )
  async getAllAssignments(
    @Context() context,
    @Args('params', { nullable: true }) params?: PaginationInput,
  ) {
    const result = await this.assignmentService.getAllAssignments(
      context.req.user.userId,
      context.req.user.role,
      params || {},
    );
    return result.data;
  }

  @Query(() => Assignment)
  @HasRoles(
    Roles.ADMIN,
    Roles.TEACHER,
    Roles.PARENT,
    Roles.STUDENT,
    Roles.SUPER_ADMIN,
  )
  async getAssignmentById(@Args('assignmentId') assignmentId: string) {
    return this.assignmentService.getAssignmentById(assignmentId);
  }

  @Mutation(() => Assignment)
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
  @HasRoles(Roles.TEACHER)
  async editAssignment(
    @Context() context,
    @Args('assignmentId') assignmentId: string,
    @Args('editAssignmentInput') editAssignmentInput: EditAssignmentInput,
  ) {
    return this.assignmentService.editAssignment(
      assignmentId,
      context.req.user.userId,
      context.req.user.role,
      editAssignmentInput,
    );
  }

  @Mutation(() => DeleteResponse)
  @HasRoles(Roles.TEACHER, Roles.ADMIN, Roles.SUPER_ADMIN)
  async deleteAssignment(
    @Context() context,
    @Args('assignmentId') assignmentId: string,
  ) {
    return this.assignmentService.deleteAssignment(
      assignmentId,
      context.req.user.userId,
      context.req.user.role,
    );
  }
}
