import { InputType, Field } from '@nestjs/graphql';
import { IsOptional } from 'class-validator';

@InputType()
export class CreateAssignmentInput {
  @Field()
  title: string;

  @Field()
  startDate: Date;

  @Field()
  dueDate: Date;

  @IsOptional()
  lessonId?: string;

  @IsOptional()
  subjectId?: string;

  @IsOptional()
  classId?: string;
}
