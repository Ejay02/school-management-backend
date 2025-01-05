import { Field, ObjectType } from '@nestjs/graphql';
import { Class } from 'src/class/types/class.types';
import { Subject } from '../types/subject.types';

@ObjectType()
export class AssignSubjectsResponse {
  @Field(() => Class)
  class: Class;

  @Field(() => [Subject])
  subjects: Subject[];
}
