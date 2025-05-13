import { registerEnumType } from '@nestjs/graphql';

export enum ResultType {
  EXAM = 'EXAM',
  ASSIGNMENT = 'ASSIGNMENT',
  OVERALL = 'OVERALL',
}

registerEnumType(ResultType, {
  name: 'ResultType',
});
