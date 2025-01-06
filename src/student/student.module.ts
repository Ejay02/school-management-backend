import { Module } from '@nestjs/common';
import { StudentService } from './student.servcie';
import { JwtService } from '@nestjs/jwt';
import { StudentResolver } from './student.resolver';

@Module({
  imports: [],
  providers: [StudentService, JwtService, StudentResolver],
  exports: [StudentService],
})
export class StudentModule {}
