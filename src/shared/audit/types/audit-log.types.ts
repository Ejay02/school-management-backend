import { Field, Int, ObjectType } from '@nestjs/graphql';
import { Roles } from '../../enum/role';

@ObjectType()
export class AuditLogChange {
  @Field(() => String)
  field: string;

  @Field(() => String, { nullable: true })
  before?: string | null;

  @Field(() => String, { nullable: true })
  after?: string | null;
}

@ObjectType()
export class AuditLogEntry {
  @Field(() => String)
  id: string;

  @Field(() => String)
  action: string;

  @Field(() => String)
  entityType: string;

  @Field(() => String, { nullable: true })
  entityId?: string | null;

  @Field(() => String, { nullable: true })
  entityLabel?: string | null;

  @Field(() => String, { nullable: true })
  actorId?: string | null;

  @Field(() => String, { nullable: true })
  actorUsername?: string | null;

  @Field(() => String, { nullable: true })
  actorName?: string | null;

  @Field(() => String, { nullable: true })
  actorSurname?: string | null;

  @Field(() => String, { nullable: true })
  actorEmail?: string | null;

  @Field(() => Roles, { nullable: true })
  actorRole?: Roles | null;

  @Field(() => String, { nullable: true })
  ipAddress?: string | null;

  @Field(() => Date)
  timestamp: Date;

  @Field(() => [AuditLogChange], { nullable: true })
  changes?: AuditLogChange[] | null;
}

@ObjectType()
export class AuditLogPageInfo {
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
export class AuditLogListResponse {
  @Field(() => [AuditLogEntry])
  items: AuditLogEntry[];

  @Field(() => AuditLogPageInfo)
  pageInfo: AuditLogPageInfo;
}

