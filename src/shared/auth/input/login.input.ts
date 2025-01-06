import { Field, InputType } from '@nestjs/graphql';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { Roles } from '../../enum/role';
import { Sex } from 'src/shared/enum/sex';
import { BloodType } from 'src/shared/enum/bloodType';

@InputType()
export class BaseLoginInput {
  @Field()
  @IsString()
  @IsNotEmpty()
  username: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  password: string;
}

@InputType()
export class AdminLoginInput extends BaseLoginInput {
  @Field(() => Roles)
  @IsEnum([Roles.ADMIN, Roles.SUPER_ADMIN])
  role: Roles;
}

@InputType()
export class TeacherLoginInput extends BaseLoginInput {
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
export class StudentLoginInput extends BaseLoginInput {
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

  @Field()
  @IsNotEmpty()
  gradeId: string;
}

@InputType()
export class ParentLoginInput extends BaseLoginInput {
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
