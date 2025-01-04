import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class PublicClass {
  @Field()
  id: string;

  @Field()
  name: string;
}
