import { Field, ObjectType } from '@nestjs/graphql';
import { Teacher } from '../../teacher/types/teacher.types';
import { Lesson } from '../../lesson/types/lesson.types';
import { Class } from '../../class/types/class.types';
import { Result } from '../../result/types/result.types';

@ObjectType()
export class Subject {
  @Field(() => String)
  id: string;

  @Field()
  name: string;

  @Field({ nullable: true })
  classId?: string;

  @Field(() => Class, { nullable: true })
  class?: Class;

  @Field({ nullable: true })
  resultId?: string;

  @Field(() => Result, { nullable: true })
  result?: Result;

  @Field(() => [Teacher], { nullable: 'itemsAndList' })
  teachers: Teacher[];

  @Field(() => [Lesson], { nullable: 'itemsAndList' })
  lessons: Lesson[];

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
