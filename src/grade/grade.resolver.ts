import { Mutation, Resolver } from '@nestjs/graphql';
import { GradeService } from './grade.service';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/shared/auth/guards/jwtAuth.guard';
import { RolesGuard } from 'src/shared/auth/guards/roles.guard';
import { Roles } from 'src/shared/enum/role';

@Resolver()
@UseGuards(JwtAuthGuard, RolesGuard)
export class GradeResolver {
  constructor(private gradeService: GradeService) {}

  @Mutation(() => Grade)
  @Roles('TEACHER')
  @UseGuards(RoleGuard)
  async assignGrade(
    @CurrentUser('id') teacherId: string,
    @Args('input') input: CreateGradeInput,
  ) {
    return this.gradeService.assignGrade(teacherId, input);
  }

  @Mutation(() => Grade)
  @Roles('TEACHER')
  @UseGuards(RoleGuard)
  async updateGrade(
    @CurrentUser('id') teacherId: string,
    @Args('input') input: UpdateGradeInput,
  ) {
    return this.gradeService.updateGrade(teacherId, input);
  }


  
}
