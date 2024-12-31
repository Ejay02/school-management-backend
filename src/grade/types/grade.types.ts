import { Field, Int, ObjectType } from '@nestjs/graphql';
import { Class } from 'src/class/types/class.types';
import { Student } from 'src/student/types/student.types';

@ObjectType()
export class Grade {
  @Field(() => Int)
  id: number;

  @Field(() => Int)
  level: number;

  @Field(() => [Class])
  classes: Class[];

  @Field(() => [Student])
  students: Student[];

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
