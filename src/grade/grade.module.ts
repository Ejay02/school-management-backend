import { Module } from '@nestjs/common';
import { GradeService } from './grade.service';
import { JwtService } from '@nestjs/jwt';
import { GradeResolver } from './grade.resolver';

@Module({
  imports: [],
  providers: [GradeService, JwtService, GradeResolver],
  exports: [GradeService],
})
export class GradeModule {}
