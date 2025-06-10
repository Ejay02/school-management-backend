import { Module } from '@nestjs/common';
import { EventService } from './event.service';
import { JwtService } from '@nestjs/jwt';
import { EventResolver } from './event.resolver';
import { MailService } from '../mail/mail.service';
import { GoogleCalendarService } from '../config/google.calender.config';
import { EventGateway } from './gateway/event.gateway';
import { SchedulingService } from '../shared/task/scheduling.service';

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
