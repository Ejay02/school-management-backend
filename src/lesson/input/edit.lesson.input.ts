import { Field, InputType } from '@nestjs/graphql';
import GraphQLJSON from 'graphql-type-json';

@InputType()
export class EditLessonInput {
  @Field(() => String)
  name: string;

  @Field(() => String)
  day: string;

  @Field(() => String)
  startTime: string;

  @Field(() => String)
  endTime: string;

  @Field(() => String, { nullable: true })
  teacherId?: string;

  @Field(() => String, { nullable: true })
  description?: string;

  @Field(() => GraphQLJSON, { nullable: true })
  content?: any;
}
