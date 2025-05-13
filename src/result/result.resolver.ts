import { Args, Context, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ResultService } from './result.service';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/shared/auth/guards/jwtAuth.guard';
import { RolesGuard } from 'src/shared/auth/guards/roles.guard';
import { HasRoles } from 'src/shared/auth/decorators/roles.decorator';
import { Result } from './types/result.types';
import { Roles } from 'src/shared/enum/role';
import { ResultStatistics } from './types/result.statistics';
import { DeleteResponse } from 'src/shared/auth/response/delete.response';
import { PaginationInput } from 'src/shared/pagination/input/pagination.input';
import { CreateResultInput } from './input/create.result.input';
import { UpdateResultInput } from './input/update.result.input';
import { Term } from 'src/payment/enum/term';

@Resolver()
@UseGuards(JwtAuthGuard, RolesGuard)
export class ResultResolver {
  constructor(private readonly resultService: ResultService) {}

  @Mutation(() => Result)
  @HasRoles(Roles.TEACHER, Roles.ADMIN, Roles.SUPER_ADMIN)
  async generateResult(
    @Args('studentId') studentId: string,
    @Args('score', { type: () => Int }) score: number,
    @Args('examId', { nullable: true }) examId?: string,
    @Args('assignmentId', { nullable: true }) assignmentId?: string,
  ) {
    return await this.resultService.generateResults({
      studentId,
      score,
      examId,
      assignmentId,
    });
  }

  @Query(() => [Result])
  @HasRoles(
    Roles.TEACHER,
    Roles.ADMIN,
    Roles.SUPER_ADMIN,
    Roles.STUDENT,
    Roles.PARENT,
  )
  async getStudentResults(@Args('studentId') studentId: string) {
    return await this.resultService.getStudentResults(studentId);
  }

  @Mutation(() => Result)
  @HasRoles(Roles.TEACHER)
  async assignResult(
    @Context() context,
    @Args('input') input: CreateResultInput,
  ) {
    return await this.resultService.assignResult(
      context.req.user.userId,
      input,
    );
  }

  @Mutation(() => Result)
  @HasRoles(Roles.TEACHER)
  async updateResult(
    @Context() context,
    @Args('input') input: UpdateResultInput,
  ) {
    return await this.resultService.updateResult(
      context.req.user.userId,
      input,
    );
  }

  @Query(() => Result)
  @HasRoles(Roles.STUDENT)
  async getMyResults(
    @Context() context,
    @Args('academicPeriod', { nullable: true }) academicPeriod: string,
    @Args('params', { nullable: true }) params?: PaginationInput,
  ) {
    const result = await this.resultService.getMyResult(
      context.req.user.userId,
      academicPeriod,
      params ?? {},
    );
    return result.data;
  }

  @Query(() => Result)
  @HasRoles(Roles.TEACHER, Roles.ADMIN, Roles.SUPER_ADMIN)
  async getChildrenResults(
    @Context() context,
    @Args('parentId') parentId: string,
    @Args('studentId') studentId: string,
    @Args('academicPeriod', { nullable: true }) academicPeriod?: string,
    @Args('params', { nullable: true }) params?: PaginationInput,
  ) {
    const result = await this.resultService.getChildrenResults(
      parentId,
      studentId,
      academicPeriod,
      params ?? {},
    );
    return result;
  }

  @Query(() => Result)
  @HasRoles(Roles.TEACHER, Roles.ADMIN, Roles.SUPER_ADMIN)
  async getClassResults(
    @Context() context,
    @Args('classId') classId: string,
    @Args('academicPeriod', { nullable: true }) academicPeriod?: string,
    @Args('params', { nullable: true }) params?: PaginationInput,
  ) {
    const result = await this.resultService.getClassResults(
      classId,
      academicPeriod,
      params ?? {},
    );
    return result;
  }

  @Mutation(() => Result)
  @HasRoles(Roles.ADMIN, Roles.TEACHER)
  async assignAssignmentResult(
    @Args('studentId') studentId: string,
    @Args('assignmentId') assignmentId: string,
    @Args('score') score: number,
    @Args('academicPeriod') academicPeriod: string,
    @Args('comments', { nullable: true }) comments?: string,
  ) {
    return await this.resultService.assignAssignmentResult(
      studentId,
      assignmentId,
      score,
      academicPeriod,
      comments,
    );
  }

  @Query(() => Number, {
    description: 'Calculate final Result for a student in a class',
  })
  @HasRoles(
    Roles.TEACHER,
    Roles.ADMIN,
    Roles.SUPER_ADMIN,
    Roles.STUDENT,
    Roles.PARENT,
  )
  async calculateFinalResult(
    @Args('studentId') studentId: string,
    @Args('classId') classId: string,
    @Args('term', { type: () => Term }) term: Term,
  ) {
    return await this.resultService.calculateFinalResult(
      studentId,
      classId,
      term,
    );
  }

  @Mutation(() => Result)
  @HasRoles(Roles.ADMIN, Roles.TEACHER)
  async calculateOverallResult(
    @Args('studentId') studentId: string,
    @Args('academicPeriod') academicPeriod: string,
  ) {
    return await this.resultService.calculateOverallResult(
      studentId,
      academicPeriod,
    );
  }

  @Mutation(() => DeleteResponse)
  @HasRoles(Roles.TEACHER, Roles.ADMIN, Roles.SUPER_ADMIN)
  async deleteResult(@Args('id') id: string) {
    return await this.resultService.deleteResult(id);
  }

  @Query(() => ResultStatistics)
  @HasRoles(Roles.TEACHER, Roles.ADMIN, Roles.SUPER_ADMIN)
  async getResultStatistics(@Args('className') className: string) {
    return await this.resultService.getResultStatistics(className);
  }

  @Query(() => [Result])
  @HasRoles(
    Roles.TEACHER,
    Roles.ADMIN,
    Roles.SUPER_ADMIN,
    Roles.STUDENT,
    Roles.PARENT,
  )
  async getResultHistory(
    @Args('studentId') studentId: string,
    @Args('academicYear', { nullable: true }) academicYear?: string,
  ) {
    return await this.resultService.getResultHistory(studentId, academicYear);
  }

  @Mutation(() => [Result])
  @HasRoles(Roles.TEACHER, Roles.ADMIN, Roles.SUPER_ADMIN)
  async publishResults(
    @Args('classId') classId: string,
    @Context() context,
    @Args('term') term: string,
    @Args('message', { nullable: true }) message?: string,
  ) {
    return await this.resultService.publishResults({
      classId,
      creatorId: context.req.user.userId,
      term,
      message,
    });
  }

  @Mutation(() => [Result])
  @HasRoles(Roles.TEACHER, Roles.ADMIN, Roles.SUPER_ADMIN)
  async notifyStudentResults(
    @Context() context,
    @Args('studentId') studentId: string,
    @Args('term') term: string,
    @Args('message', { nullable: true }) message?: string,
  ) {
    return await this.resultService.notifySpecificStudent({
      studentId,
      creatorId: context.req.user.userId,
      term,
      message,
    });
  }
}
