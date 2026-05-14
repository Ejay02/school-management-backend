import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PaginationInput } from '../pagination/input/pagination.input';

@Injectable()
export class SecurityService {
  private readonly logger = new Logger(SecurityService.name);
  private readonly blockedIPs: Set<string> = new Set();

  constructor(private readonly prisma: PrismaService) {}

  private readonly signupAttempts: Map<
    string,
    { count: number; timestamp: Date }
  > = new Map();
  private readonly MAX_SIGNUPS_PER_DAY = 10; // Define what "mass" means - 10 accounts per day

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

  trackSignupAttempt(ipAddress: string): boolean {
    if (!ipAddress) return true; // If no IP provided, allow the signup

    const now = new Date();
    const existingRecord = this.signupAttempts.get(ipAddress);

    if (!existingRecord) {
      // First signup from this IP
      this.signupAttempts.set(ipAddress, { count: 1, timestamp: now });
      return true;
    }

    // Check if we should reset the counter (new day)
    const oneDayAgo = new Date(now);
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    if (existingRecord.timestamp < oneDayAgo) {
      // Reset counter if more than a day has passed
      this.signupAttempts.set(ipAddress, { count: 1, timestamp: now });
      return true;
    }

    // Increment counter and check if limit exceeded
    const newCount = existingRecord.count + 1;
    this.signupAttempts.set(ipAddress, {
      count: newCount,
      timestamp: existingRecord.timestamp,
    });

    return newCount <= this.MAX_SIGNUPS_PER_DAY;
  }

  hasReachedSignupLimit(ipAddress: string): boolean {
    if (!ipAddress) return false;

    const record = this.signupAttempts.get(ipAddress);
    if (!record) return false;

    // Check if we should reset the counter (new day)
    const now = new Date();
    const oneDayAgo = new Date(now);
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    if (record.timestamp < oneDayAgo) {
      // Reset counter if more than a day has passed
      this.signupAttempts.set(ipAddress, { count: 0, timestamp: now });
      return false;
    }

    return record.count >= this.MAX_SIGNUPS_PER_DAY;
  }

  async getSecurityLogs(
    params: PaginationInput,
    filters: { action?: string; username?: string; ipAddress?: string } = {},
  ) {
    const page = Math.max(1, Number(params?.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(params?.limit ?? 20)));
    const skip = (page - 1) * limit;

    const search = String(params?.search ?? '').trim();
    const action = String(filters.action ?? '').trim();
    const username = String(filters.username ?? '').trim();
    const ipAddress = String(filters.ipAddress ?? '').trim();

    const where: any = {};

    if (action) {
      where.action = { contains: action, mode: 'insensitive' };
    }
    if (username) {
      where.username = { contains: username, mode: 'insensitive' };
    }
    if (ipAddress) {
      where.ipAddress = { contains: ipAddress, mode: 'insensitive' };
    }

    if (search) {
      where.OR = [
        { action: { contains: search, mode: 'insensitive' } },
        { username: { contains: search, mode: 'insensitive' } },
        { ipAddress: { contains: search, mode: 'insensitive' } },
        { details: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, totalCount] = await Promise.all([
      this.prisma.securityLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.securityLog.count({ where }),
    ]);

    const totalPages = Math.max(1, Math.ceil(totalCount / limit));
    const hasMore = page < totalPages;

    return {
      items,
      pageInfo: {
        page,
        limit,
        totalCount,
        totalPages,
        hasMore,
      },
    };
  }
}
