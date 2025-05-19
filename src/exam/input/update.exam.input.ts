import { Field, InputType } from '@nestjs/graphql';
import { IsDate, IsString, IsOptional } from 'class-validator';
import GraphQLJSON from 'graphql-type-json';
import { CreateQuestionInput } from 'src/shared/question/input/create-question.input';

@InputType()
export class UpdateExamInput {
  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  title?: string;

  @Field({ nullable: true })
  @IsDate()
  @IsOptional()
  startTime?: Date;

  @Field({ nullable: true })
  @IsDate()
  @IsOptional()
  endTime?: Date;

  @Field({ nullable: true })
  @IsDate()
  @IsOptional()
  date?: Date;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  description?: string;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  instructions?: string;

  @Field(() => GraphQLJSON, { nullable: true })
  @IsOptional()
  content?: any;

  @Field(() => [CreateQuestionInput], { nullable: true })
  @IsOptional()
  questions?: CreateQuestionInput[];

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  classId?: string;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  subjectId?: string;
}
