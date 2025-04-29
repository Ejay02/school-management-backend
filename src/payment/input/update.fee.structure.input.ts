import { Field, Float, InputType } from '@nestjs/graphql';
import { Term } from '../enum/term';
import { FeeType } from '../enum/fee.type';
import { ValidateIf } from 'class-validator';
import { FeeDescription } from '../enum/fee.description';
import { UpdateFeeComponentInput } from './update.fee.component.input';

@InputType()
export class UpdateFeeStructureInput {
  @Field({ nullable: true })
  academicYear?: string;

  @Field(() => Term, { nullable: true })
  @ValidateIf((o) => o.type !== FeeType.YEARLY)
  term?: Term;

  @Field(() => FeeType, { nullable: true })
  type?: FeeType;

  @Field(() => FeeDescription, { nullable: true })
  description?: FeeDescription;

  @Field(() => Float, { nullable: true })
  totalAmount?: number;

  @Field(() => [UpdateFeeComponentInput], { nullable: true })
  components?: UpdateFeeComponentInput[];

  @Field(() => [String], { nullable: true })
  classIds?: string[];
}
