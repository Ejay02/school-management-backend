import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty } from 'class-validator';

@InputType()
export class AssignStudentToClassInput {
  @Field()
  @IsNotEmpty()
  studentId: string;

  @Field()
  @IsNotEmpty()
  classId: string;
}
