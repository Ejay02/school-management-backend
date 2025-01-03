import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtModule } from '@nestjs/jwt';
import { AuthResolver } from './auth.resolver';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from '../jwt/jwt.strategy';
import { PrismaService } from 'src/prisma/prisma.service';
import { ClassService } from 'src/class/class.service';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt', property: 'user' }),
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: process.env.JWT_SECRET,
        signOptions: {
          expiresIn: '15m',
        },
      }),
    }),
  ],

  providers: [
    AuthService,
    AuthResolver,
    JwtStrategy,
    PrismaService,
    ClassService,
  ],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
