import { Field, InputType } from '@nestjs/graphql';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';
import { Roles } from 'src/shared/enum/role';

@InputType()
export class CreateInvitationInput {
  @Field()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @Field()
  @IsEmail()
  email: string;

  @Field(() => Roles)
  @IsEnum(Roles)
  role: Roles;
}
