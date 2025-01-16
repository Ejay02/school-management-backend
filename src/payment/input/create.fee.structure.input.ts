import { Field, Float, InputType } from '@nestjs/graphql';
import { CreateFeeComponentInput } from './fee.structure.input';
import { Term } from '../enum/term';
import { FeeType } from '../enum/fee.type';
import { ValidateIf } from 'class-validator';

@InputType()
export class CreateFeeStructureInput {
  @Field()
  academicYear: string;

  @Field(() => Term, { nullable: true })
  @ValidateIf((o) => o.type !== FeeType.YEARLY)
  term?: Term;

  @Field(() => FeeType)
  type: FeeType;

  @Field(() => Float)
  totalAmount: number;

  @Field(() => [CreateFeeComponentInput])
  components: CreateFeeComponentInput[];

  @Field(() => [String], { nullable: true })
  classIds?: string[];
}
