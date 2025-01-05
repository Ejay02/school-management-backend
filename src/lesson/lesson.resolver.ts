import { Args, Context, Mutation, Resolver } from '@nestjs/graphql';
import { LessonService } from './lesson.service';
import { Lesson } from './types/lesson.types';
import { Roles } from 'src/shared/enum/role';
import { HasRoles } from 'src/shared/auth/decorators/roles.decorator';
import { CreateLessonInput } from './input/create.lesson.input';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/shared/auth/guards/jwtAuth.guard';
import { RolesGuard } from 'src/shared/auth/guards/roles.guard';

@Resolver()
export class LessonResolver {
  constructor(private lessonService: LessonService) {}

  @Mutation(() => Lesson)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @HasRoles(Roles.ADMIN, Roles.TEACHER)
  async createLesson(
    @Context() context,
    @Args('createLessonInput') createLessonInput: CreateLessonInput,
    @Args('subjectId') subjectId: string,
    @Args('classId') classId: string,
  ) {
    const userId = context.req.user.userId;

    return this.lessonService.createLesson(
      createLessonInput,
      subjectId,
      classId,
      userId,
      context.req.user.role,
    );
  }
}
