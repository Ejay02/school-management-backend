import { Args, Context, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ResultService } from './result.service';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/shared/auth/guards/jwtAuth.guard';
import { RolesGuard } from 'src/shared/auth/guards/roles.guard';
import { HasRoles } from 'src/shared/auth/decorators/roles.decorator';
import { Result } from './types/result.types';
import { Roles } from 'src/shared/enum/role';
import { ResultStatistics } from './types/result.statistics';

@Resolver()
@UseGuards(JwtAuthGuard, RolesGuard)
export class ResultResolver {
  constructor(private resultService: ResultService) {}

  @Mutation(() => Result)
  @HasRoles(Roles.TEACHER, Roles.ADMIN, Roles.SUPER_ADMIN)
  async generateResult(
    @Args('studentId') studentId: string,
    @Args('score', { type: () => Int }) score: number,
    @Args('examId', { nullable: true }) examId?: string,
    @Args('assignmentId', { nullable: true }) assignmentId?: string,
  ) {
    return this.resultService.generateResults({
      studentId,
      score,
      examId,
      assignmentId,
    });
  }

  @Mutation(() => Result)
  @HasRoles(Roles.TEACHER, Roles.ADMIN, Roles.SUPER_ADMIN)
  async updateResult(
    @Args('id') id: string,
    @Args('score', { type: () => Int, nullable: true }) score?: number,
    @Args('examId', { nullable: true }) examId?: string,
    @Args('assignmentId', { nullable: true }) assignmentId?: string,
  ) {
    return this.resultService.updateResult(id, {
      score,
      examId,
      assignmentId,
    });
  }

  @Mutation(() => Boolean)
  @HasRoles(Roles.TEACHER, Roles.ADMIN, Roles.SUPER_ADMIN)
  async deleteResult(@Args('id') id: string) {
    return this.resultService.deleteResult(id);
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
    return this.resultService.getStudentResults(studentId);
  }

  @Query(() => [Result])
  @HasRoles(Roles.TEACHER, Roles.ADMIN, Roles.SUPER_ADMIN)
  async getClassResults(@Args('classId') classId: string) {
    return this.resultService.getClassResults(classId);
  }

  @Query(() => ResultStatistics)
  @HasRoles(Roles.TEACHER, Roles.ADMIN, Roles.SUPER_ADMIN)
  async getResultStatistics(@Args('classId') classId: string) {
    return this.resultService.getResultStatistics(classId);
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
    return this.resultService.getResultHistory(studentId, academicYear);
  }

  @Mutation(() => [Result])
  @HasRoles(Roles.TEACHER, Roles.ADMIN, Roles.SUPER_ADMIN)
  async publishResults(
    @Args('classId') classId: string,
    @Context() context,
    @Args('term') term: string,
    @Args('message', { nullable: true }) message?: string,
  ) {
    return this.resultService.publishResults({
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
    return this.resultService.notifySpecificStudent({
      studentId,
      creatorId: context.req.user.userId,
      term,
      message,
    });
  }
}
