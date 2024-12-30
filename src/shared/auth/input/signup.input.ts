import { Field, InputType } from '@nestjs/graphql';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsString,
  MinLength,
} from 'class-validator';
import { Roles } from '../../enum/role';
import { Sex } from 'src/shared/enum/sex';
import { BloodType } from 'src/shared/enum/bloodType';

@InputType()
export class SignupInput {
  @Field()
  @IsString()
  @IsNotEmpty()
  name: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  surname: string;

  @Field()
  @IsNotEmpty()
  @IsString()
  username: string;

  @Field()
  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  password: string;

  @Field({ nullable: true })
  @IsEmail()
  email?: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  address: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  phone: string;

  @Field(() => Roles)
  @IsEnum(Roles)
  role: Roles;

  @Field(() => String)
  @IsEnum(BloodType)
  bloodType: BloodType;

  @Field(() => String)
  @IsEnum(Sex)
  sex: Sex;

  @Field()
  @IsNotEmpty()
  parentId: string;

  @Field()
  @IsNotEmpty()
  classId: number;

  @Field()
  @IsNotEmpty()
  gradeId: number;
}
