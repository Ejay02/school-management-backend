import { ObjectType, Field } from '@nestjs/graphql';
import { Roles } from 'src/shared/enum/role';

@ObjectType()
export class Admin {
  @Field()
  id: string;

  @Field()
  username: string;

  @Field({ nullable: true })
  email?: string;

  @Field(() => Roles)
  role: Roles;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
