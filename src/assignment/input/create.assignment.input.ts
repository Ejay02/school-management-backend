import { InputType, Field } from '@nestjs/graphql';
import { IsOptional } from 'class-validator';
import { CreateQuestionInput } from 'src/shared/question/input/create-question.input';
import GraphQLJSON from 'graphql-type-json';

@InputType()
export class CreateAssignmentInput {
  @Field()
  title: string;

  @Field()
  startDate: Date;

  @Field()
  dueDate: Date;

  @IsOptional()
  lessonId?: string;

  @IsOptional()
  subjectId?: string;

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
