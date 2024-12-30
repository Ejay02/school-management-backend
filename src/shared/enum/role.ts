import { registerEnumType } from '@nestjs/graphql';

export enum Roles {
  ADMIN = 'ADMIN',
  SUPER_ADMIN = 'SUPER_ADMIN',
  TEACHER = 'TEACHER',
  PARENT = 'PARENT',
  STUDENT = 'STUDENT',
}

registerEnumType(Roles, {
  name: 'Roles',
});
