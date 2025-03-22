import { Module } from '@nestjs/common';

import { SchedulingService } from './scheduling.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { JwtService } from '@nestjs/jwt';

@Module({
  imports: [PrismaModule],
  providers: [SchedulingService, JwtService],
  exports: [SchedulingService],
})
export class SchedulingModule {}
