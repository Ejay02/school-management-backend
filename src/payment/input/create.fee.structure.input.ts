import { Field, Float, InputType } from '@nestjs/graphql';
import { CreateFeeComponentInput } from './fee.structure.input';
import { Term } from '../enum/term';
import { FeeType } from '../enum/fee.type';
import {
  ArrayMinSize,
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
import { Type } from 'class-transformer';

@InputType()
export class CreateFeeStructureInput {
  @Field()
  @IsString()
  @MaxLength(50)
  academicYear: string;

  @Field(() => Term, { nullable: true })
  @ValidateIf((o) => o.type !== FeeType.YEARLY)
  @IsEnum(Term)
  term?: Term;

  @Field(() => FeeType)
  @IsEnum(FeeType)
  type: FeeType;

  @Field(() => FeeDescription, { nullable: true })
  @IsOptional()
  @IsEnum(FeeDescription)
  description?: FeeDescription;

  @Field(() => Float)
  @IsNumber()
  totalAmount: number;

  @Field(() => [CreateFeeComponentInput])
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateFeeComponentInput)
  components: CreateFeeComponentInput[];

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
