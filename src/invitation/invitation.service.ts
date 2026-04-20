import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Roles } from 'src/shared/enum/role';
import { v4 as uuidv4 } from 'uuid';
import { MailService } from 'src/mail/mail.service';
import { InviteStatus } from './enum/inviteStatus';
import { AuthService } from 'src/shared/auth/auth.service';

@Injectable()
export class InvitationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly authService: AuthService,
  ) {}

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private getInviteLink(token: string) {
    const baseUrl = process.env.FRONTEND_URL?.trim();
    const safeBase = baseUrl && baseUrl.length > 0 ? baseUrl : '';
    const path = `/accept-invite?token=${encodeURIComponent(token)}`;
    if (!safeBase) return path;
    return safeBase.endsWith('/') ? `${safeBase.slice(0, -1)}${path}` : `${safeBase}${path}`;
  }

  private assertRoleAllowed(role: Roles) {
    if (role !== Roles.TEACHER && role !== Roles.PARENT) {
      throw new BadRequestException('Invites are only supported for TEACHER and PARENT');
    }
  }

  private async ensureEmailNotInUse(email: string, role: Roles) {
    if (role === Roles.TEACHER) {
      const existing = await this.prisma.teacher.findFirst({ where: { email } });
      if (existing) throw new BadRequestException('A TEACHER with this email already exists');
    }
    if (role === Roles.PARENT) {
      const existing = await this.prisma.parent.findFirst({ where: { email } });
      if (existing) throw new BadRequestException('A PARENT with this email already exists');
    }
  }

  private async sendInvitationEmail(params: {
    email: string;
    role: Roles;
    token: string;
  }) {
    const link = this.getInviteLink(params.token);
    await this.mailService.sendMail({
      to: params.email,
      subject: 'You are invited to Eduhub',
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.5;">
          <h2 style="margin: 0 0 12px;">Eduhub Invitation</h2>
          <p style="margin: 0 0 8px;">You’ve been invited to join Eduhub as a ${params.role}.</p>
          <p style="margin: 0 0 8px;">
            Click to accept: <a href="${link}">${link}</a>
          </p>
          <p style="margin: 0;">If you didn’t expect this, you can ignore this email.</p>
        </div>
      `.trim(),
      text: `You’ve been invited to join Eduhub as a ${params.role}. Accept: ${link}`,
    });
  }

  async createInvitation(invitedByUserId: string, email: string, role: Roles) {
    this.assertRoleAllowed(role);
    const normalizedEmail = this.normalizeEmail(email);
    await this.ensureEmailNotInUse(normalizedEmail, role);

    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setDate(expiresAt.getDate() + 7);

    const existing = await this.prisma.invitation.findFirst({
      where: {
        email: normalizedEmail,
        role: role as any,
        status: InviteStatus.PENDING as any,
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existing) {
      return existing;
    }

    const token = uuidv4();
    const invite = await this.prisma.invitation.create({
      data: {
        email: normalizedEmail,
        role: role as any,
        token,
        status: InviteStatus.PENDING as any,
        invitedBy: invitedByUserId,
        sentCount: 1,
        lastSentAt: now,
        expiresAt,
      },
    });

    await this.sendInvitationEmail({ email: normalizedEmail, role, token });

    return invite;
  }

  async resendInvitation(invitedByUserId: string, invitationId: string) {
    const invite = await this.prisma.invitation.findUnique({
      where: { id: invitationId },
    });

    if (!invite) throw new NotFoundException('Invitation not found');

    if (invite.status !== (InviteStatus.PENDING as any)) {
      throw new BadRequestException('Only pending invitations can be resent');
    }

    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setDate(expiresAt.getDate() + 7);

    const newToken = uuidv4();

    const updated = await this.prisma.invitation.update({
      where: { id: invitationId },
      data: {
        token: newToken,
        invitedBy: invitedByUserId,
        sentCount: { increment: 1 },
        lastSentAt: now,
        expiresAt,
      },
    });

    await this.sendInvitationEmail({
      email: updated.email,
      role: updated.role as any,
      token: updated.token,
    });

    return updated;
  }

  async revokeInvitation(invitationId: string) {
    const invite = await this.prisma.invitation.findUnique({
      where: { id: invitationId },
    });
    if (!invite) throw new NotFoundException('Invitation not found');

    if (invite.status !== (InviteStatus.PENDING as any)) {
      return invite;
    }

    return this.prisma.invitation.update({
      where: { id: invitationId },
      data: {
        status: InviteStatus.REVOKED as any,
      },
    });
  }

  async listInvitations(status?: InviteStatus) {
    const now = new Date();

    await this.prisma.invitation.updateMany({
      where: {
        status: InviteStatus.PENDING as any,
        expiresAt: { lte: now },
      },
      data: {
        status: InviteStatus.EXPIRED as any,
      },
    });

    return this.prisma.invitation.findMany({
      where: status ? { status: status as any } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  async validateInvitationToken(token: string) {
    const invite = await this.prisma.invitation.findUnique({ where: { token } });
    if (!invite) throw new NotFoundException('Invitation not found');

    const now = new Date();
    if (invite.status !== (InviteStatus.PENDING as any)) {
      throw new BadRequestException('Invitation is not active');
    }
    if (invite.expiresAt <= now) {
      await this.prisma.invitation.update({
        where: { id: invite.id },
        data: { status: InviteStatus.EXPIRED as any },
      });
      throw new BadRequestException('Invitation has expired');
    }

    return invite;
  }

  async acceptInvitation(input: {
    token: string;
    username: string;
    name: string;
    surname: string;
    password: string;
    ipAddress?: string;
  }) {
    const invite = await this.validateInvitationToken(input.token);

    const authResponse = await this.authService.signup(
      {
        username: input.username,
        name: input.name,
        surname: input.surname,
        password: input.password,
        email: invite.email,
        role: invite.role as any,
      } as any,
      input.ipAddress,
    );

    await this.prisma.invitation.update({
      where: { id: invite.id },
      data: {
        status: InviteStatus.ACCEPTED as any,
        acceptedAt: new Date(),
      },
    });

    return authResponse;
  }
}

