import { registerEnumType } from '@nestjs/graphql';

export enum DefaultClass {
  PRIMARY_1 = 'Primary 1',
  PRIMARY_2 = 'Primary 2',
  PRIMARY_3 = 'Primary 3',
  PRIMARY_4 = 'Primary 4',
  PRIMARY_5 = 'Primary 5',
  PRIMARY_6 = 'Primary 6',
  JSS_1 = 'JSS 1',
  JSS_2 = 'JSS 2',
  JSS_3 = 'JSS 3',
  SS_1 = 'SS 1',
  SS_2 = 'SS 2',
  SS_3 = 'SS 3',
}

registerEnumType(DefaultClass, {
  name: 'DefaultClass',
});
