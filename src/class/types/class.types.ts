import { Field, Int, ObjectType } from '@nestjs/graphql';
import { Lesson } from 'src/lesson/types/lesson.types';
import { Student } from 'src/student/types/student.types';
import { Teacher } from 'src/teacher/types/teacher.types';
import { Grade } from 'src/grade/types/grade.types';
import { Event } from 'src/event/types/event.types';
import { Announcement } from 'src/announcement/types/announcement.types';

@ObjectType()
export class Class {
  @Field(() => Int)
  id: number;

  @Field()
  name: string;

  @Field(() => Int)
  capacity: number;

  @Field(() => [Lesson])
  lessons: Lesson[];

  @Field(() => [Student])
  students: Student[];

  @Field(() => String, { nullable: true })
  supervisorId?: string;

  @Field(() => Teacher, { nullable: true })
  supervisor?: Teacher;

  @Field(() => Int)
  gradeId: number;

  @Field(() => Grade)
  grade: Grade;

  @Field(() => [Event])
  events: Event[];

  @Field(() => [Announcement])
  announcements: Announcement[];

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
