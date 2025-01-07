import { Module } from '@nestjs/common';
import { EventService } from './event.service';
import { JwtService } from '@nestjs/jwt';
import { EventResolver } from './event.resolver';

@Module({
  imports: [],
  providers: [EventService, JwtService, EventResolver],
  exports: [EventService],
})
export class EventModule {}
