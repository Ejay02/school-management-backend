import { Module } from '@nestjs/common';
import { AnnouncementService } from './announcement.service';
import { JwtService } from '@nestjs/jwt';
import { AnnouncementResolver } from './announcement.resolver';
import { AnnouncementGateway } from './gateway/announcement.gateway';
import { AuthModule } from 'src/shared/auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [
    AnnouncementService,
    JwtService,
    AnnouncementResolver,
    AnnouncementGateway,
  ],
  exports: [AnnouncementService],
})
export class AnnouncementModule {}
