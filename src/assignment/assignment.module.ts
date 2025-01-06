import { Module } from '@nestjs/common';
import { AssignmentService } from './assignment.service';
import { AssignmentResolver } from './assignment.resolver';
import { JwtService } from '@nestjs/jwt';

@Module({
  imports: [],
  providers: [AssignmentService, JwtService, AssignmentResolver],
  exports: [AssignmentService],
})
export class AssignmentModule {}
