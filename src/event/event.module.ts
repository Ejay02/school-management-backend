import { Module } from '@nestjs/common';
import { EventService } from './event.service';
import { JwtService } from '@nestjs/jwt';
import { EventResolver } from './event.resolver';
import { GoogleCalendarService } from '../config/google.calender.config';
import { EventGateway } from './gateway/event.gateway';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [MailModule],
  providers: [
    EventService,
    JwtService,
    EventResolver,
    EventGateway,
    GoogleCalendarService,
  ],
  exports: [EventService],
})
export class EventModule {}
