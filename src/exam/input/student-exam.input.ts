import { Field, Float, InputType } from '@nestjs/graphql';

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
