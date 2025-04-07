import { Field, InputType } from '@nestjs/graphql';
import { IsString, IsNotEmpty } from 'class-validator';
import GraphQLJSON from 'graphql-type-json';

@InputType()
export class CreateLessonInput {
  @Field()
  @IsString()
  @IsNotEmpty()
  name: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  day: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  startTime: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  endTime: string;

  @Field(() => String, { nullable: true })
  description?: string;

  @Field(() => GraphQLJSON, { nullable: true })
  content?: any;
}
