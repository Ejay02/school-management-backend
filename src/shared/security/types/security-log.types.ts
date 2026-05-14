import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class SecurityLogEntry {
  @Field(() => String)
  id: string;

  @Field(() => String)
  action: string;

  @Field(() => String, { nullable: true })
  username?: string;

  @Field(() => String)
  ipAddress: string;

  @Field(() => Date)
  timestamp: Date;

  @Field(() => String, { nullable: true })
  details?: string;
}

@ObjectType()
export class SecurityLogPageInfo {
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
export class SecurityLogListResponse {
  @Field(() => [SecurityLogEntry])
  items: SecurityLogEntry[];

  @Field(() => SecurityLogPageInfo)
  pageInfo: SecurityLogPageInfo;
}

