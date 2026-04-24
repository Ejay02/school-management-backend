import { Field, Float, Int, ObjectType } from '@nestjs/graphql';
import { Roles } from 'src/shared/enum/role';
import { InviteStatus } from '../enum/inviteStatus';

@ObjectType()
export class Invitation {
  @Field(() => String)
  id: string;

  @Field(() => String, { nullable: true })
  name?: string;

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

  @Field(() => Date)
  sentAt: Date;

  @Field(() => Int)
  sentCount: number;

  @Field(() => Date)
  lastSentAt: Date;

  @Field(() => Date)
  expiresAt: Date;

  @Field(() => Date, { nullable: true })
  acceptedAt?: Date;

  @Field(() => Date, { nullable: true })
  revokedAt?: Date;

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

@ObjectType()
export class InvitationPageInfo {
  @Field(() => Int)
  page: number;

  @Field(() => Int)
  limit: number;

  @Field(() => Int)
  totalCount: number;

  @Field(() => Int)
  totalPages: number;

  @Field(() => Boolean)
  hasMore: boolean;
}

@ObjectType()
export class InvitationRoleSummary {
  @Field(() => Roles)
  role: Roles;

  @Field(() => Int)
  totalSent: number;

  @Field(() => Int)
  accepted: number;

  @Field(() => Int)
  pending: number;

  @Field(() => Int)
  expired: number;

  @Field(() => Int)
  revoked: number;

  @Field(() => Float)
  activationRate: number;

  @Field(() => String)
  activationLabel: string;
}

@ObjectType()
export class InvitationSummary {
  @Field(() => Int)
  totalSent: number;

  @Field(() => Int)
  accepted: number;

  @Field(() => Int)
  pending: number;

  @Field(() => Int)
  expired: number;

  @Field(() => Int)
  revoked: number;

  @Field(() => Float)
  activationRate: number;

  @Field(() => String)
  activationLabel: string;

  @Field(() => [InvitationRoleSummary])
  roleBreakdown: InvitationRoleSummary[];
}

@ObjectType()
export class InvitationListResponse {
  @Field(() => [Invitation])
  items: Invitation[];

  @Field(() => InvitationPageInfo)
  pageInfo: InvitationPageInfo;
}
