import { InputType, Field } from '@nestjs/graphql';
import { IsOptional } from 'class-validator';

@InputType()
export class CreateClassInput {
  @Field()
  name: string;

  @Field()
  capacity: number;

  @IsOptional()
  teacherId?: string;

  @IsOptional()
  subjectId?: string;

  @IsOptional()
  supervisorId?: string;
}
