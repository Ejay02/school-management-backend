import { ObjectType, Field, Int } from '@nestjs/graphql';

@ObjectType()
export class SchoolAttendanceStats {
  @Field(() => [String])
  labels: string[];

  @Field(() => [Int])
  present: number[];

  @Field(() => [Int])
  absent: number[];

  @Field(() => Int)
  studentCount: number;
}
