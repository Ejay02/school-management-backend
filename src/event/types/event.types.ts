import { Field, Int, ObjectType } from '@nestjs/graphql';
import { Class } from 'src/class/types/class.types';

@ObjectType()
export class Event {
  @Field(() => Int)
  id: number;

  @Field()
  title: string;

  @Field()
  description: string;

  @Field(() => Int, { nullable: true })
  classId?: number;

  @Field(() => Class, { nullable: true })
  class?: Class;

  @Field()
  startTime: Date;

  @Field()
  endTime: Date;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
