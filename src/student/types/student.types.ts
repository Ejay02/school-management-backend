import { Field, Int, ObjectType } from '@nestjs/graphql';
import { Parent } from 'src/parent/types/parent.types';
import { Class } from 'src/class/types/class.types';
import { Grade } from 'src/grade/types/grade.types';
import { Attendance } from 'src/attendance/types/attendance.types';
import { Result } from 'src/result/types/result.types';

@ObjectType()
export class Student {
  @Field()
  id: string;

  @Field()
  username: string;

  @Field()
  role: string;

  @Field()
  name: string;

  @Field()
  surname: string;

  @Field({ nullable: true })
  email?: string;

  @Field()
  password: string;

  @Field({ nullable: true })
  phone?: string;

  @Field()
  address: string;

  @Field({ nullable: true })
  img?: string;

  @Field()
  bloodType: string;

  @Field()
  sex: string;

  @Field()
  parentId: string;

  @Field(() => Parent)
  parent: Parent;

  @Field(() => Int)
  classId: number;

  @Field(() => Class)
  class: Class;

  @Field(() => Int)
  gradeId: number;

  @Field(() => Grade)
  grade: Grade;

  @Field(() => [Attendance])
  attendances: Attendance[];

  @Field(() => [Result])
  results: Result[];

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
