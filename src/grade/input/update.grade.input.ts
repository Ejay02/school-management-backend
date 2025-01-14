import { Field, InputType } from '@nestjs/graphql';
import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

@InputType()
export class UpdateGradeInput {
  @Field()
  @IsString()
  id: string;

  @Field({ nullable: true })
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  score?: number;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  comments?: string;
}
