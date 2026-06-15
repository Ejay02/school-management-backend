import { Module } from '@nestjs/common';

import { SchedulingService } from './scheduling.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { JwtService } from '@nestjs/jwt';
import { AuthModule } from 'src/shared/auth/auth.module';
import { MailModule } from 'src/mail/mail.module';

@Module({
  imports: [PrismaModule, AuthModule, MailModule],
  providers: [SchedulingService, JwtService],
  exports: [SchedulingService],
})
export class SchedulingModule {}
