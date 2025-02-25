import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ExamService } from './exam.service';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/shared/auth/guards/jwtAuth.guard';
import { RolesGuard } from 'src/shared/auth/guards/roles.guard';
import { HasRoles } from 'src/shared/auth/decorators/roles.decorator';
import { Exam } from './types/exam.types';
import { Roles } from 'src/shared/enum/role';
import { UpdateExamInput } from './input/update.exam.input';
import { PaginationInput } from 'src/shared/pagination/input/pagination.input';
import { CreateExamInput } from './input/create.exam.input';

@Resolver()
@UseGuards(JwtAuthGuard, RolesGuard)
export class ExamResolver {
  constructor(private examService: ExamService) {}

  @Mutation(() => Exam)
  @HasRoles(Roles.TEACHER, Roles.ADMIN, Roles.SUPER_ADMIN)
  async createExam(@Context() context, @Args('input') input: CreateExamInput) {
    return await this.examService.createExam(context.req.user.userId, input);
  }

  @Mutation(() => Exam)
  @HasRoles(Roles.TEACHER, Roles.ADMIN, Roles.SUPER_ADMIN)
  async updateExam(
    @Context() context,
    @Args('examId') examId: string,
    @Args('input') input: UpdateExamInput,
  ) {
    return await this.examService.updateExam(
      examId,
      context.req.user.userId,
      input,
    );
  }

  @Query(() => [Exam])
  @HasRoles(Roles.ADMIN, Roles.SUPER_ADMIN)
  async getAllExams(
    @Args('params', { nullable: true }) params?: PaginationInput,
  ) {
    const result = await this.examService.getAllExams(params || {});
    return result.data;
  }

  @Query(() => [Exam])
  @HasRoles(
    Roles.TEACHER,
    Roles.STUDENT,
    Roles.PARENT,
    Roles.ADMIN,
    Roles.SUPER_ADMIN,
  )
  async getClassExams(
    @Context() context,
    @Args('classId') classId: string,
    @Args('params', { nullable: true }) params?: PaginationInput,
  ) {
    return await this.examService.getClassExams(
      classId,
      context.req.user.userId,
      context.req.user.role,
      params || {},
    );
  }

  @Query(() => Exam)
  @HasRoles(
    Roles.TEACHER,
    Roles.STUDENT,
    Roles.PARENT,
    Roles.ADMIN,
    Roles.SUPER_ADMIN,
  )
  async getExamDetails(@Context() context, @Args('examId') examId: string) {
    return await this.examService.getExamDetails(
      examId,
      context.req.user.userId,
      context.req.user.role,
    );
  }

  @Mutation(() => Boolean)
  @HasRoles(Roles.ADMIN, Roles.SUPER_ADMIN)
  async deleteExam(@Args('examId') examId: string) {
    return await this.examService.deleteExam(examId);
  }
}
