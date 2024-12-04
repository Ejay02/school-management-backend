import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';

import { Strategy, ExtractJwt } from 'passport-jwt';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: 'wmen34m3554m6mrgFB>b.,g,g',
    });
  }
  // secretOrKey: process.env.JWT_SECRET,

  async validate(payload: any) {
    try {
      const admin = await this.prisma.admin.findUnique({
        where: { id: payload.sub },
      });

      if (!admin) {
        throw new UnauthorizedException();
      }

      return {
        userId: payload.sub,
        role: payload.role,
      };
    } catch (error) {
      console.log('jwt error:', error);
    }
  }
}
