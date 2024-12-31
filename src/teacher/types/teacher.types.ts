import { Field, ObjectType } from '@nestjs/graphql';
import { Subject } from 'src/subject/types/subject.types';
import { Lesson } from 'src/lesson/types/lesson.types';
import { Class } from 'src/class/types/class.types';

@ObjectType()
export class Teacher {
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

  @Field(() => [Subject])
  subjects: Subject[];

  @Field(() => [Lesson])
  lessons: Lesson[];

  @Field(() => [Class])
  classes: Class[];

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
