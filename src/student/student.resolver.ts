import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import { StudentService } from './student.service';
import { Student } from './types/student.types';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/shared/auth/guards/jwtAuth.guard';
import { AssignStudentToClassInput } from './input/assign.student.class.input';
import { Roles } from 'src/shared/enum/role';
import { HasRoles } from 'src/shared/auth/decorators/roles.decorator';
import { RolesGuard } from 'src/shared/auth/guards/roles.guard';
import { PaginationInput } from 'src/shared/pagination/input/pagination.input';
import { StudentGenderStatistics } from './types/student.statistic.types';
import { UpdateProfileInput } from 'src/shared/inputs/profile-update.input';

@Resolver()
@UseGuards(JwtAuthGuard, RolesGuard)
export class StudentResolver {
  constructor(private readonly studentService: StudentService) {}

  @Query(() => [Student])
  @HasRoles(Roles.SUPER_ADMIN, Roles.ADMIN, Roles.TEACHER, Roles.PARENT)
  async getAllStudents(
    @Context() context,
    @Args('params', { nullable: true }) params?: PaginationInput,
  ) {
    const result = await this.studentService.getAllStudents(
      context.req.user.userId,
      context.req.user.role,
      params || {},
    );
    return result.data;
  }

  @Query(() => Student)
  @HasRoles(Roles.ADMIN, Roles.TEACHER, Roles.PARENT, Roles.STUDENT)
  async getStudentById(@Args('studentId') studentId: string) {
    return await this.studentService.getStudentById(studentId);
  }

  @HasRoles(Roles.ADMIN, Roles.TEACHER, Roles.PARENT)
  @Mutation(() => Student)
  async assignStudentToClass(@Args('input') input: AssignStudentToClassInput) {
    return await this.studentService.assignStudentToClass(input);
  }

  @Query(() => StudentGenderStatistics)
  @HasRoles(Roles.TEACHER, Roles.ADMIN, Roles.SUPER_ADMIN)
  async getStudentsByGender(
    @Context() context,
    @Args('params', { nullable: true }) params?: PaginationInput,
    @Args('classId', { nullable: true }) classId?: string,
  ) {
    const result = await this.studentService.getStudentsByGender(
      context.req.user.userId,
      context.req.user.role,
      params,
      classId,
    );
    return result.statistics;
  }

  @Mutation(() => Student)
  @HasRoles(Roles.STUDENT)
  async updateStudentProfile(
    @Context() context: any,
    @Args('input') input: UpdateProfileInput,
  ) {
    return this.studentService.updateStudentProfile(
      context.req.user.userId,
      input,
    );
  }
}
