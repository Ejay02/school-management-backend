import { Field, InputType } from '@nestjs/graphql';
import { IsEnum, IsString } from 'class-validator';
import { Term } from 'src/payment/enum/term';

@InputType()
export class ManageTermReportInput {
  @Field(() => String)
  @IsString()
  studentId: string;

  @Field(() => String)
  @IsString()
  academicPeriod: string;

  @Field(() => Term)
  @IsEnum(Term)
  term: Term;
}
