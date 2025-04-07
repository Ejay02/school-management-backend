import { Field, Float, ObjectType } from '@nestjs/graphql';
import { QuestionType } from '../enum/questionType';
import GraphQLJSON from 'graphql-type-json';

@ObjectType()
export class Question {
  @Field(() => String)
  id: string;

  @Field(() => QuestionType)
  type: QuestionType;

  @Field(() => String)
  content: string;

  @Field(() => GraphQLJSON, { nullable: true })
  options?: any;

  @Field(() => String, { nullable: true })
  correctAnswer?: string;

  @Field(() => Float)
  points: number;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
