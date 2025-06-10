import { Field, ObjectType } from '@nestjs/graphql';
import { Class } from '../../class/types/class.types';
import { EventStatus } from '../enum/eventStatus';

import { Roles } from '../../shared/enum/role';
import { EventVisibility } from '../enum/eventVisibility';

@ObjectType()
export class Event {
  @Field(() => String)
  id: string;

  @Field(() => String)
  title: string;

  @Field(() => String)
  description: string;

  @Field(() => String, { nullable: true })
  classId?: string;

  @Field(() => Class, { nullable: true })
  class?: Class;

  @Field(() => String)
  creatorId: string;

  @Field(() => String)
  type: string; // e.g., 'ACADEMIC', 'EXTRA_CURRICULAR'

  @Field(() => String, { nullable: true })
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
