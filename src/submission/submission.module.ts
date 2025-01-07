import { Module } from '@nestjs/common';
import { SubmissionService } from './submission.service';
import { JwtService } from '@nestjs/jwt';
import { SubmissionResolver } from './submission.resolver';

@Module({
  imports: [],
  providers: [SubmissionService, JwtService, SubmissionResolver],
  exports: [SubmissionService],
})
export class SubmissionModule {}
