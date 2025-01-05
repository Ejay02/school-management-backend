import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class AssignSubjectsInput {
  @Field(() => String)
  classId: string;

  @Field(() => [String])
  subjectIds: string[];
}
