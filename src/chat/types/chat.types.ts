import { Field, Int, ObjectType } from '@nestjs/graphql';
import { Roles } from '../../shared/enum/role';

@ObjectType()
export class ChatParticipant {
  @Field(() => String)
  id: string;

  @Field(() => Roles)
  role: Roles;

  @Field(() => String)
  displayName: string;

  @Field(() => String, { nullable: true })
  name?: string | null;

  @Field(() => String, { nullable: true })
  surname?: string | null;

  @Field(() => String, { nullable: true })
  image?: string | null;

  @Field(() => String, { nullable: true })
  email?: string | null;

  @Field(() => String, { nullable: true })
  subtitle?: string | null;
}

@ObjectType()
export class ChatAttachment {
  @Field(() => String)
  name: string;

  @Field(() => String)
  mimeType: string;

  @Field(() => Int)
  size: number;

  @Field(() => String)
  url: string;

  @Field(() => String)
  kind: string;
}

@ObjectType()
export class ChatMessage {
  @Field(() => String)
  id: string;

  @Field(() => String)
  conversationId: string;

  @Field(() => String)
  content: string;

  @Field(() => [ChatAttachment], { nullable: true })
  attachments?: ChatAttachment[] | null;

  @Field(() => ChatParticipant)
  sender: ChatParticipant;

  @Field(() => Date)
  createdAt: Date;

  @Field(() => Date)
  updatedAt: Date;
}

@ObjectType()
export class ChatConversation {
  @Field(() => String)
  id: string;

  @Field(() => String)
  type: string;

  @Field(() => [ChatParticipant])
  participants: ChatParticipant[];

  @Field(() => ChatMessage, { nullable: true })
  lastMessage?: ChatMessage | null;

  @Field(() => Int)
  unreadCount: number;

  @Field(() => Date)
  createdAt: Date;

  @Field(() => Date)
  updatedAt: Date;
}
