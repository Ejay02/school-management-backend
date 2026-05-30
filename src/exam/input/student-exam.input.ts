import { Field, Float, InputType, Int } from '@nestjs/graphql';
import GraphQLJSON from 'graphql-type-json';

@InputType()
export class AssignExamToStudentInput {
  @Field()
  examId: string;

  @Field()
  studentId: string;
}

@InputType()
export class StartExamInput {
  @Field()
  examId: string;

  @Field()
  studentId: string;
}

@InputType()
export class CompleteExamInput {
  @Field()
  examId: string;

  @Field()
  studentId: string;

  @Field(() => Float, { nullable: true })
  score?: number;
}

@InputType()
export class StudentAnswerInput {
  @Field()
  questionId: string;

  @Field()
  answer: string;
}

@InputType()
export class CompleteExamWithAnswersInput {
  @Field()
  examId: string;

  @Field()
  studentId: string;

  @Field(() => [StudentAnswerInput])
  answers: StudentAnswerInput[];
}

@InputType()
export class StudentExamAnswerOpInput {
  @Field()
  opId: string;

  @Field()
  kind: string;

  @Field({ nullable: true })
  questionId?: string;

  @Field({ nullable: true })
  answer?: string;

  @Field(() => Int)
  baseVersion: number;

  @Field({ nullable: true })
  clientCreatedAt?: Date;
}

@InputType()
export class SyncStudentExamAnswersInput {
  @Field()
  examId: string;

  @Field()
  studentId: string;

  @Field(() => [StudentExamAnswerOpInput])
  ops: StudentExamAnswerOpInput[];

  @Field({ nullable: true })
  clientAnswersHash?: string;

  @Field({ nullable: true })
  clientNow?: Date;

  @Field(() => GraphQLJSON, { nullable: true })
  clientState?: unknown;
}
