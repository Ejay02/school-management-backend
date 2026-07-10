import { Resolver, Query, Mutation, Args, Context } from '@nestjs/graphql';
import { PaymentService } from './payment.service';
import { JwtAuthGuard } from 'src/shared/auth/guards/jwtAuth.guard';
import { RolesGuard } from 'src/shared/auth/guards/roles.guard';
import { UseGuards } from '@nestjs/common';
import { HasRoles } from 'src/shared/auth/decorators/roles.decorator';
import { Roles } from 'src/shared/enum/role';
import { FeeStructure } from './types/fee.structure.type';
import { CreateFeeStructureInput } from './input/create.fee.structure.input';
import { Invoice } from './types/invoice.type';
import { PaginationInput } from 'src/shared/pagination/input/pagination.input';
import { UpdateFeeStructureInput } from './input/update.fee.structure.input';
import { DeleteResponse } from 'src/shared/auth/response/delete.response';
import { StudentPayment } from './types/student.payment.type';
import {
  BillingReportDashboard,
  FinanceOverview,
} from './types/billing.report.dashboard.type';
import { FinanceReconciliationRecord, BulkInvoiceResult } from './types/finance.reconciliation.type';

@Resolver()
@UseGuards(JwtAuthGuard, RolesGuard)
export class PaymentResolver {
  constructor(private readonly paymentService: PaymentService) {}

  @Query(() => [FeeStructure])
  @HasRoles(Roles.SUPER_ADMIN, Roles.ADMIN)
  async getAllFeeStructures(
    @Args('params', { nullable: true }) params?: PaginationInput,
  ) {
    const result = await this.paymentService.getAllFeeStructures(params || {});
    return result.data;
  }

  @Query(() => FeeStructure)
  @HasRoles(Roles.SUPER_ADMIN, Roles.ADMIN)
  async getFeeStructureById(@Args('feeStructureId') feeStructureId: string) {
    return await this.paymentService.getFeeStructureById(feeStructureId);
  }

  @Mutation(() => FeeStructure)
  @HasRoles(Roles.SUPER_ADMIN, Roles.ADMIN)
  async createFeeStructure(@Args('input') input: CreateFeeStructureInput) {
    return await this.paymentService.createFeeStructure(input);
  }

  @Mutation(() => FeeStructure)
  @HasRoles(Roles.SUPER_ADMIN, Roles.ADMIN)
  async updateFeeStructure(
    @Args('id') id: string,
    @Args('input') input: UpdateFeeStructureInput,
  ) {
    return await this.paymentService.updateFeeStructure(id, input);
  }

  @Mutation(() => DeleteResponse)
  @HasRoles(Roles.SUPER_ADMIN)
  async deleteFeeStructure(
    @Args('feeStructureId') feeStructureId: string,
  ): Promise<DeleteResponse> {
    return await this.paymentService.deleteFeeStructure(feeStructureId);
  }

  @Mutation(() => Invoice)
  @HasRoles(Roles.PARENT)
  async generateInvoice(
    @Context() context: any,
    @Args('feeStructureId') feeStructureId: string,
  ) {
    return await this.paymentService.generateInvoice(
      context.req.user.userId,
      feeStructureId,
    );
  }

  @Query(() => [Invoice])
  @HasRoles(Roles.PARENT)
  async getMyInvoices(
    @Context() context,
    @Args('params', { nullable: true }) params?: PaginationInput,
  ) {
    const result = await this.paymentService.getMyInvoices(
      context.req.user.userId,
      params || {},
    );
    return result.data;
  }

  @Query(() => [StudentPayment])
  @HasRoles(Roles.SUPER_ADMIN, Roles.ADMIN, Roles.PARENT)
  async getAllPayments(
    @Context() context,
    @Args('params', { nullable: true }) params?: PaginationInput,
  ) {
    const isParent = context.req.user.role === Roles.PARENT;
    const result = await this.paymentService.getAllPayments(
      params || {},
      isParent ? context.req.user.userId : undefined,
    );
    return result.data;
  }

  @Query(() => StudentPayment)
  @HasRoles(Roles.SUPER_ADMIN, Roles.ADMIN, Roles.PARENT)
  async getPaymentById(
    @Context() context,
    @Args('paymentId') paymentId: string,
  ) {
    const isParent = context.req.user.role === Roles.PARENT;
    return this.paymentService.getPaymentById(
      paymentId,
      isParent ? context.req.user.userId : undefined,
    );
  }

  @Mutation(() => String)
  @HasRoles(Roles.PARENT)
  async initiatePayment(
    @Context() context,
    @Args('invoiceId') invoiceId: string,
    @Args('amount') amount: number,
  ) {
    return await this.paymentService.initiatePayment(
      context.req.user.userId,
      invoiceId,
      amount,
    );
  }

  @Query(() => BillingReportDashboard)
  @HasRoles(Roles.SUPER_ADMIN, Roles.ADMIN)
  async getBillingReportDashboard() {
    return await this.paymentService.getBillingReportDashboard();
  }

  @Query(() => FinanceOverview)
  @HasRoles(Roles.SUPER_ADMIN, Roles.ADMIN)
  async getFinanceOverview() {
    return await this.paymentService.getFinanceOverview();
  }

  @Query(() => [Invoice])
  @HasRoles(Roles.SUPER_ADMIN, Roles.ADMIN)
  async invoicesDueThisWeek() {
    return await this.paymentService.getInvoicesDueThisWeek();
  }

  @Query(() => [FinanceReconciliationRecord])
  @HasRoles(Roles.SUPER_ADMIN, Roles.ADMIN)
  async getFinanceReconciliation() {
    return await this.paymentService.getFinanceReconciliation();
  }

  @Mutation(() => BulkInvoiceResult)
  @HasRoles(Roles.SUPER_ADMIN, Roles.ADMIN)
  async bulkGenerateClassInvoices(@Args('classId') classId: string) {
    return await this.paymentService.bulkGenerateClassInvoices(classId);
  }
}
