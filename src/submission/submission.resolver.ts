import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import { SubmissionService } from './submission.service';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../shared/auth/guards/jwtAuth.guard';
import { RolesGuard } from '../shared/auth/guards/roles.guard';
import { Submission } from './types/submission.types';
import { HasRoles } from '../shared/auth/decorators/roles.decorator';
import { Roles } from '../shared/enum/role';
import { PaginationInput } from '../shared/pagination/input/pagination.input';
import { CreateSubmissionInput } from './input/create.submission.input';
import { UpdateSubmissionInput } from './input/update.submission.input';

@Resolver()
@UseGuards(JwtAuthGuard, RolesGuard)
export class SubmissionResolver {
  constructor(private readonly submissionService: SubmissionService) {}

  @Query(() => [Submission])
  @HasRoles(Roles.TEACHER)
  async getSubmissionsByAssignment(
    @Context() context,
    @Args('assignmentId') assignmentId: string,
    @Args('params', { nullable: true }) params?: PaginationInput,
  ) {
    const result = await this.submissionService.getSubmissionsByAssignment(
      assignmentId,
      context.req.user.userId,
      params || {},
    );
    return result.data;
  }

  @Query(() => [Submission])
  @HasRoles(Roles.STUDENT)
  async getMySubmissions(
    @Context() context,
    @Args('params', { nullable: true }) params?: PaginationInput,
  ) {
    const result = await this.submissionService.getMySubmissions(
      context.req.user.userId,
      params || {},
    );
    return result.data;
  }

  @Query(() => [Submission])
  @HasRoles(Roles.ADMIN, Roles.SUPER_ADMIN)
  async getAllClassSubmissions(
    @Args('classId') classId: string,
    @Args('params', { nullable: true }) params?: PaginationInput,
  ) {
    const result = await this.submissionService.getAllClassSubmissions(
      classId,
      params || {},
    );
    return result.data;
  }

  @Mutation(() => Submission)
  @HasRoles(Roles.STUDENT)
  async createSubmission(
    @Context() context,
    @Args('input') input: CreateSubmissionInput,
  ) {
    return await this.submissionService.createSubmission(
      context.req.user.userId,
      input,
    );
  }

  @Mutation(() => Submission)
  @HasRoles(Roles.STUDENT)
  async editSubmission(
    @Context() context,
    @Args('submissionId') submissionId: string,
    @Args('input') input: UpdateSubmissionInput,
  ) {
    return await this.submissionService.editSubmission(
      submissionId,
      context.req.user.userId,
      input,
    );
  }

  @Mutation(() => Boolean)
  @HasRoles(Roles.STUDENT)
  async deleteSubmission(
    @Context() context,
    @Args('submissionId') submissionId: string,
  ) {
    return await this.submissionService.deleteSubmission(
      submissionId,
      context.req.user.userId,
    );
  }
}
