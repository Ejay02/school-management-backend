import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class CreateAnnouncementInput {
  @Field()
  title: string;

  @Field()
  content: string;

  @Field({ nullable: true })
  classId?: string;
}
