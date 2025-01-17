import { ObjectType, Field, Int } from '@nestjs/graphql';

@ObjectType()
export class AcademicYear {
  @Field(() => String)
  current: string;

  @Field(() => String)
  next: string;
}

@ObjectType()
export class Counts {
  @Field(() => Int)
  students: number;

  @Field(() => Int)
  parents: number;

  @Field(() => Int)
  teachers: number;

  @Field(() => Int)
  admins: number;
}

@ObjectType()
export class DashboardSummary {
  @Field(() => String)
  role: string;

  @Field(() => AcademicYear)
  academicYear: AcademicYear;

  @Field(() => Counts)
  counts: Counts;
}
