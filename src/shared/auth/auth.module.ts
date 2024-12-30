import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { AuthResolver } from './auth.resolver';

@Module({
  imports: [],
  providers: [AuthService, JwtService, AuthResolver],
  exports: [AuthService],
})
export class AuthModule {}
