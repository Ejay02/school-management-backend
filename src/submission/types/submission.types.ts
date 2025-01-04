import { Field, Int, ObjectType } from '@nestjs/graphql';
import { Assignment } from 'src/assignment/types/assignment.types';
import { Grade } from 'src/grade/types/grade.types';
import { Student } from 'src/student/types/student.types';

@ObjectType()
export class Submission {
  @Field(() => String)
  id: string;

  @Field(() => Int)
  assignmentId: number;

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

  @Field(() => Grade, { nullable: true })
  grade?: Grade;
}
