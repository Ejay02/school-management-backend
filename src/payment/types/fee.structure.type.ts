import {
  ObjectType,
  Field,
  ID,
  Float,
  registerEnumType,
} from '@nestjs/graphql';
import { Term } from '../enum/term';
import { FeeType } from '../enum/fee.type';
import { FeeComponent } from './fee.component.type';

registerEnumType(Term, { name: 'Term' });
registerEnumType(FeeType, { name: 'FeeType' });

@ObjectType()
export class FeeStructure {
  @Field(() => ID)
  id: string;

  @Field()
  academicYear: string;

  @Field(() => Term)
  term?: Term;

  @Field(() => FeeType)
  type: FeeType;

  @Field(() => Float)
  totalAmount: number;

  @Field(() => [FeeComponent])
  components: FeeComponent[];

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
