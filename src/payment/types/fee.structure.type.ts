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
import { FeeDescription } from '../enum/fee.description';
import { Class } from 'src/class/types/class.types';

registerEnumType(Term, { name: 'Term' });
registerEnumType(FeeType, { name: 'FeeType' });

@ObjectType()
export class FeeStructure {
  @Field(() => ID)
  id: string;

  @Field()
  academicYear: string;

  @Field(() => Term, { nullable: true })
  term?: Term;

  @Field(() => FeeDescription, { nullable: true })
  description?: FeeDescription;

  @Field(() => FeeType)
  type: FeeType;

  @Field(() => Float)
  totalAmount: number;

  @Field(() => [FeeComponent])
  components: FeeComponent[];

  @Field(() => [Class], { nullable: true })
  classes?: Class[];

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
