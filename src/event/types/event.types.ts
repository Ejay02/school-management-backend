import { Field, Int, ObjectType } from '@nestjs/graphql';
import { Admin } from 'src/admin/types/admin.types';
import { Class } from 'src/class/types/class.types';

@ObjectType()
export class Event {
  @Field(() => String)
  id: string;

  @Field()
  title: string;

  @Field()
  description: string;

  @Field(() => Int, { nullable: true })
  classId?: string;

  @Field(() => Class, { nullable: true })
  class?: Class;

  @Field(() => String)
  adminId: string;

  @Field(() => Admin)
  admin: Admin;

  @Field()
  startTime: Date;

  @Field()
  endTime: Date;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
