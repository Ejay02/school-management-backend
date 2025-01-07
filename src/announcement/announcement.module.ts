import { Module } from '@nestjs/common';
import { AnnouncementService } from './announcement.service';
import { JwtService } from '@nestjs/jwt';
import { AnnouncementResolver } from './announcement.resolver';
import { AnnouncementGateway } from './gateway/announcement.gateway';

@Module({
  imports: [],
  providers: [
    AnnouncementService,
    JwtService,
    AnnouncementResolver,
    AnnouncementGateway,
  ],
  exports: [AnnouncementService],
})
export class AnnouncementModule {}
