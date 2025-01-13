import { Field, InputType } from '@nestjs/graphql';
import { IsDate, IsString } from 'class-validator';

@InputType()
export class UpdateExamInput {
  @Field({ nullable: true })
  @IsString()
  title?: string;

  @Field({ nullable: true })
  @IsDate()
  startTime?: Date;

  @Field({ nullable: true })
  @IsDate()
  endTime?: Date;
}
