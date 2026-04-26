import { registerEnumType } from '@nestjs/graphql';

export enum InviteStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REVOKED = 'REVOKED',
  EXPIRED = 'EXPIRED',
}

registerEnumType(InviteStatus, {
  name: 'InviteStatus',
});
