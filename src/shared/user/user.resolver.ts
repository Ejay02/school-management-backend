import { Resolver, Query, Args } from '@nestjs/graphql';
import { UserService } from './user.service';
import { HasRoles } from '../auth/decorators/roles.decorator';
import { Roles } from '../enum/role';
import { JwtAuthGuard } from '../auth/guards/jwtAuth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UseGuards } from '@nestjs/common';
import { UserUnion } from './types/user.union';

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
