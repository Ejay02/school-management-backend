import { registerEnumType } from '@nestjs/graphql';

export enum FeeType {
  YEARLY = 'YEARLY',
  TERM = 'TERM',
}

registerEnumType(FeeType, {
  name: 'FeeType',
});
