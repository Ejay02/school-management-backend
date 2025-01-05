import { Field, InputType } from '@nestjs/graphql';

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
}
