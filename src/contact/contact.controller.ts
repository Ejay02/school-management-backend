import { Body, Controller, Post } from '@nestjs/common';
import { ContactService } from './contact.service';
import { IsBoolean, IsEmail, IsIn, IsString, MaxLength, MinLength } from 'class-validator';

class ContactFormDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsString()
  @IsIn(['admissions', 'academics', 'financial', 'support', 'other'])
  inquiryType: string;

  @IsString()
  @MinLength(10)
  @MaxLength(500)
  message: string;

  @IsBoolean()
  agreeToTerms: boolean;
}

@Controller('contact')
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  @Post()
  async submitContactForm(
    @Body()
    body: ContactFormDto,
  ) {
    return this.contactService.sendContactMessage(body);
  }
}
