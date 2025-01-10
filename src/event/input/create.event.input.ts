import { InputType, Field } from '@nestjs/graphql';
import { EventVisibility } from '../enum/eventVisibility';
import { Roles } from 'src/shared/enum/role';
import { EventStatus } from '../enum/eventStatus';

@InputType()
export class CreateEventInput {
  @Field(() => String)
  title: string;

  @Field(() => String)
  description: string;

  @Field(() => Date)
  startTime: Date;

  @Field(() => Date)
  endTime: Date;

  @Field(() => String, { nullable: true })
  location?: string;

  @Field(() => EventStatus)
  status: EventStatus;

  @Field(() => EventVisibility)
  visibility: EventVisibility;

  @Field(() => [Roles])
  targetRoles: Roles[];

  @Field(() => String, { nullable: true })
  classId?: string;
}
