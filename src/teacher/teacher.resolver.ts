import { Resolver } from '@nestjs/graphql';
import { TeacherService } from './teacher.service';

@Resolver()
export class TeacherResolver {
  constructor(private teacherService: TeacherService) {}

  // @Query()
  // @HasRoles(Roles.TEACHER)
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // async getStudentGrades(@Args('studentId') studentId: string) {
  //   // Only assigned teachers can access
  // }
}
