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
export class BaseSignupInput {
  @Field()
  @IsString()
  @IsNotEmpty()
  username: string;

  @Field()
  @IsString()
  @MinLength(8)
  password: string;

  @Field({ nullable: true })
  @IsEmail()
  email?: string;
}

@InputType()
export class AdminSignupInput extends BaseSignupInput {
  @Field(() => Roles)
  @IsEnum([Roles.ADMIN, Roles.SUPER_ADMIN])
  role: Roles;
}

@InputType()
export class TeacherSignupInput extends BaseSignupInput {
  @Field(() => Roles)
  role: Roles = Roles.TEACHER;

  @Field()
  @IsString()
  name: string;

  @Field()
  @IsString()
  surname: string;

  @Field()
  @IsString()
  address: string;

  @Field(() => BloodType)
  @IsEnum(BloodType)
  bloodType: BloodType;

  @Field(() => Sex)
  @IsEnum(Sex)
  sex: Sex;

  @Field({ nullable: true })
  @IsString()
  phone?: string;
}

@InputType()
export class StudentSignupInput extends BaseSignupInput {
  @Field(() => Roles)
  role: Roles = Roles.STUDENT;

  @Field()
  @IsString()
  name: string;

  @Field()
  @IsString()
  surname: string;

  @Field()
  @IsString()
  phone: string;

  @Field()
  @IsString()
  address: string;

  @Field(() => BloodType)
  @IsEnum(BloodType)
  bloodType: BloodType;

  @Field(() => Sex)
  @IsEnum(Sex)
  sex: Sex;

  @Field()
  @IsString()
  parentId: string;

  @Field()
  @IsNotEmpty()
  classId: string;
}

@InputType()
export class ParentSignupInput extends BaseSignupInput {
  @Field(() => Roles)
  role: Roles = Roles.PARENT;

  @Field()
  @IsString()
  name: string;

  @Field()
  @IsString()
  surname: string;

  @Field()
  @IsString()
  phone: string;

  @Field()
  @IsString()
  address: string;
}
