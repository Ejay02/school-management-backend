import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class DeleteResponse {
  @Field()
  success: boolean;

  @Field()
  message: string;
}
