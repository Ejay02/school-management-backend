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
      // Check user exists across all user types
      const userPromises = [
        this.prisma.admin.findUnique({ where: { id: payload.sub } }),
        this.prisma.teacher.findUnique({ where: { id: payload.sub } }),
        this.prisma.student.findUnique({ where: { id: payload.sub } }),
        this.prisma.parent.findUnique({ where: { id: payload.sub } }),
      ];

      const users = await Promise.all(userPromises);
      const user = users.find((u) => u !== null);

      if (!user) {
        throw new UnauthorizedException('Unauthorized access');
      }

      // Check if token is about to expire
      const tokenExp = payload.exp * 1000; // Convert to milliseconds
      const now = Date.now();
      const fiveMinutes = 5 * 60 * 1000;

      if (tokenExp - now < fiveMinutes) {
        // Get refresh token from request headers
        const refreshToken = req.headers['x-refresh-token'] as string;

        if (refreshToken) {
          // Get new tokens
          const newTokens = await this.authService.refreshTokens(refreshToken);

          // Add new tokens to response headers
          if (req.res) {
            req.res.setHeader('x-new-access-token', newTokens.accessToken);
            req.res.setHeader('x-new-refresh-token', newTokens.refreshToken);
          }
        }
      }

      return {
        userId: payload.sub,
        role: payload.role,
      };
    } catch (error) {
      throw new Error(`Authentication failed:: ${error.message}`);
    }
  }
}
