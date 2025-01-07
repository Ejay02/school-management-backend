import { Resolver } from '@nestjs/graphql';
import { AttendanceService } from './attendance.service';

@Resolver()
export class AttendanceResolver {
  constructor(private attendanceService: AttendanceService) {}
}
