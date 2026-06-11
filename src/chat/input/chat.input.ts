import { Field, InputType, Int } from '@nestjs/graphql';

@InputType()
export class ChatAttachmentInput {
  @Field(() => String)
  name: string;

  @Field(() => String)
  mimeType: string;

  @Field(() => Int)
  size: number;

  @Field(() => String)
  dataUrl: string;
}
