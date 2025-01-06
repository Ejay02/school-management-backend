import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { StudentService } from './student.servcie';
import { Student } from './types/student.types';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/shared/auth/guards/jwtAuth.guard';
import { AssignStudentToClassInput } from './input/assign.student.class.input';
import { Roles } from 'src/shared/enum/role';
import { HasRoles } from 'src/shared/auth/decorators/roles.decorator';
import { RolesGuard } from 'src/shared/auth/guards/roles.guard';

@Resolver()
export class StudentResolver {
  constructor(private studentService: StudentService) {}

  @Query(() => [Student])
  @HasRoles(Roles.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getAllStudents() {
    return this.studentService.getAllStudents();
  }

  @Query(() => Student)
  @HasRoles(Roles.ADMIN, Roles.TEACHER, Roles.PARENT, Roles.STUDENT)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getStudentById(@Args('studentId') studentId: string) {
    return this.studentService.getStudentById(studentId);
  }

  @HasRoles(Roles.ADMIN, Roles.TEACHER, Roles.PARENT)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Mutation(() => Student)
  async assignStudentToClass(@Args('input') input: AssignStudentToClassInput) {
    return this.studentService.assignStudentToClass(input);
  }
}
