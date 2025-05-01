import { Field, Float, InputType } from '@nestjs/graphql';
import { CreateFeeComponentInput } from './fee.structure.input';
import { Term } from '../enum/term';
import { FeeType } from '../enum/fee.type';
import { ValidateIf } from 'class-validator';
import { FeeDescription } from '../enum/fee.description';

@InputType()
export class CreateFeeStructureInput {
  @Field()
  academicYear: string;

  @Field(() => Term, { nullable: true })
  @ValidateIf((o) => o.type !== FeeType.YEARLY)
  term?: Term;

  @Field(() => FeeType)
  type: FeeType;

  @Field(() => FeeDescription, { nullable: true })
  description?: FeeDescription;

  @Field(() => Float)
  totalAmount: number;

  @Field(() => [CreateFeeComponentInput])
  components: CreateFeeComponentInput[];

  @Field(() => [String], { nullable: 'itemsAndList' })
  classIds?: string[];

  @Field(() => String, { nullable: true })
  classId?: string;
}
