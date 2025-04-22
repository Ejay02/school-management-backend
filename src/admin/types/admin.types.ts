import { ObjectType, Field, ID } from '@nestjs/graphql';
import { Roles } from 'src/shared/enum/role';

@ObjectType()
export class Admin {
  @Field(() => ID)
  id: string;

  @Field({ nullable: true })
  name?: string;

  @Field({ nullable: true })
  surname?: string;

  @Field()
  username: string;

  @Field({ nullable: true })
  email?: string;

  @Field(() => Roles)
  role: Roles;

  @Field({ nullable: true })
  img?: string;

  @Field({ nullable: true })
  dateOfBirth?: Date;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
