import { Field, Int, ObjectType } from '@nestjs/graphql';
import { Lesson } from 'src/lesson/types/lesson.types';
import { Class } from 'src/class/types/class.types';
import { Subject } from 'src/subject/types/subject.types';
import { Teacher } from 'src/teacher/types/teacher.types';
import { Result } from 'src/result/types/result.types';

@ObjectType()
export class Exam {
  @Field(() => Int)
  id: number;

  @Field()
  title: string;

  @Field()
  startTime: Date;

  @Field()
  endTime: Date;

  @Field(() => Int)
  lessonId: number;

  @Field(() => Lesson)
  lesson: Lesson;

  @Field(() => Int)
  classId: number;

  @Field(() => Class)
  class: Class;

  @Field(() => Int)
  subjectId: number;

  @Field(() => Subject)
  subject: Subject;

  @Field(() => String)
  teacherId: string;

  @Field(() => Teacher)
  teacher: Teacher;

  @Field(() => [Result])
  results: Result[];

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
