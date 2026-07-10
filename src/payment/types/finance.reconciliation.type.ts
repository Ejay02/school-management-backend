import { ObjectType, Field, Float, ID } from '@nestjs/graphql';

@ObjectType()
export class FinanceReconciliationRecord {
  @Field(() => ID)
  invoiceId: string;

  @Field()
  invoiceNumber: string;

  @Field({ nullable: true })
  studentId?: string;

  @Field({ nullable: true })
  studentName?: string;

  @Field({ nullable: true })
  studentSurname?: string;

  @Field({ nullable: true })
  classId?: string;

  @Field({ nullable: true })
  className?: string;

  @Field()
  feeType: string; // e.g. "YEARLY" or "TERM"

  @Field({ nullable: true })
  term?: string; // e.g. "FIRST", "SECOND", "THIRD"

  @Field(() => Float)
  amount: number; // total expected

  @Field(() => Float)
  paid: number; // total collected

  @Field(() => Float)
  balance: number; // total outstanding

  @Field()
  status: string; // PAID, PARTIAL, PENDING, OVERDUE, CANCELLED

  @Field()
  dueDate: Date;

  @Field()
  createdAt: Date;
}

@ObjectType()
export class BulkInvoiceResult {
  @Field(() => Float)
  count: number;

  @Field()
  message: string;
}
