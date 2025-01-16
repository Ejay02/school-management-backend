import {
  ObjectType,
  Field,
  ID,
  Float,
  registerEnumType,
} from '@nestjs/graphql';
import { PaymentStatus } from '../enum/payment.status';

registerEnumType(PaymentStatus, { name: 'PaymentStatus' });

@ObjectType()
export class Payment {
  @Field(() => ID)
  id: string;

  @Field(() => Float)
  amount: number;

  @Field()
  currency: string;

  @Field(() => PaymentStatus)
  status: PaymentStatus;

  @Field()
  paymentMethod: string;

  @Field()
  stripePaymentId: string;

  @Field({ nullable: true })
  description?: string;

  @Field()
  invoiceId: string;

  @Field()
  parentId: string;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
