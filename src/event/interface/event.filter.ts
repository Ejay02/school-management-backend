import { Field, InputType } from '@nestjs/graphql';
import { IsOptional, IsString, IsDate, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

@InputType()
export class EventFilter {
  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  type?: string; // Filter by event type, e.g., "Meeting", "Workshop"

  @Field(() => Date, { nullable: true })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startDate?: Date; // Fetch events starting after this date

  @Field(() => Date, { nullable: true })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  endDate?: Date; // Fetch events ending before this date

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsUUID()
  classId?: string; // Filter events for a specific class by class ID
}
