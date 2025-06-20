import { InputType, Field } from '@nestjs/graphql';
import { IsOptional } from 'class-validator';
import { CreateQuestionInput } from '../../shared/question/input/create-question.input';
import GraphQLJSON from 'graphql-type-json';

@InputType()
export class CreateAssignmentInput {
  @Field()
  title: string;

  @Field()
  startDate: Date;

  @Field()
  dueDate: Date;

  @Field()
  @IsOptional()
  lessonId?: string;

  @Field()
  @IsOptional()
  subjectId?: string;

  @Field()
  @IsOptional()
  classId?: string;

  @Field({ nullable: true })
  description?: string;

  @Field({ nullable: true })
  instructions?: string;

  @Field(() => GraphQLJSON, { nullable: true })
  content?: any;

  @Field(() => [CreateQuestionInput], { nullable: true })
  questions?: CreateQuestionInput[];
}
