import { Module } from '@nestjs/common';
import { ClassService } from './class.service';
import { JwtService } from '@nestjs/jwt';
import { ClassResolver } from './class.resolver';

@Module({
  imports: [],
  providers: [ClassService, JwtService, ClassResolver],
  exports: [ClassService],
})
export class ClassModule {}
