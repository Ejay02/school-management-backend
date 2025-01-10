import { Field, InputType, Int } from '@nestjs/graphql';
import { SortOrder } from 'src/shared/enum/sort';

@InputType()
export class PaginationInput {
  @Field(() => Int, { nullable: true })
  page?: number;

  @Field(() => Int, { nullable: true })
  limit?: number;

  @Field(() => String, { nullable: true })
  search?: string;

  @Field(() => String, { nullable: true })
  sortBy?: string;

  @Field(() => SortOrder, { nullable: true })
  sortOrder?: SortOrder;
}
