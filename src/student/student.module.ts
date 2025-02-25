import { Module } from '@nestjs/common';
import { StudentService } from './student.service';
import { JwtService } from '@nestjs/jwt';
import { StudentResolver } from './student.resolver';

@Module({
  imports: [],
  providers: [StudentService, JwtService, StudentResolver],
  exports: [StudentService],
})
export class StudentModule {}
