import { MailerService } from '@nestjs-modules/mailer';
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

type MailType = 'onboarding' | 'no-reply';

@Injectable()
export class MailService {
  private schoolNameCache: { value: string | null; expiresAt: number } | null =
    null;

  constructor(
    private prisma: PrismaService,
    private mailerService: MailerService,
  ) {}

  private async getSchoolName() {
    const now = Date.now();
    if (this.schoolNameCache && this.schoolNameCache.expiresAt > now) {
      return this.schoolNameCache.value;
    }

    const state = await this.prisma.setupState.upsert({
      where: { id: 'default' },
      update: {},
      create: { id: 'default' },
      select: { schoolName: true },
    });

    const value =
      typeof state.schoolName === 'string' && state.schoolName.trim().length
        ? state.schoolName.trim()
        : null;

    this.schoolNameCache = { value, expiresAt: now + 5 * 60 * 1000 };
    return value;
  }

  private stripQuotes(value: string) {
    return value.replace(/"/g, '');
  }

  async sendMail({
    to,
    subject,
    template,
    context,
    text,
    html,
    replyTo,
    from,
    mailType,
  }: {
    to: string;
    subject: string;
    template?: string;
    context?: any;
    text?: string;
    html?: string;
    replyTo?: string;
    from?: string;
    mailType?: MailType;
  }) {
    const resolvedType: MailType = mailType ?? 'no-reply';
    const senderEmail =
      resolvedType === 'onboarding'
        ? process.env.MAIL_ONBOARDING_EMAIL?.trim()
        : process.env.NO_REPLY_EMAIL?.trim();

    if (!senderEmail) {
      throw new Error(
        resolvedType === 'onboarding'
          ? 'MAIL_ONBOARDING_EMAIL is not configured'
          : 'NO_REPLY_EMAIL is not configured',
      );
    }

    const schoolName = await this.getSchoolName();
    const resolvedFrom =
      from ||
      (schoolName ? `"${this.stripQuotes(schoolName)}" <${senderEmail}>` : senderEmail);

    await this.mailerService.sendMail({
      to,
      subject,
      template,
      context,
      text,
      html,
      replyTo,
      from: resolvedFrom,
    });
  }
}
