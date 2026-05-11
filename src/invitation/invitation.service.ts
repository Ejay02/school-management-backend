import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { Roles } from 'src/shared/enum/role';
import { formatFirstName } from 'src/shared/utils/name.utils';
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

  private escapeHtml(value: string) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private escapeHtmlAttribute(value: string) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private normalizePublicImageUrl(value: string | null | undefined) {
    const raw = typeof value === 'string' ? value.trim() : '';
    if (!raw) return null;

    const withProtocol = (() => {
      if (/^https?:\/\//i.test(raw)) return raw;
      if (/^\/\//.test(raw)) return `https:${raw}`;
      if (/^[a-z0-9.-]+\.[a-z]{2,}\//i.test(raw)) return `https://${raw}`;
      return null;
    })();

    if (!withProtocol) return null;

    try {
      const url = new URL(withProtocol);
      if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
      return url.toString();
    } catch {
      return null;
    }
  }

  private async getSchoolBranding() {
    const state = await this.prisma.setupState.upsert({
      where: { id: 'default' },
      update: {},
      create: { id: 'default' },
    });

    return {
      schoolName: state.schoolName?.trim() || null,
      schoolAddress: state.schoolAddress?.trim() || null,
      schoolLogo: state.schoolLogo?.trim() || null,
    };
  }

  private roleLabel(role: Roles) {
    if (role === Roles.ADMIN) return 'Administrator';
    if (role === Roles.TEACHER) return 'Teacher';
    if (role === Roles.PARENT) return 'Parent / Guardian';
    return 'User';
  }

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
    return safeBase.endsWith('/')
      ? `${safeBase.slice(0, -1)}${path}`
      : `${safeBase}${path}`;
  }

  private assertRoleAllowed(role: Roles) {
    if (
      role !== Roles.TEACHER &&
      role !== Roles.PARENT &&
      role !== Roles.ADMIN
    ) {
      throw new BadRequestException(
        'Invites are only supported for ADMIN, TEACHER, and PARENT',
      );
    }
  }

  private async ensureEmailNotInUse(email: string, role: Roles) {
    if (role === Roles.ADMIN || role === Roles.SUPER_ADMIN) {
      const existing = await this.prisma.admin.findFirst({ where: { email } });
      if (existing)
        throw new BadRequestException(
          'An ADMIN with this email already exists',
        );
    }
    if (role === Roles.TEACHER) {
      const existing = await this.prisma.teacher.findFirst({
        where: { email },
      });
      if (existing)
        throw new BadRequestException(
          'A TEACHER with this email already exists',
        );
    }
    if (role === Roles.PARENT) {
      const existing = await this.prisma.parent.findFirst({ where: { email } });
      if (existing)
        throw new BadRequestException(
          'A PARENT with this email already exists',
        );
    }
  }

  private async sendInvitationEmail(params: {
    email: string;
    name?: string | null;
    role: Roles;
    token: string;
  }) {
    const link = this.getInviteLink(params.token);
    const { schoolAddress, schoolLogo, schoolName } =
      await this.getSchoolBranding();

    const roleLabel = this.roleLabel(params.role);
    const safeRoleLabel = this.escapeHtml(roleLabel);
    const inviteeName = formatFirstName(params.name) || 'there';
    const safeInviteeName = this.escapeHtml(inviteeName);
    const safeSchoolName = this.escapeHtml(schoolName || 'your school');
    const safeSchoolAddress = schoolAddress
      ? this.escapeHtml(schoolAddress)
      : null;
    const safeLink = this.escapeHtml(link);
    const logoUrl = this.normalizePublicImageUrl(schoolLogo);
    const safeLogoUrl = logoUrl ? this.escapeHtmlAttribute(logoUrl) : null;

    const isTeacherInvite = params.role === Roles.TEACHER;

    const subject = isTeacherInvite
      ? `You're Invited to Join ${schoolName || 'your school'} as a Teacher 🎓`
      : `You're Invited to Join ${schoolName || 'your school'}`;

    const preheader = isTeacherInvite
      ? `You're invited to join ${schoolName || 'your school'} as a Teacher.`
      : `You're invited to join ${schoolName || 'your school'} as a ${roleLabel}.`;

    const safePreheader = this.escapeHtml(preheader);
    const frontendBase = (() => {
      const raw = process.env.FRONTEND_URL?.trim();
      if (!raw) return null;
      const normalized = raw.endsWith('/') ? raw.slice(0, -1) : raw;
      return normalized.length ? this.escapeHtml(normalized) : null;
    })();

    const teacherHtml = `
      <!doctype html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <meta name="x-apple-disable-message-reformatting" />
          <title>${subject}</title>
        </head>
        <body style="margin:0; padding:0; background-color:#f3f1ff;">
          <div style="display:none; font-size:1px; line-height:1px; max-height:0; max-width:0; opacity:0; overflow:hidden; mso-hide:all;">
            ${safePreheader}
          </div>

          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f3f1ff; padding:24px 12px;">
            <tr>
              <td align="center">
                <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="width:600px; max-width:600px; background-color:#ffffff; border-radius:16px; overflow:hidden; border:1px solid #e8e6ff;">
                  <tr>
                    <td style="background-color:#efedff; padding:22px 22px 18px; text-align:center;">
                      <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                        <tr>
                          <td align="center" style="padding-bottom:10px;">
                            ${
                              safeLogoUrl
                                ? `<img src="${safeLogoUrl}" width="44" height="44" alt="${safeSchoolName}" style="display:block; width:44px; height:44px; border-radius:10px; object-fit:cover;" />`
                                : `<div style="width:44px; height:44px; border-radius:10px; background-color:#3b2fa3; display:inline-block;"></div>`
                            }
                          </td>
                        </tr>
                        <tr>
                          <td align="center" style="font-family: ui-sans-serif, -apple-system, Segoe UI, Roboto, Arial, sans-serif; color:#2a2457; font-size:20px; font-weight:700; letter-spacing:0.2px;">
                            ${safeSchoolName}
                          </td>
                        </tr>
                        <tr>
                          <td align="center" style="padding-top:12px;">
                            <span style="display:inline-block; font-family: ui-sans-serif, -apple-system, Segoe UI, Roboto, Arial, sans-serif; font-size:12px; font-weight:600; color:#2a2457; background-color:#dcd8ff; padding:6px 10px; border-radius:999px;">
                              ${safeRoleLabel}
                            </span>
                          </td>
                        </tr>
                        <tr>
                          <td align="center" style="padding-top:18px; font-family: ui-serif, Georgia, 'Times New Roman', serif; color:#17123a; font-size:30px; line-height:36px; font-weight:700;">
                            You're invited to teach at ${safeSchoolName}
                          </td>
                        </tr>
                        <tr>
                          <td align="center" style="padding-top:10px; font-family: ui-sans-serif, -apple-system, Segoe UI, Roboto, Arial, sans-serif; color:#4b4675; font-size:15px; line-height:22px;">
                            Join a community of educators making a real difference.
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:22px; font-family: ui-sans-serif, -apple-system, Segoe UI, Roboto, Arial, sans-serif; color:#17123a; font-size:15px; line-height:22px;">
                      <p style="margin:0 0 12px; font-weight:700;">Hi ${safeInviteeName},</p>
                      <p style="margin:0 0 14px; color:#2f2a5e;">
                        We're excited to have you on board. You've been invited to join <strong>${safeSchoolName}</strong> as a <strong>Teacher</strong>.
                      </p>

                      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:14px 0 18px;">
                        <tr>
                          <td style="padding:0;">
                            <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                              <tr>
                                <td style="padding:10px 10px 0 0;" width="50%">
                                  <div style="background-color:#f8f7ff; border:1px solid #eceaff; border-radius:12px; padding:12px; color:#2f2a5e; font-size:13px; line-height:18px;">
                                    Manage classes &amp; assignments
                                  </div>
                                </td>
                                <td style="padding:10px 0 0 10px;" width="50%">
                                  <div style="background-color:#f8f7ff; border:1px solid #eceaff; border-radius:12px; padding:12px; color:#2f2a5e; font-size:13px; line-height:18px;">
                                    Track student progress
                                  </div>
                                </td>
                              </tr>
                              <tr>
                                <td style="padding:10px 10px 0 0;" width="50%">
                                  <div style="background-color:#f8f7ff; border:1px solid #eceaff; border-radius:12px; padding:12px; color:#2f2a5e; font-size:13px; line-height:18px;">
                                    Message parents &amp; admins
                                  </div>
                                </td>
                                <td style="padding:10px 0 0 10px;" width="50%">
                                  <div style="background-color:#f8f7ff; border:1px solid #eceaff; border-radius:12px; padding:12px; color:#2f2a5e; font-size:13px; line-height:18px;">
                                    Schedule &amp; lesson planning
                                  </div>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>

                      <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto 12px;">
                        <tr>
                          <td align="center" bgcolor="#3b2fa3" style="border-radius:12px;">
                            <a href="${safeLink}" style="display:inline-block; padding:14px 20px; font-family: ui-sans-serif, -apple-system, Segoe UI, Roboto, Arial, sans-serif; font-size:15px; font-weight:700; color:#ffffff; text-decoration:none; border-radius:12px;">
                              Accept invitation
                            </a>
                          </td>
                        </tr>
                      </table>

                      <div style="border-top:1px solid #f0effa; margin:18px 0 14px;"></div>

                      <p style="margin:0 0 10px; color:#4b4675; font-size:13px; line-height:18px;">
                        Button not working? Copy and paste this link into your browser:
                      </p>
                      <p style="margin:0 0 14px; font-size:13px; line-height:18px;">
                        <a href="${safeLink}" style="color:#3b2fa3; text-decoration:underline; word-break:break-word;">${safeLink}</a>
                      </p>
                      <p style="margin:0; color:#4b4675; font-size:13px; line-height:18px;">
                        If you weren't expecting this invitation or believe it was sent in error, you can safely ignore this email — no action will be taken.
                      </p>
                      <p style="margin:14px 0 0; color:#2f2a5e;">
                        Welcome to <strong>${safeSchoolName}</strong>. We can't wait to see the impact you'll make.
                      </p>
                      <p style="margin:12px 0 0; color:#2f2a5e;">
                        Warm regards,<br />
                        The <strong>${safeSchoolName}</strong> Team
                      </p>
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:18px 22px 22px; background-color:#ffffff; border-top:1px solid #f0effa; text-align:center; font-family: ui-sans-serif, -apple-system, Segoe UI, Roboto, Arial, sans-serif; color:#7a769a; font-size:12px; line-height:18px;">
                      <div style="margin:0 0 6px;">© ${new Date().getFullYear()} ${safeSchoolName}</div>
                      ${
                        frontendBase
                          ? `<div style="margin:0 0 6px;">
                              <a href="${frontendBase}/privacy-policy" style="color:#7a769a; text-decoration:underline;">Privacy Policy</a>
                              <span style="padding:0 6px;">·</span>
                              <a href="${frontendBase}/unsubscribe" style="color:#7a769a; text-decoration:underline;">Unsubscribe</a>
                              <span style="padding:0 6px;">·</span>
                              <a href="${frontendBase}" style="color:#7a769a; text-decoration:underline;">Website</a>
                            </div>`
                          : ``
                      }
                      ${
                        safeSchoolAddress
                          ? `<div style="margin:0;">${safeSchoolAddress}</div>`
                          : `<div style="margin:0;">${safeSchoolName}</div>`
                      }
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `.trim();

    const fallbackGreeting = inviteeName ? `Hi ${inviteeName},` : 'Hi,';

    const text = isTeacherInvite
      ? `${fallbackGreeting}\n\nYou're invited to join ${schoolName || 'your school'} as a Teacher.\n\nAccept invitation: ${link}\n\nIf you weren't expecting this invitation, you can safely ignore this email — no action will be taken.\n\n— The ${schoolName || 'School'} Team`
      : `${fallbackGreeting}\n\nYou’ve been invited to join ${schoolName || 'your school'} as a ${roleLabel}.\n\nAccept: ${link}\n\nIf you didn’t expect this, you can ignore this email.`;

    await this.mailService.sendMail({
      to: params.email,
      subject,
      mailType: 'onboarding',
      html: isTeacherInvite ? teacherHtml : undefined,
      text,
      ...(isTeacherInvite
        ? {}
        : {
            html: `
              <div style="font-family: Arial, sans-serif; line-height: 1.5;">
                <h2 style="margin: 0 0 12px;">${safeSchoolName} Invitation</h2>
                ${
                  params.name
                    ? `<p style="margin: 0 0 8px;">Hi ${safeInviteeName},</p>`
                    : ''
                }
                <p style="margin: 0 0 8px;">You’ve been invited to join ${safeSchoolName} as a ${safeRoleLabel}.</p>
                <p style="margin: 0 0 8px;">
                  Click to accept: <a href="${safeLink}">${safeLink}</a>
                </p>
                <p style="margin: 0;">If you didn’t expect this, you can ignore this email.</p>
              </div>
            `.trim(),
          }),
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

  private formatActivationLabel(
    role: Roles | undefined,
    accepted: number,
    totalSent: number,
  ) {
    if (role === Roles.ADMIN) {
      return `${accepted} of ${totalSent} admins activated`;
    }

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
      throw new BadRequestException(
        'Only pending or expired invitations can be resent',
      );
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
      [Roles.ADMIN, Roles.TEACHER, Roles.PARENT].map(async (currentRole) => {
        const [
          roleTotalSent,
          roleAccepted,
          rolePending,
          roleExpired,
          roleRevoked,
        ] = await Promise.all([
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
          roleTotalSent === 0
            ? 0
            : Number(((roleAccepted / roleTotalSent) * 100).toFixed(2));

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
    const invite = await this.prisma.invitation.findUnique({
      where: { token },
    });
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
