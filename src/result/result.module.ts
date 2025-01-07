import { Module } from '@nestjs/common';
import { ResultService } from './result.service';
import { ResultResolver } from './result.resolver';
import { JwtService } from '@nestjs/jwt';

@Module({
  imports: [],
  providers: [ResultService, JwtService, ResultResolver],
  exports: [ResultService],
})
export class ResultModule {}
