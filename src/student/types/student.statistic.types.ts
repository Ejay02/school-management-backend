import { ObjectType, Field, Int, Float } from '@nestjs/graphql';

@ObjectType()
export class StudentGenderStatistics {
  @Field(() => Int)
  totalStudents: number;

  @Field(() => Int)
  maleCount: number;

  @Field(() => Int)
  femaleCount: number;

  @Field(() => Float)
  malePercentage: number;

  @Field(() => Float)
  femalePercentage: number;

  @Field()
  totalCapacity: number;
}
