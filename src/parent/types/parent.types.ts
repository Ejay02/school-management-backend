import { Field, ObjectType } from '@nestjs/graphql';
import { Student } from 'src/student/types/student.types';

@ObjectType()
export class Parent {
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

  @Field()
  phone: string;

  @Field()
  address: string;

  @Field({ nullable: true })
  img?: string;

  @Field(() => [Student])
  students: Student[];

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
