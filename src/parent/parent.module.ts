import { Module } from '@nestjs/common';
import { ParentService } from './parent.service';
import { JwtService } from '@nestjs/jwt';
import { ParentResolver } from './parent.resolver';

@Module({
  imports: [],
  providers: [ParentService, JwtService, ParentResolver],
  exports: [ParentService],
})
export class ParentModule {}
