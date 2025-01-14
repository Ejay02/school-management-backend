import { Field, Float, ObjectType } from '@nestjs/graphql';
import { Assignment } from 'src/assignment/types/assignment.types';

import { Exam } from 'src/exam/types/exam.types';
import { Student } from 'src/student/types/student.types';
import { GradeType } from '../enum/gradeType';

@ObjectType()
export class Grade {
  // @Field(() => String)
  // id: string;

  // @Field(() => Int)
  // level: number;

  // @Field(() => [Class])
  // classes: Class[];

  // @Field(() => [Student])
  // students: Student[];

  // @Field()
  // createdAt: Date;

  // @Field()
  // updatedAt: Date;

  @Field(() => String)
  id: string;

  @Field(() => String)
  studentId: string;

  @Field(() => Student)
  student: Student;

  @Field(() => Float)
  score: number;

  @Field(() => String, { nullable: true })
  examId?: string;

  @Field(() => Exam, { nullable: true })
  exam?: Exam;

  @Field(() => String, { nullable: true })
  assignmentId?: string;

  @Field(() => Assignment, { nullable: true })
  assignment?: Assignment;

  @Field(() => GradeType)
  type: GradeType;

  @Field(() => String)
  academicPeriod: string; // e.g., "2023-2024-SEMESTER1"

  @Field(() => String, { nullable: true })
  comments?: string;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
