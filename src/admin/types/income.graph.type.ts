import { ObjectType } from '@nestjs/graphql';
import { IsOptional, IsInt, Min } from 'class-validator';

@ObjectType()
export class IncomeGraph {
  @IsInt()
  @Min(2000)
  year: string | number; // Academic year

  @IsOptional()
  @IsInt()
  classId?: string; // Optional class filter

  @IsOptional()
  term?: string; // Optional term filter (e.g., 'Term 1', 'Term 2', etc.)
}
