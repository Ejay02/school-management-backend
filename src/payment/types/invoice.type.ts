import {
  ObjectType,
  Field,
  ID,
  Float,
  registerEnumType,
} from '@nestjs/graphql';
import { InvoiceStatus } from '../enum/invoice.status';
import { PaymentType } from './payment.type';

registerEnumType(InvoiceStatus, { name: 'InvoiceStatus' });

@ObjectType()
export class InvoiceType {
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

  @Field(() => [PaymentType])
  payments: PaymentType[];

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
