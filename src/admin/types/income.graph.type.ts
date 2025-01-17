import { Field, ObjectType } from '@nestjs/graphql';

// @InputType()
// export class IncomeGraph {
//   @Field()
//   year: string; // Academic year

//   @Field({ nullable: true })
//   @IsOptional()
//   classId?: string; // Optional class filter

//   @Field({ nullable: true })
//   @IsOptional()
//   term?: string; // Optional term filter (e.g., 'Term 1', 'Term 2', etc.)
// }

// Monthly revenue data
@ObjectType()
export class MonthlyRevenue {
  @Field(() => [Number])
  revenue: number[];
}
