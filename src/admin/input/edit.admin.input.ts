import { InputType, Field } from '@nestjs/graphql';
import { IsOptional, IsString, IsEmail, MinLength } from 'class-validator';

@InputType()
export class EditAdminInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  username?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsEmail()
  email?: string;

  @Field({ nullable: true })
  @IsOptional()
  img?: string;

  @Field({ nullable: true })
  @IsOptional()
  @MinLength(6)
  password?: string;
}
