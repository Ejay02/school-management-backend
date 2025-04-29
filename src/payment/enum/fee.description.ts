import { registerEnumType } from '@nestjs/graphql';

export enum FeeDescription {
  TUITION = 'TUITION',
  DEVELOPMENT_LEVY = 'DEVELOPMENT_LEVY',
  UNIFORM = 'UNIFORM',
  BOOKS = 'BOOKS',
  OTHER = 'OTHER',
}

registerEnumType(FeeDescription, {
  name: 'FeeDescription',
});
