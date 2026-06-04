import { Field, InputType, Int } from '@nestjs/graphql';
import { Max, Min, IsNumber, IsOptional, IsString } from 'class-validator';
import { Term } from '../../payment/enum/term';

@InputType()
export class GradeSubmissionInput {
  @Field(() => String)
  @IsString()
  submissionId: string;

  @Field(() => Int)
  @IsNumber()
  @Min(0)
  @Max(100)
  score: number;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  academicPeriod?: string;

  @Field(() => Term, { nullable: true })
  @IsOptional()
  term?: Term;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  comments?: string;
}
