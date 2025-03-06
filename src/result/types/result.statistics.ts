import { ObjectType, Field, Int, Float } from '@nestjs/graphql';

@ObjectType()
class ScoreDistribution {
  @Field(() => Int)
  above90: number;

  @Field(() => Int)
  above80: number;

  @Field(() => Int)
  above70: number;

  @Field(() => Int)
  above60: number;

  @Field(() => Int)
  below50: number;
}

@ObjectType()
export class ResultStatistics {
  @Field(() => Float)
  average: number;

  @Field(() => Float)
  highest: number;

  @Field(() => Float)
  lowest: number;

  @Field(() => Int)
  totalStudents: number;

  @Field(() => ScoreDistribution)
  distribution: ScoreDistribution;
}
