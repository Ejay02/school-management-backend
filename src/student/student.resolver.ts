import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { StudentService } from './student.servcie';
import { Student } from './types/student.types';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/shared/auth/guards/jwtAuth.guard';
import { AssignStudentToClassInput } from './input/assign.student.class.input';

@Resolver()
export class StudentResolver {
  constructor(private studentService: StudentService) {}

  @Query(() => [Student])
  // @HasRoles(Roles.ADMIN)
  // @UseGuards(JwtAuthGuard, RolesGuard)
  @UseGuards(JwtAuthGuard)
  async getAllStudents() {
    return this.studentService.getAllStudents();
  }

  @Query(() => Student)
  @UseGuards(JwtAuthGuard)
  async getStudentById(@Args('studentId') studentId: string) {
    return this.studentService.getStudentById(studentId);
  }

  @Mutation(() => Student)
  async assignStudentToClass(@Args('input') input: AssignStudentToClassInput) {
    return this.studentService.assignStudentToClass(input);
  }
}
