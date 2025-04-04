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

@Resolver()
@UseGuards(JwtAuthGuard, RolesGuard)
export class PaymentResolver {
  constructor(private paymentService: PaymentService) {}

  @Query(() => FeeStructure)
  async getFeeStructure(@Args('id') id: string) {
    return await this.paymentService.getFeeStructure(id);
  }

  @Mutation(() => FeeStructure)
  @HasRoles(Roles.SUPER_ADMIN, Roles.ADMIN)
  async createFeeStructure(@Args('input') input: CreateFeeStructureInput) {
    return await this.paymentService.createFeeStructure(input);
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
}
