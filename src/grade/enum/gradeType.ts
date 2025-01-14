import { registerEnumType } from '@nestjs/graphql';

export enum GradeType {
  EXAM = 'EXAM',
  ASSIGNMENT = 'ASSIGNMENT',
  OVERALL = 'OVERALL',
}

registerEnumType(GradeType, {
  name: 'GradeType',
});
