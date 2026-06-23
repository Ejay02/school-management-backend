import { Field, ObjectType } from '@nestjs/graphql';
import { Student } from './student.types';

@ObjectType()
export class AdminCreateStudentPayload {
  @Field(() => Student)
  student: Student;

  @Field(() => String, { nullable: true })
  temporaryPassword?: string | null;
}

