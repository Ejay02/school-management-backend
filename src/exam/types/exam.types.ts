import { Field, Int, ObjectType } from '@nestjs/graphql';
import { Lesson } from 'src/lesson/types/lesson.types';
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

  @Field(() => [Result])
  results: Result[];

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
