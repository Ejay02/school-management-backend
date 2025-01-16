import { registerEnumType } from '@nestjs/graphql';

export enum Term {
  FIRST = 'FIRST',
  SECOND = 'SECOND',
  THIRD = 'THIRD',
}

registerEnumType(Term, {
  name: 'Term',
});
