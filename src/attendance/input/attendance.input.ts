import { Field, InputType } from '@nestjs/graphql';
import { AttendanceStatus } from '../types/attendance.types';

@InputType()
export class MarkAttendanceInput {
  @Field(() => String)
  studentId: string;

  @Field(() => Boolean)
  present: boolean;

  @Field(() => AttendanceStatus, { nullable: true })
  status?: AttendanceStatus;

  @Field(() => String, { nullable: true })
  reason?: string;

  @Field(() => String, { nullable: true })
  reasonCode?: string;

  @Field(() => String, { nullable: true })
  note?: string;

  @Field(() => Date)
  date: Date;
}
