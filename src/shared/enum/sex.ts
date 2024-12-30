import { registerEnumType } from '@nestjs/graphql';

export enum Sex {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
}

registerEnumType(Sex, {
  name: 'Sex',
});
