import { Field, InputType } from '@nestjs/graphql';
import { EventVisibility } from '../enum/eventVisibility';
import { Roles } from '../../shared/enum/role';

@InputType()
export class EditEventInput {
  @Field(() => String)
  title: string;

  @Field(() => String)
  description: string;

  @Field(() => Date)
  startTime: Date;

  @Field(() => Date)
  endTime: Date;

  @Field(() => String)
  location: string;

  @Field(() => EventVisibility)
  visibility: EventVisibility;

  @Field(() => [Roles])
  targetRoles: Roles[];

  @Field(() => String, { nullable: true })
  classId?: string;
}
