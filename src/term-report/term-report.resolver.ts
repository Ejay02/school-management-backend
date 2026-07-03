import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/shared/auth/guards/jwtAuth.guard';
import { RolesGuard } from 'src/shared/auth/guards/roles.guard';
import { HasRoles } from 'src/shared/auth/decorators/roles.decorator';
import { Roles } from 'src/shared/enum/role';
import { Term } from 'src/payment/enum/term';
import { ManageTermReportInput } from './input/manage.term-report.input';
import { UpsertTermReportRemarkInput } from './input/upsert.term-report-remark.input';
import { TermReportService } from './term-report.service';
import {
  StudentTermReport,
  StudentTermReportSummary,
  TermReportRemark,
} from './types/term-report.types';

@Resolver()
@UseGuards(JwtAuthGuard, RolesGuard)
export class TermReportResolver {
  constructor(private readonly termReportService: TermReportService) {}

  @Query(() => StudentTermReport)
  @HasRoles(Roles.ADMIN, Roles.SUPER_ADMIN)
  async getStudentTermReport(
    @Args('studentId') studentId: string,
    @Args('academicPeriod') academicPeriod: string,
    @Args('term', { type: () => Term }) term: Term,
  ) {
    return this.termReportService.getStudentTermReport(
      studentId,
      academicPeriod,
      term,
    );
  }

  @Query(() => [StudentTermReportSummary])
  @HasRoles(Roles.ADMIN, Roles.SUPER_ADMIN)
  async getClassTermReportSummaries(
    @Args('classId') classId: string,
    @Args('academicPeriod') academicPeriod: string,
    @Args('term', { type: () => Term }) term: Term,
  ) {
    return this.termReportService.getClassTermReportSummaries(
      classId,
      academicPeriod,
      term,
    );
  }

  @Mutation(() => TermReportRemark)
  @HasRoles(Roles.ADMIN, Roles.SUPER_ADMIN)
  async upsertTermReportRemark(
    @Args('input') input: UpsertTermReportRemarkInput,
    @Context() context,
  ) {
    return this.termReportService.upsertTermReportRemark(
      input,
      context.req.user.userId,
      context.req.user.role,
    );
  }

  @Mutation(() => StudentTermReport)
  @HasRoles(Roles.ADMIN, Roles.SUPER_ADMIN)
  async publishStudentTermReport(
    @Args('input') input: ManageTermReportInput,
    @Context() context,
  ) {
    return this.termReportService.publishStudentTermReport(
      input,
      context.req.user.userId,
      context.req.user.role,
    );
  }

  @Mutation(() => StudentTermReport)
  @HasRoles(Roles.ADMIN, Roles.SUPER_ADMIN)
  async revertStudentTermReportToDraft(
    @Args('input') input: ManageTermReportInput,
    @Context() context,
  ) {
    return this.termReportService.revertStudentTermReportToDraft(
      input,
      context.req.user.userId,
      context.req.user.role,
    );
  }
}
