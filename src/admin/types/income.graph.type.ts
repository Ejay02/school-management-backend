import { Field, ObjectType } from '@nestjs/graphql';

// Monthly revenue data
@ObjectType()
export class MonthlyRevenue {
  @Field(() => [Number])
  revenue: number[];
}
