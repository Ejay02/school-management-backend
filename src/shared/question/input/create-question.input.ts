import { Field, Float, InputType } from '@nestjs/graphql';

import GraphQLJSON from 'graphql-type-json';
import { QuestionType } from '../enum/questionType';

@InputType()
export class CreateQuestionInput {
  @Field(() => QuestionType)
  questionType: QuestionType;

  @Field()
  content: string;

  @Field(() => GraphQLJSON, { nullable: true })
  options?: any;

  @Field({ nullable: true })
  correctAnswer?: string;

  @Field(() => Float, { defaultValue: 1.0 })
  points: number;
}
