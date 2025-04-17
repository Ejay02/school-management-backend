import { Teacher } from 'src/teacher/types/teacher.types';
import { Parent } from 'src/parent/types/parent.types';
import { Field, ObjectType } from '@nestjs/graphql';
import { Admin } from '../types/admin.types';

@ObjectType()
export class AdminUsersResponse {
  @Field(() => [Admin])
  admins: Admin[];

  @Field(() => [Teacher])
  teachers: Teacher[];

  @Field(() => [Parent])
  parents: Parent[];
}
