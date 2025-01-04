import { Field, ObjectType } from '@nestjs/graphql';
import { Teacher } from 'src/teacher/types/teacher.types';
import { Lesson } from 'src/lesson/types/lesson.types';

@ObjectType()
export class Subject {
  @Field(() => String)
  id: string;

  @Field()
  name: string;

  @Field(() => [Teacher])
  teachers: Teacher[];

  @Field(() => [Lesson])
  lessons: Lesson[];

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
