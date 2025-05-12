import { Field, ID, ObjectType } from '@nestjs/graphql';
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

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
