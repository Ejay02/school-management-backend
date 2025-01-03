import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class TokenResponse {
  @Field()
  accessToken: string;

  @Field()
  refreshToken: string;
}
