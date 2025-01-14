import { Field, InputType } from '@nestjs/graphql';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { GradeType } from '../enum/gradeType';

@InputType()
export class CreateGradeInput {
  @Field()
  @IsString()
  studentId: string;

  @Field()
  @IsNumber()
  @Min(0)
  @Max(100)
  score: number;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  examId?: string;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  assignmentId?: string;

  @Field(() => GradeType)
  @IsEnum(GradeType)
  type: GradeType;

  @Field()
  @IsString()
  academicPeriod: string;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  comments?: string;
}
