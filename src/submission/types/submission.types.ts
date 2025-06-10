import { Field, ObjectType } from '@nestjs/graphql';
import { Assignment } from '../../assignment/types/assignment.types';
import { Result } from '../../result/types/result.types';

import { Student } from '../../student/types/student.types';

@ObjectType()
export class Submission {
  @Field(() => String)
  id: string;

  @Field(() => String)
  assignmentId: string;

  @Field(() => Assignment)
  assignment: Assignment;

  @Field(() => String)
  studentId: string;

  @Field(() => Student)
  student: Student;

  @Field(() => String, { nullable: true })
  content?: string; // Content of the submission (optional)

  @Field(() => Date)
  submissionDate: Date;

  @Field()
  status: string; // Status (e.g., 'submitted', 'graded')

  @Field(() => Result, { nullable: true })
  result?: Result;
}
