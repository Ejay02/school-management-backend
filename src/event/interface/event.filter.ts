import { IsOptional, IsString, IsDate, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

export class EventFilter {
  @IsOptional()
  @IsString()
  type?: string; // Filter by event type, e.g., "Meeting", "Workshop".

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startDate?: Date; // Fetch events starting after this date.

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  endDate?: Date; // Fetch events ending before this date.

  @IsOptional()
  @IsUUID()
  classId?: string; // Filter events for a specific class by class ID.
}
