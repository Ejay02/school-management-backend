import { Args, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwtAuth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { HasRoles } from '../auth/decorators/roles.decorator';
import { Roles } from '../enum/role';
import { PaginationInput } from '../pagination/input/pagination.input';
import { AuditService } from './audit.service';
import { AuditLogListResponse } from './types/audit-log.types';

@Resolver()
@UseGuards(JwtAuthGuard, RolesGuard)
export class AuditResolver {
  constructor(private readonly auditService: AuditService) {}

  @Query(() => AuditLogListResponse)
  @HasRoles(Roles.ADMIN, Roles.SUPER_ADMIN)
  async auditLogs(
    @Args('params', { nullable: true }) params?: PaginationInput,
    @Args('entityType', { nullable: true }) entityType?: string,
    @Args('actor', { nullable: true }) actor?: string,
    @Args('startDate', { nullable: true, type: () => Date }) startDate?: Date,
    @Args('endDate', { nullable: true, type: () => Date }) endDate?: Date,
  ) {
    return this.auditService.getAuditLogs(params || {}, {
      entityType,
      actor,
      startDate,
      endDate,
    });
  }
}

