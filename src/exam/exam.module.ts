import { Module } from '@nestjs/common';
import { ExamService } from './exam.service';
import { JwtService } from '@nestjs/jwt';
import { ExamResolver } from './exam.resolver';

@Module({
  imports: [],
  providers: [ExamService, JwtService, ExamResolver],
  exports: [ExamService],
})
export class ExamModule {}
