import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class AuthResponse {
  @Field({ nullable: true })
  id?: string;

  @Field()
  token: string;

  @Field()
  refreshToken?: string;

  @Field()
  userId: string;

  @Field({ nullable: true })
  role?: string;

  @Field({ nullable: true })
  username: string;

  @Field({ nullable: true })
  name?: string;

  @Field({ nullable: true })
  surname?: string;

  @Field({ nullable: false })
  email?: string;

  @Field({ nullable: true })
  address?: string;

  @Field({ nullable: true })
  phone?: string;

  @Field({ nullable: true })
  bloodType?: string;

  @Field({ nullable: true })
  sex?: string;

  @Field({ nullable: true })
  parentId?: string;

  @Field({ nullable: true })
  classId?: string;

  @Field({ nullable: true })
  gradeId?: string;
}
