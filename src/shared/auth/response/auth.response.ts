import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class AuthResponse {
  @Field()
  token: string;

  @Field()
  userId: string;

  @Field({ nullable: true })
  role?: string;
}
