import { Field, InputType } from '@nestjs/graphql';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsString,
  MinLength,
} from 'class-validator';
import { Roles } from '../../enum/role';
import { DefaultClass } from 'src/class/enum/class';

@InputType()
export class BaseSignupInput {
  @Field()
  @IsString()
  @IsNotEmpty()
  username: string;

  @Field()
  @IsString()
  name: string;

  @Field()
  @IsString()
  surname: string;

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
}

@InputType()
export class StudentSignupInput extends BaseSignupInput {
  @Field(() => Roles)
  role: Roles = Roles.STUDENT;

  @Field()
  @IsString()
  parentId: string;

  @Field(() => DefaultClass)
  classId: DefaultClass;
}

@InputType()
export class ParentSignupInput extends BaseSignupInput {
  @Field(() => Roles)
  role: Roles = Roles.PARENT;
}
