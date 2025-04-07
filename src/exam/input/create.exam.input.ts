import { Field, InputType } from '@nestjs/graphql';
import { IsDate, IsString } from 'class-validator';
import { CreateQuestionInput } from 'src/shared/question/input/create-question.input';
import GraphQLJSON from 'graphql-type-json';

@InputType()
export class CreateExamInput {
  @Field()
  @IsString()
  title: string;

  @Field()
  @IsDate()
  startTime: Date;

  @Field()
  @IsDate()
  endTime: Date;

  @Field()
  date: Date;

  // @Field()
  // @IsString()
  // lessonId: string;

  @Field()
  @IsString()
  classId: string;

  @Field()
  @IsString()
  subjectId: string;

  @Field({ nullable: true })
  description?: string;

  @Field({ nullable: true })
  instructions?: string;

  @Field(() => GraphQLJSON, { nullable: true })
  content?: any;

  @Field(() => [CreateQuestionInput], { nullable: true })
  questions?: CreateQuestionInput[];
}
