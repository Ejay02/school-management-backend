import { Field, ObjectType } from '@nestjs/graphql';
import { Class } from 'src/class/types/class.types';
import { EventStatus } from '../enum/eventStatus';
import { EventVisibility } from '@prisma/client';
import { Roles } from 'src/shared/enum/role';

@ObjectType()
export class Event {
  @Field(() => String)
  id: string;

  @Field()
  title: string;

  @Field()
  description: string;

  @Field(() => String, { nullable: true })
  classId?: string;

  @Field(() => Class, { nullable: true })
  class?: Class;

  @Field(() => String)
  creatorId: string;

  @Field()
  type: string; // e.g., 'ACADEMIC', 'EXTRA_CURRICULAR'

  @Field({ nullable: true })
  location?: string;

  @Field(() => EventStatus)
  status: EventStatus;

  @Field(() => EventVisibility)
  visibility: EventVisibility;

  @Field(() => [Roles])
  targetRoles: Roles[];

  @Field(() => Date)
  startTime: Date;

  @Field(() => Date)
  endTime: Date;

  @Field(() => Date)
  createdAt: Date;

  @Field(() => Date)
  updatedAt: Date;
}
