import { Body, Controller, Post } from '@nestjs/common';
import { ContactService } from './contact.service';

@Controller('contact')
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  @Post()
  async submitContactForm(
    @Body()
    body: {
      name: string;
      email: string;
      inquiryType: string;
      message: string;
      agreeToTerms: boolean;
    },
  ) {
    return this.contactService.sendContactMessage(body);
  }
}
