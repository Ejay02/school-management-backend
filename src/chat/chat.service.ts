import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role as PrismaRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../shared/cloudinary/services/cloudinary.service';
import { Roles } from '../shared/enum/role';
import { ChatAttachmentInput } from './input/chat.input';
import { ChatGateway } from './gateway/chat.gateway';
import {
  ChatAttachment,
  ChatConversation,
  ChatMessage,
  ChatParticipant,
} from './types/chat.types';

type SupportedChatRole =
  | Roles.ADMIN
  | Roles.SUPER_ADMIN
  | Roles.TEACHER
  | Roles.PARENT;

type DirectoryUser = {
  id: string;
  role: PrismaRole;
  name?: string | null;
  surname?: string | null;
  username?: string | null;
  email?: string | null;
  image?: string | null;
  isActive?: boolean | null;
};

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinaryService: CloudinaryService,
    private readonly chatGateway: ChatGateway,
  ) {}

  async getChatContacts(
    userId: string,
    role: Roles,
    search?: string,
  ): Promise<ChatParticipant[]> {
    this.assertSupportedRole(role);

    const normalizedSearch = search?.trim().toLowerCase() || null;
    let contacts: DirectoryUser[] = [];

    if (this.isAdminRole(role)) {
      const [admins, teachers, parents] = await Promise.all([
        this.prisma.admin.findMany({
          where: {
            id: { not: userId },
            isActive: true,
          },
          select: this.userSelect,
        }),
        this.prisma.teacher.findMany({
          where: { isActive: true },
          select: this.userSelect,
        }),
        this.prisma.parent.findMany({
          where: { isActive: true },
          select: this.userSelect,
        }),
      ]);

      contacts = [...admins, ...teachers, ...parents];
    } else if (role === Roles.TEACHER) {
      const [admins, parents] = await Promise.all([
        this.prisma.admin.findMany({
          where: { isActive: true },
          select: this.userSelect,
        }),
        this.prisma.parent.findMany({
          where: {
            id: { in: await this.getTeacherRelatedParentIds(userId) },
            isActive: true,
          },
          select: this.userSelect,
        }),
      ]);

      contacts = [...admins, ...parents];
    } else if (role === Roles.PARENT) {
      const [admins, teachers] = await Promise.all([
        this.prisma.admin.findMany({
          where: { isActive: true },
          select: this.userSelect,
        }),
        this.prisma.teacher.findMany({
          where: {
            id: { in: await this.getParentRelatedTeacherIds(userId) },
            isActive: true,
          },
          select: this.userSelect,
        }),
      ]);

      contacts = [...admins, ...teachers];
    }

    const uniqueContacts = Array.from(
      new Map(contacts.map((contact) => [contact.id, contact])).values(),
    );

    return uniqueContacts
      .filter((contact) => this.matchesSearch(contact, normalizedSearch))
      .map((contact) => this.toParticipant(contact))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }

  async getChatConversations(
    userId: string,
    role: Roles,
  ): Promise<ChatConversation[]> {
    this.assertSupportedRole(role);

    const memberships = await this.prisma.chatConversationMember.findMany({
      where: { userId },
      include: {
        conversation: {
          include: {
            members: true,
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
      orderBy: {
        conversation: {
          updatedAt: 'desc',
        },
      },
    });

    return Promise.all(
      memberships.map((membership) =>
        this.mapConversationForMember(membership.userId, membership),
      ),
    );
  }

  async getChatMessages(
    userId: string,
    role: Roles,
    conversationId: string,
  ): Promise<ChatMessage[]> {
    this.assertSupportedRole(role);

    await this.getMembershipOrThrow(userId, conversationId);

    const messages = await this.prisma.chatMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });

    const participants = await this.getUsersByIds(
      messages.map((m) => m.senderId),
    );

    return messages.map((message) =>
      this.mapMessage(message, participants.get(message.senderId)),
    );
  }

  async findOrCreateDirectConversation(
    userId: string,
    role: Roles,
    participantId: string,
  ): Promise<ChatConversation> {
    this.assertSupportedRole(role);

    if (!participantId?.trim()) {
      throw new BadRequestException('Participant is required');
    }

    if (participantId === userId) {
      throw new BadRequestException(
        'You cannot start a conversation with yourself',
      );
    }

    const target = await this.getUserById(participantId);
    if (!target || !target.isActive) {
      throw new NotFoundException('Chat participant not found');
    }

    const canChat = await this.canUsersChat(
      userId,
      role,
      target.id,
      this.asRoles(target.role),
    );
    if (!canChat) {
      throw new ForbiddenException(
        'You are not allowed to chat with this user',
      );
    }

    const directKey = this.buildDirectKey(userId, target.id);
    const now = new Date();

    await this.prisma.chatConversation.upsert({
      where: { directKey },
      update: { updatedAt: now },
      create: {
        type: 'DIRECT',
        directKey,
        createdById: userId,
        createdByRole: this.asPrismaRole(role),
        members: {
          create: [
            {
              userId,
              userRole: this.asPrismaRole(role),
              lastReadAt: now,
            },
            {
              userId: target.id,
              userRole: target.role,
            },
          ],
        },
      },
    });

    return this.getConversationForUserOrThrow(userId, directKey);
  }

  async sendChatMessage(
    userId: string,
    role: Roles,
    conversationId: string,
    content?: string,
    attachments?: ChatAttachmentInput[],
  ): Promise<ChatMessage> {
    this.assertSupportedRole(role);

    const trimmedContent = String(content || '').trim();
    const normalizedAttachments = await this.prepareAttachments(attachments);

    if (!trimmedContent && !normalizedAttachments.length) {
      throw new BadRequestException(
        'Message content or at least one attachment is required',
      );
    }

    if (trimmedContent.length > 2000) {
      throw new BadRequestException('Message content is too long');
    }

    const membership = await this.getMembershipOrThrow(userId, conversationId);
    const conversation = await this.prisma.chatConversation.findUnique({
      where: { id: conversationId },
      include: { members: true },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    const otherMembers = conversation.members.filter(
      (member) => member.userId !== userId,
    );

    for (const otherMember of otherMembers) {
      const canChat = await this.canUsersChat(
        userId,
        role,
        otherMember.userId,
        this.asRoles(otherMember.userRole),
      );

      if (!canChat) {
        throw new ForbiddenException(
          'This conversation is no longer available',
        );
      }
    }

    const now = new Date();

    const message = await this.prisma.$transaction(async (tx) => {
      const createdMessage = await tx.chatMessage.create({
        data: {
          conversationId,
          senderId: userId,
          senderRole: this.asPrismaRole(role),
          content: trimmedContent,
          attachments: normalizedAttachments.length
            ? (normalizedAttachments as unknown as Prisma.InputJsonValue)
            : null,
        },
      });

      await tx.chatConversation.update({
        where: { id: conversationId },
        data: { updatedAt: now },
      });

      await tx.chatConversationMember.update({
        where: {
          conversationId_userId: {
            conversationId,
            userId,
          },
        },
        data: { lastReadAt: now },
      });

      return createdMessage;
    });

    const sender = await this.getUserById(userId);
    const mappedMessage = this.mapMessage(message, sender);

    const participantIds = conversation.members.map((member) => member.userId);
    await Promise.all(
      participantIds.map(async (participantId) => {
        const updatedConversation = await this.getConversationByIdForUser(
          participantId,
          conversationId,
        );

        if (updatedConversation) {
          this.chatGateway.emitConversationUpdated(
            participantId,
            updatedConversation,
          );
        }

        this.chatGateway.emitMessageCreated(participantId, mappedMessage);
      }),
    );

    return mappedMessage;
  }

  async deleteChatMessage(
    userId: string,
    role: Roles,
    messageId: string,
  ): Promise<boolean> {
    this.assertSupportedRole(role);

    const normalizedMessageId = String(messageId || '').trim();
    if (!normalizedMessageId) {
      throw new BadRequestException('Message is required');
    }

    const message = await this.prisma.chatMessage.findUnique({
      where: { id: normalizedMessageId },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    await this.getMembershipOrThrow(userId, message.conversationId);

    const canDelete =
      this.isAdminRole(role) || String(message.senderId) === String(userId);
    if (!canDelete) {
      throw new ForbiddenException('You cannot delete this message');
    }

    const attachmentUrls = this.mapAttachments(message.attachments).map(
      (attachment) => attachment.url,
    );

    const now = new Date();
    const conversation = await this.prisma.$transaction(async (tx) => {
      await tx.chatMessage.delete({
        where: { id: normalizedMessageId },
      });

      await tx.chatConversation.update({
        where: { id: message.conversationId },
        data: { updatedAt: now },
      });

      return tx.chatConversation.findUnique({
        where: { id: message.conversationId },
        include: { members: true },
      });
    });

    await Promise.all(
      attachmentUrls.map(async (url) => {
        try {
          const publicId = this.cloudinaryService.getPublicIdFromUrl(url);
          await this.cloudinaryService.deleteImage(publicId);
        } catch {
          return;
        }
      }),
    );

    const memberIds = conversation?.members?.map((member) => member.userId) || [];
    await Promise.all(
      memberIds.map(async (memberId) => {
        const updatedConversation = await this.getConversationByIdForUser(
          memberId,
          message.conversationId,
        );

        if (updatedConversation) {
          this.chatGateway.emitConversationUpdated(memberId, updatedConversation);
        }

        this.chatGateway.emitMessageDeleted(memberId, {
          conversationId: message.conversationId,
          messageId: normalizedMessageId,
        });
      }),
    );

    return true;
  }

  async markConversationAsRead(
    userId: string,
    role: Roles,
    conversationId: string,
  ): Promise<boolean> {
    this.assertSupportedRole(role);

    const membership = await this.getMembershipOrThrow(userId, conversationId);
    const readAt = new Date();

    await this.prisma.chatConversationMember.update({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
      data: { lastReadAt: readAt },
    });

    const conversation = await this.prisma.chatConversation.findUnique({
      where: { id: conversationId },
      include: { members: true },
    });

    if (!conversation) {
      return true;
    }

    await Promise.all(
      conversation.members.map(async (member) => {
        const updatedConversation = await this.getConversationByIdForUser(
          member.userId,
          conversationId,
        );

        if (updatedConversation) {
          this.chatGateway.emitConversationUpdated(
            member.userId,
            updatedConversation,
          );
        }

        if (member.userId !== membership.userId) {
          this.chatGateway.emitConversationRead(member.userId, {
            conversationId,
            readerId: membership.userId,
            readAt: readAt.toISOString(),
          });
        }
      }),
    );

    return true;
  }

  private readonly userSelect = {
    id: true,
    role: true,
    name: true,
    surname: true,
    username: true,
    email: true,
    image: true,
    isActive: true,
  } as const;

  private isAdminRole(role: Roles) {
    return role === Roles.ADMIN || role === Roles.SUPER_ADMIN;
  }

  private assertSupportedRole(role: Roles): asserts role is SupportedChatRole {
    if (
      ![Roles.ADMIN, Roles.SUPER_ADMIN, Roles.TEACHER, Roles.PARENT].includes(
        role,
      )
    ) {
      throw new ForbiddenException('Chat is not available for this account');
    }
  }

  private buildDirectKey(firstUserId: string, secondUserId: string) {
    return [firstUserId, secondUserId].sort().join(':');
  }

  private matchesSearch(user: DirectoryUser, search: string | null) {
    if (!search) return true;

    return [user.name, user.surname, user.username, user.email]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(search));
  }

  private getRoleLabel(role: Roles) {
    switch (role) {
      case Roles.SUPER_ADMIN:
        return 'School Admin';
      case Roles.ADMIN:
        return 'Admin';
      case Roles.TEACHER:
        return 'Teacher';
      case Roles.PARENT:
        return 'Parent';
      default:
        return role;
    }
  }

  private toParticipant(user: DirectoryUser): ChatParticipant {
    const displayName =
      [user.name, user.surname].filter(Boolean).join(' ').trim() ||
      user.username ||
      user.email ||
      'Unknown user';

    return {
      id: user.id,
      role: this.asRoles(user.role),
      name: user.name ?? null,
      surname: user.surname ?? null,
      displayName,
      image: user.image ?? null,
      email: user.email ?? null,
      subtitle: this.getRoleLabel(this.asRoles(user.role)),
    };
  }

  private mapMessage(message: any, sender?: DirectoryUser | null): ChatMessage {
    return {
      id: message.id,
      conversationId: message.conversationId,
      content: message.content,
      attachments: this.mapAttachments(message.attachments),
      sender: this.toParticipant(
        sender || {
          id: message.senderId,
          role: message.senderRole,
          username: 'Unknown user',
        },
      ),
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
    };
  }

  private mapAttachments(value: unknown): ChatAttachment[] {
    if (!Array.isArray(value)) return [];

    return value
      .filter((item) => item && typeof item === 'object')
      .map((item: any) => ({
        name: String(item.name || 'Attachment'),
        mimeType: String(item.mimeType || 'application/octet-stream'),
        size: Number(item.size || 0),
        url: String(item.url || ''),
        kind: String(item.kind || 'file'),
      }))
      .filter((item) => item.url);
  }

  private async prepareAttachments(
    attachments?: ChatAttachmentInput[],
  ): Promise<ChatAttachment[]> {
    const items = Array.isArray(attachments) ? attachments.filter(Boolean) : [];

    if (!items.length) return [];

    if (items.length > 5) {
      throw new BadRequestException('You can attach up to 5 files per message');
    }

    return Promise.all(
      items.map(async (attachment, index) => {
        const name = String(attachment?.name || '').trim();
        const mimeType = String(attachment?.mimeType || '').trim();
        const dataUrl = String(attachment?.dataUrl || '').trim();
        const size = Number(attachment?.size || 0);

        if (
          !name ||
          !mimeType ||
          !dataUrl ||
          !Number.isFinite(size) ||
          size <= 0
        ) {
          throw new BadRequestException('Invalid attachment payload');
        }

        if (size > 5 * 1024 * 1024) {
          throw new BadRequestException(
            'Each attachment must be 5MB or smaller',
          );
        }

        if (!dataUrl.startsWith('data:')) {
          throw new BadRequestException(
            'Attachment must be sent as a data URL',
          );
        }

        const url = await this.cloudinaryService.uploadDataUri(
          dataUrl,
          'chat-attachments',
        );

        return {
          name,
          mimeType,
          size,
          url,
          kind: mimeType.startsWith('image/') ? 'image' : 'file',
        };
      }),
    );
  }

  private async mapConversationForMember(
    userId: string,
    membership: any,
  ): Promise<ChatConversation> {
    const participantIds = membership.conversation.members.map(
      (member: any) => member.userId,
    );
    const participants = await this.getUsersByIds(participantIds);
    const lastMessageRecord = membership.conversation.messages[0] || null;

    const unreadCount = await this.prisma.chatMessage.count({
      where: {
        conversationId: membership.conversation.id,
        senderId: { not: userId },
        ...(membership.lastReadAt
          ? { createdAt: { gt: membership.lastReadAt } }
          : {}),
      },
    });

    return {
      id: membership.conversation.id,
      type: membership.conversation.type,
      participants: membership.conversation.members
        .map((member: any) => participants.get(member.userId))
        .filter(Boolean)
        .map((participant) => this.toParticipant(participant as DirectoryUser)),
      lastMessage: lastMessageRecord
        ? this.mapMessage(
            lastMessageRecord,
            participants.get(lastMessageRecord.senderId),
          )
        : null,
      unreadCount,
      createdAt: membership.conversation.createdAt,
      updatedAt: membership.conversation.updatedAt,
    };
  }

  private async getConversationByIdForUser(
    userId: string,
    conversationId: string,
  ): Promise<ChatConversation | null> {
    const membership = await this.prisma.chatConversationMember.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
      include: {
        conversation: {
          include: {
            members: true,
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    });

    if (!membership) {
      return null;
    }

    return this.mapConversationForMember(userId, membership);
  }

  private async getConversationForUserOrThrow(
    userId: string,
    directKey: string,
  ): Promise<ChatConversation> {
    const conversation = await this.prisma.chatConversation.findUnique({
      where: { directKey },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    const mapped = await this.getConversationByIdForUser(
      userId,
      conversation.id,
    );

    if (!mapped) {
      throw new NotFoundException('Conversation not found');
    }

    return mapped;
  }

  private async getMembershipOrThrow(userId: string, conversationId: string) {
    const membership = await this.prisma.chatConversationMember.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException(
        'You do not have access to this conversation',
      );
    }

    return membership;
  }

  private async getTeacherClassIds(teacherId: string): Promise<string[]> {
    const classes = await this.prisma.class.findMany({
      where: {
        OR: [
          { supervisorId: teacherId },
          { lessons: { some: { teacherId } } },
          { subjects: { some: { teachers: { some: { id: teacherId } } } } },
        ],
      },
      select: { id: true },
    });

    return classes.map((item) => item.id);
  }

  private async getTeacherRelatedParentIds(
    teacherId: string,
  ): Promise<string[]> {
    const classIds = await this.getTeacherClassIds(teacherId);
    if (!classIds.length) return [];

    const students = await this.prisma.student.findMany({
      where: {
        classId: { in: classIds },
      },
      select: {
        parentId: true,
      },
    });

    return Array.from(new Set(students.map((student) => student.parentId)));
  }

  private async getParentRelatedTeacherIds(
    parentId: string,
  ): Promise<string[]> {
    const classIds = await this.prisma.student.findMany({
      where: { parentId },
      select: { classId: true },
    });

    const uniqueClassIds = Array.from(
      new Set(classIds.map((item) => item.classId)),
    );
    if (!uniqueClassIds.length) return [];

    const classes = await this.prisma.class.findMany({
      where: {
        id: { in: uniqueClassIds },
      },
      select: {
        supervisorId: true,
        lessons: {
          where: { teacherId: { not: null } },
          select: { teacherId: true },
        },
        subjects: {
          select: {
            teachers: {
              select: { id: true },
            },
          },
        },
      },
    });

    const teacherIds = new Set<string>();

    classes.forEach((item) => {
      if (item.supervisorId) teacherIds.add(item.supervisorId);
      item.lessons.forEach((lesson) => {
        if (lesson.teacherId) teacherIds.add(lesson.teacherId);
      });
      item.subjects.forEach((subject) => {
        subject.teachers.forEach((teacher) => teacherIds.add(teacher.id));
      });
    });

    return Array.from(teacherIds);
  }

  private async canUsersChat(
    currentUserId: string,
    currentUserRole: Roles,
    targetUserId: string,
    targetUserRole: Roles,
  ) {
    this.assertSupportedRole(currentUserRole);
    this.assertSupportedRole(targetUserRole as SupportedChatRole);

    if (this.isAdminRole(currentUserRole)) {
      return [
        Roles.ADMIN,
        Roles.SUPER_ADMIN,
        Roles.TEACHER,
        Roles.PARENT,
      ].includes(targetUserRole);
    }

    if (this.isAdminRole(targetUserRole)) {
      return [Roles.TEACHER, Roles.PARENT].includes(currentUserRole);
    }

    if (currentUserRole === Roles.TEACHER && targetUserRole === Roles.PARENT) {
      const parentIds = await this.getTeacherRelatedParentIds(currentUserId);
      return parentIds.includes(targetUserId);
    }

    if (currentUserRole === Roles.PARENT && targetUserRole === Roles.TEACHER) {
      const teacherIds = await this.getParentRelatedTeacherIds(currentUserId);
      return teacherIds.includes(targetUserId);
    }

    return false;
  }

  private async getUsersByIds(userIds: string[]) {
    const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
    if (!uniqueIds.length) return new Map<string, DirectoryUser>();

    const [admins, teachers, parents] = await Promise.all([
      this.prisma.admin.findMany({
        where: { id: { in: uniqueIds } },
        select: this.userSelect,
      }),
      this.prisma.teacher.findMany({
        where: { id: { in: uniqueIds } },
        select: this.userSelect,
      }),
      this.prisma.parent.findMany({
        where: { id: { in: uniqueIds } },
        select: this.userSelect,
      }),
    ]);

    return new Map<string, DirectoryUser>(
      [...admins, ...teachers, ...parents].map((user) => [user.id, user]),
    );
  }

  private async getUserById(userId: string): Promise<DirectoryUser | null> {
    const users = await this.getUsersByIds([userId]);
    return users.get(userId) || null;
  }

  private asRoles(role: PrismaRole | Roles): Roles {
    return role as unknown as Roles;
  }

  private asPrismaRole(role: PrismaRole | Roles): PrismaRole {
    return role as unknown as PrismaRole;
  }
}
