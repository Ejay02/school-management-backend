import { Module } from '@nestjs/common';
import { ResultService } from './result.service';
import { ResultResolver } from './result.resolver';
import { JwtService } from '@nestjs/jwt';
import { AnnouncementService } from 'src/announcement/announcement.service';
import { AnnouncementGateway } from 'src/announcement/gateway/announcement.gateway';

@Module({
  imports: [],
  providers: [
    ResultService,
    JwtService,
    ResultResolver,
    AnnouncementService,
    AnnouncementGateway,
  ],
  exports: [ResultService],
})
export class ResultModule {}
