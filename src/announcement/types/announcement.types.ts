import { Field, ObjectType } from '@nestjs/graphql';

import { Class } from 'src/class/types/class.types';

@ObjectType()
export class Announcement {
  @Field(() => String)
  id: string;

  @Field()
  title: string;

  @Field()
  content: string;

  @Field(() => String, { nullable: true })
  classId?: string;

  @Field(() => Class, { nullable: true })
  class?: Class;

  // @Field(() => Int, { nullable: true })
  // teacherId?: string;

  // @Field(() => Teacher, { nullable: true })
  // teacher?: Teacher;

  // @Field(() => Int, { nullable: true })
  // adminId?: string;

  // @Field(() => Admin, { nullable: true })
  // admin?: Admin;

  @Field(() => String, { nullable: false })
  creatorId?: string;

  @Field(() => String, { nullable: false })
  creatorRole: string;

  @Field()
  createdAt: Date;
}
