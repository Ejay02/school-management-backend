import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class PublicSubject {
  @Field()
  id: string;

  @Field()
  name: string;
}
