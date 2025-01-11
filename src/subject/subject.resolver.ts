import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import { SubjectService } from './subject.service';
import { RolesGuard } from 'src/shared/auth/guards/roles.guard';
import { JwtAuthGuard } from 'src/shared/auth/guards/jwtAuth.guard';
import { HasRoles } from 'src/shared/auth/decorators/roles.decorator';
import { UseGuards } from '@nestjs/common';
import { Roles } from 'src/shared/enum/role';
import { AssignSubjectsInput } from './input/assign.subject.input';
import { AssignSubjectsResponse } from './response/assign.subject.response';
import { Subject } from './types/subject.types';
import { PaginationInput } from 'src/shared/pagination/input/pagination.input';

@Resolver()
@UseGuards(JwtAuthGuard, RolesGuard)
export class SubjectResolver {
  constructor(private subjectService: SubjectService) {}

  @Mutation(() => AssignSubjectsResponse)
  @HasRoles(Roles.ADMIN)
  async assignSubjectsToClass(
    @Args('input') input: AssignSubjectsInput,
    @Context() context,
  ) {
    return this.subjectService.assignSubjectsToClass(
      input.classId,
      input.subjectIds,
      context.req.user.role,
    );
  }

  @Query(() => [Subject])
  @HasRoles(
    Roles.SUPER_ADMIN,
    Roles.ADMIN,
    Roles.TEACHER,
    Roles.PARENT,
    Roles.STUDENT,
  )
  async getAllSubjects(
    @Context() context,
    @Args('pagination', { nullable: true }) pagination?: PaginationInput,
  ) {
    const result = await this.subjectService.getAllSubjects(
      context.req.user.userId,
      context.req.user.role,
      pagination || {},
    );
    return result.data;
  }

  @Query(() => Subject)
  @UseGuards(JwtAuthGuard)
  async getSubjectById(@Args('id', { type: () => String }) id: string) {
    return this.subjectService.getSubjectById(id);
  }
}
