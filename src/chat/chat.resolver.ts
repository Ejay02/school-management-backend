import { UseGuards } from '@nestjs/common';
import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import { JwtAuthGuard } from '../shared/auth/guards/jwtAuth.guard';
import { RolesGuard } from '../shared/auth/guards/roles.guard';
import { HasRoles } from '../shared/auth/decorators/roles.decorator';
import { Roles } from '../shared/enum/role';
import { ChatAttachmentInput } from './input/chat.input';
import { ChatService } from './chat.service';
import {
  ChatConversation,
  ChatMessage,
  ChatParticipant,
} from './types/chat.types';

@Resolver()
@UseGuards(JwtAuthGuard, RolesGuard)
export class ChatResolver {
  constructor(private readonly chatService: ChatService) {}

  @Query(() => [ChatParticipant])
  @HasRoles(Roles.ADMIN, Roles.SUPER_ADMIN, Roles.TEACHER, Roles.PARENT)
  async getChatContacts(
    @Context() context: any,
    @Args('search', { nullable: true }) search?: string,
  ) {
    return this.chatService.getChatContacts(
      context.req.user.userId,
      context.req.user.role,
      search,
    );
  }

  @Query(() => [ChatConversation])
  @HasRoles(Roles.ADMIN, Roles.SUPER_ADMIN, Roles.TEACHER, Roles.PARENT)
  async getChatConversations(@Context() context: any) {
    return this.chatService.getChatConversations(
      context.req.user.userId,
      context.req.user.role,
    );
  }

  @Query(() => [ChatMessage])
  @HasRoles(Roles.ADMIN, Roles.SUPER_ADMIN, Roles.TEACHER, Roles.PARENT)
  async getChatMessages(
    @Context() context: any,
    @Args('conversationId') conversationId: string,
  ) {
    return this.chatService.getChatMessages(
      context.req.user.userId,
      context.req.user.role,
      conversationId,
    );
  }

  @Mutation(() => ChatConversation)
  @HasRoles(Roles.ADMIN, Roles.SUPER_ADMIN, Roles.TEACHER, Roles.PARENT)
  async findOrCreateDirectConversation(
    @Context() context: any,
    @Args('participantId') participantId: string,
  ) {
    return this.chatService.findOrCreateDirectConversation(
      context.req.user.userId,
      context.req.user.role,
      participantId,
    );
  }

  @Mutation(() => ChatMessage)
  @HasRoles(Roles.ADMIN, Roles.SUPER_ADMIN, Roles.TEACHER, Roles.PARENT)
  async sendChatMessage(
    @Context() context: any,
    @Args('conversationId') conversationId: string,
    @Args('content', { nullable: true }) content?: string,
    @Args('attachments', {
      nullable: true,
      type: () => [ChatAttachmentInput],
    })
    attachments?: ChatAttachmentInput[],
  ) {
    return this.chatService.sendChatMessage(
      context.req.user.userId,
      context.req.user.role,
      conversationId,
      content,
      attachments,
    );
  }

  @Mutation(() => Boolean)
  @HasRoles(Roles.ADMIN, Roles.SUPER_ADMIN, Roles.TEACHER, Roles.PARENT)
  async deleteChatMessage(
    @Context() context: any,
    @Args('messageId') messageId: string,
  ) {
    return this.chatService.deleteChatMessage(
      context.req.user.userId,
      context.req.user.role,
      messageId,
    );
  }

  @Mutation(() => Boolean)
  @HasRoles(Roles.ADMIN, Roles.SUPER_ADMIN, Roles.TEACHER, Roles.PARENT)
  async markChatConversationAsRead(
    @Context() context: any,
    @Args('conversationId') conversationId: string,
  ) {
    return this.chatService.markConversationAsRead(
      context.req.user.userId,
      context.req.user.role,
      conversationId,
    );
  }
}
