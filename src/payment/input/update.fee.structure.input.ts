import { Field, Float, InputType } from '@nestjs/graphql';
import { Term } from '../enum/term';
import { FeeType } from '../enum/fee.type';
import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { FeeDescription } from '../enum/fee.description';
import { UpdateFeeComponentInput } from './update.fee.component.input';
import { Type } from 'class-transformer';

@InputType()
export class UpdateFeeStructureInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  academicYear?: string;

  @Field(() => Term, { nullable: true })
  @ValidateIf((o) => o.type !== FeeType.YEARLY)
  @IsOptional()
  @IsEnum(Term)
  term?: Term;

  @Field(() => FeeType, { nullable: true })
  @IsOptional()
  @IsEnum(FeeType)
  type?: FeeType;

  @Field(() => FeeDescription, { nullable: true })
  @IsOptional()
  @IsEnum(FeeDescription)
  description?: FeeDescription;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  totalAmount?: number;

  @Field(() => [UpdateFeeComponentInput], { nullable: true })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateFeeComponentInput)
  components?: UpdateFeeComponentInput[];

  @Field(() => [String], { nullable: 'itemsAndList' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  classIds?: string[];

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  classId?: string;
}
