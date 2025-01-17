import { Field, InputType } from '@nestjs/graphql';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { Roles } from '../../enum/role';

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
}
