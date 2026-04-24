import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { Roles } from 'src/shared/enum/role';
import { v4 as uuidv4 } from 'uuid';
import { MailService } from 'src/mail/mail.service';
import { InviteStatus } from './enum/inviteStatus';
import { AuthService } from 'src/shared/auth/auth.service';
import { PaginationInput } from 'src/shared/pagination/input/pagination.input';

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

  private normalizeName(name: string) {
    return name.trim().replace(/\s+/g, ' ');
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
    name?: string | null;
    role: Roles;
    token: string;
  }) {
    const link = this.getInviteLink(params.token);
    const greeting = params.name ? `<p style="margin: 0 0 8px;">Hi ${params.name},</p>` : '';
    await this.mailService.sendMail({
      to: params.email,
      subject: 'You are invited to Eduhub',
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.5;">
          <h2 style="margin: 0 0 12px;">Eduhub Invitation</h2>
          ${greeting}
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

  private async refreshExpiredInvitations() {
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
  }

  private buildWhereClause(options?: {
    status?: InviteStatus;
    role?: Roles;
    search?: string;
  }): Prisma.InvitationWhereInput {
    const where: Prisma.InvitationWhereInput = {};

    if (options?.status) {
      where.status = options.status as any;
    }

    if (options?.role) {
      this.assertRoleAllowed(options.role);
      where.role = options.role as any;
    }

    if (options?.search?.trim()) {
      const search = options.search.trim();
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    return where;
  }

  private formatActivationLabel(role: Roles | undefined, accepted: number, totalSent: number) {
    if (role === Roles.TEACHER) {
      return `${accepted} of ${totalSent} teachers activated`;
    }

    if (role === Roles.PARENT) {
      return `${accepted} of ${totalSent} parents activated`;
    }

    return `${accepted} of ${totalSent} invited users activated`;
  }

  async createInvitation(
    invitedByUserId: string,
    name: string,
    email: string,
    role: Roles,
  ) {
    this.assertRoleAllowed(role);
    const normalizedName = this.normalizeName(name);
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
      return this.prisma.invitation.update({
        where: { id: existing.id },
        data: {
          name: normalizedName,
          invitedBy: invitedByUserId,
        },
      });
    }

    const token = uuidv4();
    const invite = await this.prisma.invitation.create({
      data: {
        name: normalizedName,
        email: normalizedEmail,
        role: role as any,
        token,
        status: InviteStatus.PENDING as any,
        invitedBy: invitedByUserId,
        sentAt: now,
        sentCount: 1,
        lastSentAt: now,
        expiresAt,
      },
    });

    await this.sendInvitationEmail({
      email: normalizedEmail,
      name: normalizedName,
      role,
      token,
    });

    return invite;
  }

  async resendInvitation(invitedByUserId: string, invitationId: string) {
    const invite = await this.prisma.invitation.findUnique({
      where: { id: invitationId },
    });

    if (!invite) throw new NotFoundException('Invitation not found');

    if (
      invite.status !== (InviteStatus.PENDING as any) &&
      invite.status !== (InviteStatus.EXPIRED as any)
    ) {
      throw new BadRequestException('Only pending or expired invitations can be resent');
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
        status: InviteStatus.PENDING as any,
        sentCount: { increment: 1 },
        lastSentAt: now,
        expiresAt,
        revokedAt: null,
      },
    });

    await this.sendInvitationEmail({
      email: updated.email,
      name: updated.name,
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
        revokedAt: new Date(),
      },
    });
  }

  async listInvitations(options?: {
    status?: InviteStatus;
    role?: Roles;
    params?: PaginationInput;
  }) {
    await this.refreshExpiredInvitations();

    const page = Math.max(options?.params?.page || 1, 1);
    const limit = Math.max(options?.params?.limit || 10, 1);
    const skip = (page - 1) * limit;
    const where = this.buildWhereClause({
      status: options?.status,
      role: options?.role,
      search: options?.params?.search,
    });

    const [items, totalCount] = await Promise.all([
      this.prisma.invitation.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.invitation.count({ where }),
    ]);

    const totalPages = Math.max(Math.ceil(totalCount / limit), 1);

    return {
      items,
      pageInfo: {
        page,
        limit,
        totalCount,
        totalPages,
        hasMore: page < totalPages,
      },
    };
  }

  async getInvitationSummary(role?: Roles) {
    if (role) {
      this.assertRoleAllowed(role);
    }

    await this.refreshExpiredInvitations();

    const overallWhere = role ? { role: role as any } : undefined;
    const [totalSent, accepted, pending, expired, revoked] = await Promise.all([
      this.prisma.invitation.count({ where: overallWhere }),
      this.prisma.invitation.count({
        where: { ...overallWhere, status: InviteStatus.ACCEPTED as any },
      }),
      this.prisma.invitation.count({
        where: { ...overallWhere, status: InviteStatus.PENDING as any },
      }),
      this.prisma.invitation.count({
        where: { ...overallWhere, status: InviteStatus.EXPIRED as any },
      }),
      this.prisma.invitation.count({
        where: { ...overallWhere, status: InviteStatus.REVOKED as any },
      }),
    ]);

    const roleBreakdown = await Promise.all(
      [Roles.TEACHER, Roles.PARENT].map(async (currentRole) => {
        const [roleTotalSent, roleAccepted, rolePending, roleExpired, roleRevoked] =
          await Promise.all([
            this.prisma.invitation.count({
              where: { role: currentRole as any },
            }),
            this.prisma.invitation.count({
              where: {
                role: currentRole as any,
                status: InviteStatus.ACCEPTED as any,
              },
            }),
            this.prisma.invitation.count({
              where: {
                role: currentRole as any,
                status: InviteStatus.PENDING as any,
              },
            }),
            this.prisma.invitation.count({
              where: {
                role: currentRole as any,
                status: InviteStatus.EXPIRED as any,
              },
            }),
            this.prisma.invitation.count({
              where: {
                role: currentRole as any,
                status: InviteStatus.REVOKED as any,
              },
            }),
          ]);

        const roleActivationRate =
          roleTotalSent === 0 ? 0 : Number(((roleAccepted / roleTotalSent) * 100).toFixed(2));

        return {
          role: currentRole,
          totalSent: roleTotalSent,
          accepted: roleAccepted,
          pending: rolePending,
          expired: roleExpired,
          revoked: roleRevoked,
          activationRate: roleActivationRate,
          activationLabel: this.formatActivationLabel(
            currentRole,
            roleAccepted,
            roleTotalSent,
          ),
        };
      }),
    );

    const activationRate =
      totalSent === 0 ? 0 : Number(((accepted / totalSent) * 100).toFixed(2));

    return {
      totalSent,
      accepted,
      pending,
      expired,
      revoked,
      activationRate,
      activationLabel: this.formatActivationLabel(role, accepted, totalSent),
      roleBreakdown: role
        ? roleBreakdown.filter((item) => item.role === role)
        : roleBreakdown,
    };
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
