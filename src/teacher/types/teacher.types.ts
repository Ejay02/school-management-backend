import { Field, ID, ObjectType } from '@nestjs/graphql';
import { Subject } from '../../subject/types/subject.types';
import { Lesson } from '../../lesson/types/lesson.types';
import { Class } from '../../class/types/class.types';

@ObjectType()
export class Teacher {
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

  @Field({ nullable: true })
  password: string;

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
  aboutMe?: string;

  @Field({ nullable: true })
  dateOfBirth?: Date;

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
