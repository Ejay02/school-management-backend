import { Field, Int, ObjectType } from '@nestjs/graphql';
import { Exam } from 'src/exam/types/exam.types';
import { Assignment } from 'src/assignment/types/assignment.types';
import { Student } from 'src/student/types/student.types';

@ObjectType()
export class Result {
  @Field(() => Int)
  id: number;

  @Field(() => Int)
  score: number;

  @Field(() => Exam, { nullable: true })
  exam?: Exam;

  @Field(() => Int, { nullable: true })
  examId?: number;

  @Field(() => Assignment, { nullable: true })
  assignment?: Assignment;

  @Field(() => Int, { nullable: true })
  assignmentId?: number;

  @Field()
  studentId: string;

  @Field(() => Student)
  student: Student;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
