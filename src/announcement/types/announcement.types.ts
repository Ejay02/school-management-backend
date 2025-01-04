import { Field, Int, ObjectType } from '@nestjs/graphql';
import { Admin } from 'src/admin/types/admin.types';
import { Class } from 'src/class/types/class.types';
import { Teacher } from 'src/teacher/types/teacher.types';

@ObjectType()
export class Announcement {
  @Field(() => String)
  id: string;

  @Field()
  title: string;

  @Field()
  description: string;

  @Field(() => Int, { nullable: true })
  classId?: number;

  @Field(() => Class, { nullable: true })
  class?: Class;

  @Field(() => Int, { nullable: true })
  teacherId?: number;

  @Field(() => Teacher, { nullable: true })
  teacher?: Teacher;

  @Field(() => Int, { nullable: true })
  adminId?: number;

  @Field(() => Admin, { nullable: true })
  admin?: Admin;

  @Field()
  date: Date;

  @Field()
  createdAt: Date;
}
