import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class MarkAttendanceInput {
  @Field(() => String)
  studentId: string;

  @Field(() => Boolean)
  present: boolean;

  @Field(() => String, { nullable: true })
  status?: string;

  @Field(() => String, { nullable: true })
  reason?: string;

  @Field(() => Date)
  date: Date;
}
