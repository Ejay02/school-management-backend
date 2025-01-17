import { Module } from '@nestjs/common';
import { LessonService } from './lesson.service';
import { LessonResolver } from './lesson.resolver';
import { JwtService } from '@nestjs/jwt';

@Module({
  imports: [],
  providers: [LessonService, JwtService, LessonResolver],
  exports: [LessonService],
})
export class LessonModule {}
