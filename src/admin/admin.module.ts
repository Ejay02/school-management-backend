import { Module } from '@nestjs/common';
import { AdminResolver } from './admin.resolver';
import { AdminService } from './admin.service';
import { JwtService } from '@nestjs/jwt';

@Module({
  imports: [],
  providers: [AdminService, JwtService, AdminResolver],
  exports: [AdminService],
})
export class AdminModule {}
