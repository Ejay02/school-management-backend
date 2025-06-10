import { Field, ID, ObjectType } from '@nestjs/graphql';
import { Parent } from '../../parent/types/parent.types';
import { Class } from '../../class/types/class.types';

import { Attendance } from '../../attendance/types/attendance.types';
import { Result } from '../../result/types/result.types';
import { StudentExam } from '../../exam/types/student-exam.types';

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
  image?: string;

  @Field({ nullable: true })
  bloodType?: string;

  @Field({ nullable: true })
  sex?: string;

  @Field({ nullable: true })
  dateOfBirth?: Date;

  @Field({ nullable: true })
  aboutMe?: string;

  @Field()
  parentId: string;

  @Field(() => Parent, { nullable: true })
  parent?: Parent;

  @Field()
  classId: string;

  @Field(() => Class, { nullable: true })
  class?: Class;

  @Field(() => [Attendance], { nullable: 'itemsAndList' })
  attendances?: Attendance[];

  @Field()
  resultId: string;

  @Field(() => [Result], { nullable: 'itemsAndList' })
  result?: Result[];

  @Field(() => [StudentExam], { nullable: 'itemsAndList' })
  exams?: StudentExam[];

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
