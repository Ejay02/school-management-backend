import { Module } from '@nestjs/common';
import { EventService } from './event.service';
import { JwtService } from '@nestjs/jwt';
import { EventResolver } from './event.resolver';
import { MailService } from 'src/mail/mail.service';
import { GoogleCalendarService } from 'src/config/google.calender.config';
import { EventGateway } from './gateway/event.gateway';
import { SchedulingService } from 'src/shared/task/scheduling.service';

@Module({
  imports: [],
  providers: [
    EventService,
    JwtService,
    EventResolver,
    MailService,
    EventGateway,
    SchedulingService,
    GoogleCalendarService,
  ],
  exports: [EventService],
})
export class EventModule {}
