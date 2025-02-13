import {
  ObjectType,
  Field,
  ID,
  Float,
  registerEnumType,
} from '@nestjs/graphql';
import { InvoiceStatus } from '../enum/invoice.status';
import { Payment } from './payment.type';

registerEnumType(InvoiceStatus, { name: 'InvoiceStatus' });

@ObjectType()
export class Invoice {
  @Field(() => ID)
  id: string;

  @Field()
  invoiceNumber: string;

  @Field()
  parentId: string;

  @Field()
  feeStructureId: string;

  @Field(() => Float)
  totalAmount: number;

  @Field(() => Float)
  paidAmount: number;

  @Field(() => InvoiceStatus)
  status: InvoiceStatus;

  @Field()
  dueDate: Date;

  @Field(() => [Payment])
  payments: Payment[];

  @Field({ nullable: true })
  paymentIntentId?: string;

  @Field({ nullable: true })
  checkoutSessionId?: string;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
