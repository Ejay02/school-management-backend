import { ObjectType, Field } from '@nestjs/graphql';
import { Admin } from '../types/admin.types';

@ObjectType()
export class EditAdminResponse {
  @Field()
  success: boolean;

  @Field()
  message: string;

  @Field(() => Admin, { nullable: true })
  admin?: Admin;
}
