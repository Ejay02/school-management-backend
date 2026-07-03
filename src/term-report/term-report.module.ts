import { Module } from '@nestjs/common';
import { TermReportResolver } from './term-report.resolver';
import { TermReportService } from './term-report.service';

@Module({
  providers: [TermReportResolver, TermReportService],
  exports: [TermReportService],
})
export class TermReportModule {}
