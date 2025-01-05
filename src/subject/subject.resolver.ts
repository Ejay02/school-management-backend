import { Args, Context, Mutation, Resolver } from '@nestjs/graphql';
import { SubjectService } from './subject.service';
import { RolesGuard } from 'src/shared/auth/guards/roles.guard';
import { JwtAuthGuard } from 'src/shared/auth/guards/jwtAuth.guard';
import { HasRoles } from 'src/shared/auth/decorators/roles.decorator';
import { UseGuards } from '@nestjs/common';
import { Roles } from 'src/shared/enum/role';
import { AssignSubjectsInput } from './input/assign.subject.input';
import { AssignSubjectsResponse } from './response/assign.subject.response';
@Resolver()
export class SubjectResolver {
  constructor(private subjectService: SubjectService) {}

  @Mutation(() => AssignSubjectsResponse)
  @UseGuards(JwtAuthGuard, RolesGuard)
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
}
