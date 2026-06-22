import { Field, ObjectType } from '@nestjs/graphql';
import { Roles } from 'src/shared/enum/role';

@ObjectType()
export class PasswordSetupPreview {
  @Field(() => Roles)
  role: Roles;

  @Field(() => String)
  username: string;

  @Field(() => String)
  name: string;

  @Field(() => String)
  surname: string;

  @Field(() => Date)
  expiresAt: Date;
}

