import { Roles } from 'src/shared/enum/role';
import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class ResetPasswordInput {
  @Field()
  username: string;

  @Field()
  newPassword: string;

  @Field(() => Roles, { nullable: true })
  role?: Roles;
}
