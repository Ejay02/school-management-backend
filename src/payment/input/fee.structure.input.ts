import { InputType, Field, Float } from '@nestjs/graphql';

@InputType()
export class CreateFeeComponentInput {
  @Field()
  name: string;

  @Field({ nullable: true })
  description?: string;

  @Field(() => Float)
  amount: number;
}
