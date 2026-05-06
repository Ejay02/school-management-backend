import { Resolver, Query, Args, ResolveField, Parent as GqlParent } from '@nestjs/graphql';
import { UserService } from './user.service';
import { HasRoles } from '../auth/decorators/roles.decorator';
import { Roles } from '../enum/role';
import { JwtAuthGuard } from '../auth/guards/jwtAuth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UseGuards } from '@nestjs/common';
import { UserUnion } from './types/user.union';
import { Admin } from '../../admin/types/admin.types';
import { Teacher } from '../../teacher/types/teacher.types';
import { Student } from '../../student/types/student.types';
import { Parent } from '../../parent/types/parent.types';

@Resolver()
@UseGuards(JwtAuthGuard, RolesGuard)
export class UserResolver {
  constructor(private readonly userService: UserService) {}

  @Query(() => UserUnion, { nullable: true })
  @HasRoles(
    Roles.ADMIN,
    Roles.SUPER_ADMIN,
    Roles.TEACHER,
    Roles.STUDENT,
    Roles.PARENT,
  )
  async getUserById(@Args('id') id: string) {
    return this.userService.findUserById(id);
  }
}

@Resolver(() => Admin)
export class AdminStatusResolver {
  @ResolveField(() => Boolean)
  isActive(@GqlParent() admin: any) {
    return admin?.isActive ?? true;
  }
}

@Resolver(() => Teacher)
export class TeacherStatusResolver {
  @ResolveField(() => Boolean)
  isActive(@GqlParent() teacher: any) {
    return teacher?.isActive ?? true;
  }
}

@Resolver(() => Student)
export class StudentStatusResolver {
  @ResolveField(() => Boolean)
  isActive(@GqlParent() student: any) {
    return student?.isActive ?? true;
  }
}

@Resolver(() => Parent)
export class ParentStatusResolver {
  @ResolveField(() => Boolean)
  isActive(@GqlParent() parent: any) {
    return parent?.isActive ?? true;
  }
}
