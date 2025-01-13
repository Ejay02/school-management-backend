import { Field, InputType } from '@nestjs/graphql';
import { IsDate, IsString } from 'class-validator';

@InputType()
export class CreateExamInput {
  @Field()
  @IsString()
  title: string;

  @Field()
  @IsDate()
  startTime: Date;

  @Field()
  @IsDate()
  endTime: Date;

  @Field()
  @IsString()
  lessonId: string;

  @Field()
  @IsString()
  classId: string;

  @Field()
  @IsString()
  subjectId: string;
}
