import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SecurityService {
  private readonly logger = new Logger(SecurityService.name);
  private readonly blockedIPs: Set<string> = new Set();

  constructor(private readonly prisma: PrismaService) {}

  async logFailedLoginAttempt(username: string, ip: string) {
    try {
      // Log the failed attempt
      await this.prisma.securityLog.create({
        data: {
          action: 'FAILED_LOGIN',
          username,
          ipAddress: ip,
          timestamp: new Date(),
        },
      });

      // Check for brute force attempts
      const recentAttempts = await this.prisma.securityLog.count({
        where: {
          action: 'FAILED_LOGIN',
          ipAddress: ip,
          timestamp: {
            gte: new Date(Date.now() - 15 * 60 * 1000), // Last 15 minutes
          },
        },
      });

      // If more than 5 failed attempts in 15 minutes, block the IP
      if (recentAttempts > 5) {
        this.blockedIPs.add(ip);
        this.logger.warn(
          `Blocked IP ${ip} due to multiple failed login attempts`,
        );

        // Log the block
        await this.prisma.securityLog.create({
          data: {
            action: 'IP_BLOCKED',
            ipAddress: ip,
            timestamp: new Date(),
          },
        });
      }
    } catch (error) {
      this.logger.error(`Error logging security event: ${error.message}`);
    }
  }

  isIPBlocked(ip: string): boolean {
    return this.blockedIPs.has(ip);
  }
}
