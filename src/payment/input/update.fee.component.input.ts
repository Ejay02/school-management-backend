import { Field, Float, InputType } from '@nestjs/graphql';

@InputType()
export class UpdateFeeComponentInput {
  @Field({ nullable: true })
  id?: string;

  @Field()
  name: string;

  @Field({ nullable: true })
  description?: string;

  @Field(() => Float)
  amount: number;
}
