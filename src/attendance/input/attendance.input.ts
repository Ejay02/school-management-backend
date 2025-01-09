import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class MarkAttendanceInput {
  @Field(() => String)
  studentId: string;

  @Field(() => Boolean)
  present: boolean;

  @Field(() => Date)
  date: Date;
}
