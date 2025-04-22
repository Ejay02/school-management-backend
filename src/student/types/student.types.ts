import { Field, ID, ObjectType } from '@nestjs/graphql';
import { Parent } from 'src/parent/types/parent.types';
import { Class } from 'src/class/types/class.types';
import { Grade } from 'src/grade/types/grade.types';
import { Attendance } from 'src/attendance/types/attendance.types';
import { Result } from 'src/result/types/result.types';

@ObjectType()
export class Student {
  @Field(() => ID)
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

  @Field({ nullable: true }) // Don't expose password in GraphQL responses
  password?: string;

  @Field({ nullable: true })
  phone?: string;

  @Field({ nullable: true })
  address?: string;

  @Field({ nullable: true })
  img?: string;

  @Field({ nullable: true })
  bloodType?: string;

  @Field({ nullable: true })
  sex?: string;

  @Field({ nullable: true })
  dateOfBirth?: Date;

  @Field()
  parentId: string;

  @Field(() => Parent, { nullable: true })
  parent?: Parent;

  @Field()
  classId: string;

  @Field(() => Class, { nullable: true })
  class?: Class;

  @Field()
  gradeId: string;

  @Field(() => Grade, { nullable: true })
  grade?: Grade;

  @Field(() => [Attendance], { nullable: 'itemsAndList' })
  attendances?: Attendance[];

  @Field(() => [Result], { nullable: 'itemsAndList' })
  results?: Result[];

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
