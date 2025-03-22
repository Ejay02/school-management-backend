import { Field, InputType } from '@nestjs/graphql';
import { PaginationInput } from 'src/shared/pagination/input/pagination.input';

@InputType()
export class AnnouncementQueryInput extends PaginationInput {
  @Field(() => Boolean, { nullable: true, defaultValue: false })
  isArchived?: boolean;
}
