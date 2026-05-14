import { Args, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwtAuth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { HasRoles } from '../auth/decorators/roles.decorator';
import { Roles } from '../enum/role';
import { PaginationInput } from '../pagination/input/pagination.input';
import { SecurityService } from './security.service';
import { SecurityLogListResponse } from './types/security-log.types';

@Resolver()
@UseGuards(JwtAuthGuard, RolesGuard)
export class SecurityResolver {
  constructor(private readonly securityService: SecurityService) {}

  @Query(() => SecurityLogListResponse)
  @HasRoles(Roles.ADMIN, Roles.SUPER_ADMIN)
  async securityLogs(
    @Args('params', { nullable: true }) params?: PaginationInput,
    @Args('action', { nullable: true }) action?: string,
    @Args('username', { nullable: true }) username?: string,
    @Args('ipAddress', { nullable: true }) ipAddress?: string,
  ) {
    return this.securityService.getSecurityLogs(params || {}, {
      action,
      username,
      ipAddress,
    });
  }
}

