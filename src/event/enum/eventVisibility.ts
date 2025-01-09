import { registerEnumType } from '@nestjs/graphql';

export enum EventVisibility {
  PUBLIC = 'PUBLIC',
  PRIVATE = 'PRIVATE',
}

registerEnumType(EventVisibility, {
  name: 'EventVisibility',
});
