import { Field, InputType } from '@nestjs/graphql';
import { IsOptional, IsString } from 'class-validator';

@InputType()
export class CreateSubmissionInput {
  @Field()
  @IsString()
  assignmentId: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  content?: string;
}
