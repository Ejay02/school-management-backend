import { Field, ObjectType } from '@nestjs/graphql';
import { Roles } from 'src/shared/enum/role';
import { InviteStatus } from '../enum/inviteStatus';

@ObjectType()
export class Invitation {
  @Field(() => String)
  id: string;

  @Field(() => String)
  email: string;

  @Field(() => Roles)
  role: Roles;

  @Field(() => InviteStatus)
  status: InviteStatus;

  @Field(() => String)
  token: string;

  @Field(() => String, { nullable: true })
  invitedBy?: string;

  @Field(() => Number)
  sentCount: number;

  @Field(() => Date)
  lastSentAt: Date;

  @Field(() => Date)
  expiresAt: Date;

  @Field(() => Date, { nullable: true })
  acceptedAt?: Date;

  @Field(() => Date)
  createdAt: Date;

  @Field(() => Date)
  updatedAt: Date;
}

@ObjectType()
export class InvitationPreview {
  @Field(() => String)
  email: string;

  @Field(() => Roles)
  role: Roles;

  @Field(() => InviteStatus)
  status: InviteStatus;

  @Field(() => Date)
  expiresAt: Date;
}
