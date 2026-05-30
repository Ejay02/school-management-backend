import { Field, InputType } from '@nestjs/graphql';
import { PaginationInput } from '../../shared/pagination/input/pagination.input';
import { IsBoolean, IsOptional } from 'class-validator';

@InputType()
export class AnnouncementQueryInput extends PaginationInput {
  @Field(() => Boolean, { nullable: true, defaultValue: false })
  @IsOptional()
  @IsBoolean()
  isArchived?: boolean;
}
