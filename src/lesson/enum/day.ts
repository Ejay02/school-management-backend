import { registerEnumType } from '@nestjs/graphql';

export enum Day {
  MONDAY = 'Monday',
  TUESDAY = 'Tuesday',
  WEDNESDAY = 'Wednesday',
  THURSDAY = 'Thursday',
  FRIDAY = 'Friday',
}

registerEnumType(Day, {
  name: 'Day',
});
