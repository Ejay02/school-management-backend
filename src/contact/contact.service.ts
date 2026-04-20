import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { MailService } from 'src/mail/mail.service';

type ContactMessageInput = {
  name: string;
  email: string;
  inquiryType: string;
  message: string;
  agreeToTerms: boolean;
};

@Injectable()
export class ContactService {
  constructor(private readonly mailService: MailService) {}

  private normalizeInput(input: ContactMessageInput) {
    return {
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      inquiryType: input.inquiryType.trim(),
      message: input.message.trim(),
      agreeToTerms: Boolean(input.agreeToTerms),
    };
  }

  private validateInput(input: ContactMessageInput) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (input.name.length < 2) {
      throw new BadRequestException('Name must be at least 2 characters');
    }

    if (!emailRegex.test(input.email)) {
      throw new BadRequestException('Please enter a valid email address');
    }

    if (!input.inquiryType) {
      throw new BadRequestException('Please select an inquiry type');
    }

    if (input.message.length < 10) {
      throw new BadRequestException('Message must be at least 10 characters');
    }

    if (input.message.length > 500) {
      throw new BadRequestException('Message cannot exceed 500 characters');
    }

    if (!input.agreeToTerms) {
      throw new BadRequestException(
        'You must agree to the privacy policy and terms of service',
      );
    }
  }

  async sendContactMessage(rawInput: ContactMessageInput) {
    const input = this.normalizeInput(rawInput);
    this.validateInput(input);

    const recipient = process.env.MAIL_USER;

    if (!recipient) {
      throw new ServiceUnavailableException(
        'Contact email is not configured on the server',
      );
    }

    await this.mailService.sendMail({
      to: recipient,
      subject: `New Contact Inquiry: ${input.inquiryType}`,
      replyTo: input.email,
      text: [
        'New contact form submission',
        `Name: ${input.name}`,
        `Email: ${input.email}`,
        `Inquiry Type: ${input.inquiryType}`,
        '',
        input.message,
      ].join('\n'),
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.5;">
          <h2 style="margin: 0 0 12px;">New Contact Form Submission</h2>
          <p style="margin: 0 0 8px;"><strong>Name:</strong> ${input.name}</p>
          <p style="margin: 0 0 8px;"><strong>Email:</strong> ${input.email}</p>
          <p style="margin: 0 0 8px;"><strong>Inquiry Type:</strong> ${input.inquiryType}</p>
          <p style="margin: 12px 0 8px;"><strong>Message:</strong></p>
          <p style="margin: 0; white-space: pre-wrap;">${input.message}</p>
        </div>
      `.trim(),
    });

    return {
      success: true,
      message: 'Your message has been sent successfully',
    };
  }
}
