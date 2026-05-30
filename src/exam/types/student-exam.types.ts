import { Field, ID, ObjectType } from '@nestjs/graphql';
import GraphQLJSON from 'graphql-type-json';
import { Student } from 'src/student/types/student.types';
import { Exam } from './exam.types';

@ObjectType()
export class StudentExam {
  @Field(() => ID)
  id: string;

  @Field()
  studentId: string;

  @Field(() => Student)
  student: Student;

  @Field()
  examId: string;

  @Field(() => Exam)
  exam: Exam;

  @Field()
  hasTaken: boolean;

  @Field({ nullable: true })
  startedAt?: Date;

  @Field({ nullable: true })
  completedAt?: Date;

  @Field({ nullable: true })
  submittedAt?: Date;

  @Field(() => GraphQLJSON, { nullable: true })
  answers?: unknown;

  @Field()
  answersVersion: number;

  @Field({ nullable: true })
  lastSyncAt?: Date;

  @Field({ nullable: true })
  lastClientSyncAt?: Date;

  @Field({ nullable: true })
  answersHash?: string;

  @Field({ nullable: true })
  clientAnswersHash?: string;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}

@ObjectType()
export class StudentExamSyncRejectedOp {
  @Field()
  opId: string;

  @Field()
  reason: string;
}

@ObjectType()
export class StudentExamSyncResponse {
  @Field()
  status: string;

  @Field()
  serverVersion: number;

  @Field(() => GraphQLJSON, { nullable: true })
  serverAnswers?: unknown;

  @Field(() => [String])
  appliedOpIds: string[];

  @Field(() => [String])
  duplicateOpIds: string[];

  @Field(() => [StudentExamSyncRejectedOp])
  rejectedOps: StudentExamSyncRejectedOp[];

  @Field({ nullable: true })
  submittedAt?: Date;

  @Field({ nullable: true })
  completedAt?: Date;

  @Field()
  integrityMismatch: boolean;

  @Field({ nullable: true })
  serverAnswersHash?: string;

  @Field({ nullable: true })
  clientAnswersHash?: string;
}
