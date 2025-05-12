import { Args, Context, Mutation, Resolver, Query } from '@nestjs/graphql';
import { GradeService } from './grade.service';
import { JwtAuthGuard } from 'src/shared/auth/guards/jwtAuth.guard';
import { RolesGuard } from 'src/shared/auth/guards/roles.guard';
import { Roles } from 'src/shared/enum/role';
import { HasRoles } from 'src/shared/auth/decorators/roles.decorator';
import { Grade } from './types/grade.types';
import { CreateGradeInput } from './input/create.grade.input';
import { UpdateGradeInput } from './input/update.grade.input';
import { UseGuards } from '@nestjs/common';
import { PaginationInput } from 'src/shared/pagination/input/pagination.input';

@Resolver()
@UseGuards(JwtAuthGuard, RolesGuard)
export class GradeResolver {
  constructor(private readonly gradeService: GradeService) {}

  @Mutation(() => Grade)
  @HasRoles(Roles.TEACHER)
  async assignGrade(
    @Context() context,
    @Args('input') input: CreateGradeInput,
  ) {
    return await this.gradeService.assignGrade(context.req.user.userId, input);
  }

  @Mutation(() => Grade)
  @HasRoles(Roles.TEACHER)
  async updateGrade(
    @Context() context,
    @Args('input') input: UpdateGradeInput,
  ) {
    return await this.gradeService.updateGrade(context.req.user.userId, input);
  }

  @Query(() => Grade)
  @HasRoles(Roles.STUDENT)
  async getMyGrades(
    @Context() context,
    @Args('academicPeriod', { nullable: true }) academicPeriod: string,
    @Args('params', { nullable: true }) params?: PaginationInput,
  ) {
    const result = await this.gradeService.getMyGrades(
      context.req.user.userId,
      academicPeriod,
      params || {},
    );
    return result.data;
  }

  @Query(() => Grade)
  @HasRoles(Roles.TEACHER, Roles.ADMIN, Roles.SUPER_ADMIN)
  async getClassGrades(
    @Context() context,
    @Args('classId') classId: string,
    @Args('academicPeriod', { nullable: true }) academicPeriod?: string,
    @Args('params', { nullable: true }) params?: PaginationInput,
  ) {
    const result = await this.gradeService.getClassGrades(
      classId,
      academicPeriod,
      params || {},
    );
    return result;
  }

  @Mutation(() => Grade)
  @HasRoles(Roles.ADMIN, Roles.TEACHER)
  async assignAssignmentGrade(
    @Args('studentId') studentId: string,
    @Args('assignmentId') assignmentId: string,
    @Args('score') score: number,
    @Args('academicPeriod') academicPeriod: string,
    @Args('comments', { nullable: true }) comments?: string,
  ) {
    return await this.gradeService.assignAssignmentGrade(
      studentId,
      assignmentId,
      score,
      academicPeriod,
      comments,
    );
  }

  @Mutation(() => Grade)
  @HasRoles(Roles.ADMIN, Roles.TEACHER, Roles.SUPER_ADMIN)
  async assignExamGrade(
    @Args('studentId') studentId: string,
    @Args('examId') examId: string,
    @Args('score') score: number,
    @Args('academicPeriod') academicPeriod: string,
    @Args('comments', { nullable: true }) comments?: string,
  ) {
    return await this.gradeService.assignExamGrade(
      studentId,
      examId,
      score,
      academicPeriod,
      comments,
    );
  }

  @Query(() => Number, {
    description: 'Calculate final grade for a student in a class',
  })
  @HasRoles(
    Roles.TEACHER,
    Roles.ADMIN,
    Roles.SUPER_ADMIN,
    Roles.STUDENT,
    Roles.PARENT,
  )
  async calculateFinalGrade(
    @Args('studentId') studentId: string,
    @Args('classId') classId: string,
  ) {
    return await this.gradeService.calculateFinalGrade(studentId, classId);
  }

  @Mutation(() => Grade)
  @HasRoles(Roles.ADMIN, Roles.TEACHER)
  async calculateOverallGrade(
    @Args('studentId') studentId: string,
    @Args('academicPeriod') academicPeriod: string,
  ) {
    // Adjust return type to Grade
    return await this.gradeService.calculateOverallGrade(
      studentId,
      academicPeriod,
    );
  }

  @Mutation(() => Boolean)
  @HasRoles(Roles.ADMIN, Roles.SUPER_ADMIN)
  async deleteGrade(@Args('gradeId') gradeId: string): Promise<boolean> {
    await await this.gradeService.deleteGrade(gradeId);
    return true;
  }
}
