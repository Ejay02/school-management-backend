import { Field, InputType } from '@nestjs/graphql';
import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator';
import { Term } from 'src/payment/enum/term';

@InputType()
export class UpsertTermReportRemarkInput {
  @Field(() => String)
  @IsString()
  studentId: string;

  @Field(() => String)
  @IsString()
  academicPeriod: string;

  @Field(() => Term)
  @IsEnum(Term)
  term: Term;

  @Field(() => String)
  @IsString()
  @MinLength(2)
  @MaxLength(2000)
  remark: string;
}
