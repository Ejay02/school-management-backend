import { Field, Float, ID, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class FeeComponent {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field({ nullable: true })
  description?: string;

  @Field(() => Float)
  amount: number;

  @Field()
  feeStructureId: string;
}
