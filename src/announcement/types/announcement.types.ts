import { Field, ObjectType } from '@nestjs/graphql';

import { Class } from '../../class/types/class.types';
import { Roles } from '../../shared/enum/role';

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

  @Field(() => [Roles])
  targetRoles: Roles[];

  @Field(() => String, { nullable: false })
  creatorId?: string;

  @Field(() => String, { nullable: false })
  creatorRole: string;

  @Field(() => Date, { nullable: true })
  archivedAt?: Date;

  @Field(() => Date, { nullable: true })
  readAt?: Date;

  @Field()
  createdAt: Date;
}
