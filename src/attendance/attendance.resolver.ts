import { Resolver } from '@nestjs/graphql';
import { AttendanceService } from './attendance.service';
import { JwtAuthGuard } from 'src/shared/auth/guards/jwtAuth.guard';
import { RolesGuard } from 'src/shared/auth/guards/roles.guard';
import { UseGuards } from '@nestjs/common';

@Resolver()
@UseGuards(JwtAuthGuard, RolesGuard)
export class AttendanceResolver {
  constructor(private attendanceService: AttendanceService) {}
}
