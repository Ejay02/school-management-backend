import { ObjectType, Field, ID, Float } from '@nestjs/graphql';
import { PaymentStatus } from '../enum/payment.status';
import { FeeType } from '../enum/fee.type';

@ObjectType()
export class StudentPayment {
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
  studentName: string;

  @Field()
  studentSurname: string;

  @Field()
  studentId: string;

  @Field({ nullable: true })
  studentImage?: string;

  @Field()
  classId: string;

  @Field()
  className: string;

  @Field(() => FeeType, { nullable: true })
  feeType?: FeeType;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
