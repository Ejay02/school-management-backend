import { Field, ID, ObjectType } from '@nestjs/graphql';
import { Student } from '../../student/types/student.types';
import { Roles } from '../../shared/enum/role';

@ObjectType()
export class Parent {
  @Field(() => ID)
  id: string;

  @Field()
  username: string;

  @Field(() => Roles)
  role: Roles;

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
  aboutMe?: string;

  @Field({ nullable: true })
  dateOfBirth?: Date;

  @Field()
  isActive: boolean;

  @Field({ nullable: true })
  deactivatedAt?: Date;

  @Field(() => [Student])
  students: Student[];

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
