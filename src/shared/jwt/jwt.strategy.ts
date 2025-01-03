import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { PassportStrategy } from '@nestjs/passport';

import { Strategy, ExtractJwt } from 'passport-jwt';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuthService } from '../auth/auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private prisma: PrismaService,
    private authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET,
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: any) {
    try {
      const admin = await this.prisma.admin.findUnique({
        where: { id: payload.sub },
      });

      if (!admin) {
        throw new UnauthorizedException('Unauthorized access');
      }

      // Check if token is about to expire (e.g., less than 2 minutes remaining)
      const tokenExp = payload.exp * 1000; // Convert to milliseconds
      const now = Date.now();
      const twoMinutes = 2 * 60 * 1000;

      if (tokenExp - now < twoMinutes) {
        // Get refresh token from request headers
        const refreshToken = req.headers['x-refresh-token'] as string;

        if (refreshToken) {
          // Get new tokens
          const newTokens = await this.authService.refreshTokens(refreshToken);

          // Add new tokens to response headers
          req.res.setHeader('x-new-access-token', newTokens.accessToken);
          req.res.setHeader('x-new-refresh-token', newTokens.refreshToken);
        }
      }

      return {
        userId: payload.sub,
        role: payload.role,
      };
    } catch (error) {
      throw new Error(`jwt error: ${error.message}`);
    }
  }
}
