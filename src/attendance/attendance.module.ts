import { Module } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { JwtService } from '@nestjs/jwt';
import { AttendanceResolver } from './attendance.resolver';

@Module({
  imports: [],
  providers: [AttendanceService, JwtService, AttendanceResolver],
  exports: [AttendanceService],
})
export class AttendanceModule {}
