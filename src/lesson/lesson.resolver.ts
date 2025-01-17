import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import { LessonService } from './lesson.service';
import { Lesson } from './types/lesson.types';
import { Roles } from 'src/shared/enum/role';
import { HasRoles } from 'src/shared/auth/decorators/roles.decorator';
import { CreateLessonInput } from './input/create.lesson.input';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/shared/auth/guards/jwtAuth.guard';
import { RolesGuard } from 'src/shared/auth/guards/roles.guard';
import { EditLessonInput } from './input/edit.lesson.input';
import { DeleteResponse } from 'src/shared/auth/response/delete.response';
import { PaginationInput } from 'src/shared/pagination/input/pagination.input';

@Resolver()
@UseGuards(JwtAuthGuard, RolesGuard)
export class LessonResolver {
  constructor(private lessonService: LessonService) {}

  @Query(() => [Lesson])
  @HasRoles(
    Roles.ADMIN,
    Roles.TEACHER,
    Roles.PARENT,
    Roles.STUDENT,
    Roles.SUPER_ADMIN,
  )
  async getAllLessons(
    @Context() context,
    @Args('params', { nullable: true }) params?: PaginationInput,
  ) {
    const result = await this.lessonService.getAllLessons(
      context.req.user.userId,
      context.req.user.role,
      params || {},
    );
    return result.data;
  }

  @Query(() => Lesson)
  @UseGuards(JwtAuthGuard)
  async getLessonById(@Args('id', { type: () => String }) id: string) {
    return await this.lessonService.getLessonById(id);
  }

  @Mutation(() => Lesson)
  @HasRoles(Roles.ADMIN, Roles.ADMIN, Roles.TEACHER)
  async createLesson(
    @Context() context,
    @Args('createLessonInput') createLessonInput: CreateLessonInput,
    @Args('subjectId') subjectId: string,
    @Args('classId') classId: string,
  ) {
    const userId = context.req.user.userId;

    return await this.lessonService.createLesson(
      createLessonInput,
      subjectId,
      classId,
      userId,
      context.req.user.role,
    );
  }

  @Mutation(() => Lesson)
  @HasRoles(Roles.ADMIN, Roles.TEACHER, Roles.SUPER_ADMIN)
  async editLesson(
    @Context() context,
    @Args('lessonId') lessonId: string,
    @Args('editLessonInput') editLessonInput: EditLessonInput,
  ) {
    const userId = context.req.user.userId;

    return await this.lessonService.editLesson(
      lessonId,
      userId,
      context.req.user.role,
      editLessonInput,
    );
  }

  @Mutation(() => Lesson)
  @HasRoles(Roles.ADMIN, Roles.TEACHER, Roles.SUPER_ADMIN)
  async assignLessonsToClass(
    @Args('classId') classId: string,
    @Args('lessons', { type: () => [String] }) lessons: string[],
  ) {
    await this.lessonService.assignLessonsToClass(classId, lessons);
  }

  @Mutation(() => Lesson)
  @HasRoles(Roles.ADMIN, Roles.TEACHER, Roles.SUPER_ADMIN)
  async assignLessonsToTeacher(
    @Args('teacherId') teacherId: string,
    @Args('lessons', { type: () => [String] }) lessons: string[],
  ) {
    await this.lessonService.assignLessonsToTeacher(teacherId, lessons);
  }

  @Mutation(() => DeleteResponse)
  @HasRoles(Roles.ADMIN, Roles.SUPER_ADMIN)
  async deleteLesson(@Context() context, @Args('lessonId') lessonId: string) {
    return await this.lessonService.deleteLesson(
      lessonId,
      context.req.user.role,
    );
  }
}
