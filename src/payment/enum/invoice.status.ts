import { registerEnumType } from '@nestjs/graphql';

export enum InvoiceStatus {
  PENDING = 'PENDING',
  PARTIAL = 'PARTIAL',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  CANCELLED = 'CANCELLED',
}

registerEnumType(InvoiceStatus, {
  name: 'InvoiceStatus',
});
