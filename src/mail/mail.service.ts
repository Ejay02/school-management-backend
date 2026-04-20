import { MailerService } from '@nestjs-modules/mailer';
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class MailService {
  constructor(
    private prisma: PrismaService,
    private mailerService: MailerService,
  ) {}

  async sendMail({
    to,
    subject,
    template,
    context,
    text,
    html,
    replyTo,
  }: {
    to: string;
    subject: string;
    template?: string;
    context?: any;
    text?: string;
    html?: string;
    replyTo?: string;
  }) {
    await this.mailerService.sendMail({
      to,
      subject,
      template,
      context,
      text,
      html,
      replyTo,
    });
  }
}
