import { Field, InputType } from '@nestjs/graphql';
import { IsOptional } from 'class-validator';

@InputType()
export class EditAssignmentInput {
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
