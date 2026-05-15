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

    const parsedByLogId = new Map<string, any>();
    const targetIdsNeedingEnrichment = new Set<string>();
    const performedByIdsNeedingEnrichment = new Set<string>();

    for (const item of items) {
      if (!item.details) continue;
      try {
        const parsed = JSON.parse(item.details);
        parsedByLogId.set(item.id, parsed);

        if (parsed?.targetId && !parsed?.target) {
          targetIdsNeedingEnrichment.add(String(parsed.targetId));
        }
        if (parsed?.performedById && !parsed?.performedBy) {
          performedByIdsNeedingEnrichment.add(String(parsed.performedById));
        }
      } catch {
        continue;
      }
    }

    const targetIds = Array.from(targetIdsNeedingEnrichment);
    const performedByIds = Array.from(performedByIdsNeedingEnrichment);

    const targetUserById = new Map<
      string,
      {
        id: string;
        role: any;
        name?: string | null;
        surname?: string | null;
        email?: string | null;
        username?: string | null;
      }
    >();

    if (targetIds.length) {
      const [teachers, students, parents, admins] = await Promise.all([
        this.prisma.teacher.findMany({
          where: { id: { in: targetIds } },
          select: {
            id: true,
            role: true,
            name: true,
            surname: true,
            email: true,
            institutionalEmail: true,
            username: true,
          },
        }),
        this.prisma.student.findMany({
          where: { id: { in: targetIds } },
          select: {
            id: true,
            role: true,
            name: true,
            surname: true,
            email: true,
            institutionalEmail: true,
            username: true,
          },
        }),
        this.prisma.parent.findMany({
          where: { id: { in: targetIds } },
          select: {
            id: true,
            role: true,
            name: true,
            surname: true,
            email: true,
            username: true,
          },
        }),
        this.prisma.admin.findMany({
          where: { id: { in: targetIds } },
          select: {
            id: true,
            role: true,
            name: true,
            surname: true,
            email: true,
            username: true,
          },
        }),
      ]);

      for (const user of [
        ...teachers,
        ...students,
        ...parents,
        ...admins,
      ] as any[]) {
        targetUserById.set(user.id, {
          id: user.id,
          role: user.role,
          name: user.name ?? null,
          surname: user.surname ?? null,
          email: (user.email ?? user.institutionalEmail ?? null) as any,
          username: user.username ?? null,
        });
      }
    }

    const performedByUserById = new Map<
      string,
      {
        id: string;
        role: any;
        name?: string | null;
        surname?: string | null;
        email?: string | null;
        username?: string | null;
      }
    >();

    if (performedByIds.length) {
      const admins = await this.prisma.admin.findMany({
        where: { id: { in: performedByIds } },
        select: {
          id: true,
          role: true,
          name: true,
          surname: true,
          email: true,
          username: true,
        },
      });
      for (const admin of admins) {
        performedByUserById.set(admin.id, {
          id: admin.id,
          role: admin.role,
          name: admin.name ?? null,
          surname: admin.surname ?? null,
          email: admin.email ?? null,
          username: admin.username ?? null,
        });
      }
    }

    const enrichedItems = items.map((item) => {
      const parsed = parsedByLogId.get(item.id);
      if (!parsed) return item;

      if (parsed?.targetId && !parsed?.target) {
        const target = targetUserById.get(String(parsed.targetId));
        if (target) parsed.target = target;
      }

      if (parsed?.performedById && !parsed?.performedBy) {
        const performedBy = performedByUserById.get(
          String(parsed.performedById),
        );
        if (performedBy) parsed.performedBy = performedBy;
      }

      return {
        ...item,
        details: JSON.stringify(parsed),
      };
    });

    const totalPages = Math.max(1, Math.ceil(totalCount / limit));
    const hasMore = page < totalPages;

    return {
      items: enrichedItems,
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
