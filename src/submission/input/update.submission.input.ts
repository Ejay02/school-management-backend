import { Field, InputType } from '@nestjs/graphql';
import { IsOptional, IsString } from 'class-validator';

@InputType()
export class UpdateSubmissionInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  content?: string;
}
