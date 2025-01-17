import { registerEnumType } from '@nestjs/graphql';

export enum EventStatus {
  SCHEDULED = 'SCHEDULED',
  CANCELLED = 'CANCELLED',
  COMPLETED = 'COMPLETED',
}

registerEnumType(EventStatus, {
  name: 'EventStatus',
});
