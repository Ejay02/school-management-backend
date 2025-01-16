import { Field, Float, InputType } from '@nestjs/graphql';
import { CreateFeeComponentInput } from './fee.structure.input';
import { Term } from '../enum/term';
import { FeeType } from '../enum/fee.type';

@InputType()
export class CreateFeeStructureInput {
  @Field()
  academicYear: string;

  @Field(() => Term)
  term: Term;

  @Field(() => FeeType)
  type: FeeType;

  @Field(() => Float)
  totalAmount: number;

  @Field(() => [CreateFeeComponentInput])
  components: CreateFeeComponentInput[];
}
