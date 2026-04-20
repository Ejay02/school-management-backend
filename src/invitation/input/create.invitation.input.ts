import { Field, InputType } from '@nestjs/graphql';
import { IsEmail, IsEnum } from 'class-validator';
import { Roles } from 'src/shared/enum/role';

@InputType()
export class CreateInvitationInput {
  @Field()
  @IsEmail()
  email: string;

  @Field(() => Roles)
  @IsEnum(Roles)
  role: Roles;
}

