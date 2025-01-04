import { Module } from '@nestjs/common';
import { TeacherService } from './teacher.service';
import { TeacherResolver } from './teacher.resolver';
import { JwtService } from '@nestjs/jwt';

@Module({
  imports: [],
  providers: [TeacherService, JwtService, TeacherResolver],
  exports: [TeacherService],
})
export class TeacherModule {}
