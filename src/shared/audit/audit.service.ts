import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PaginationInput } from '../pagination/input/pagination.input';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async getAuditLogs(
    params: PaginationInput,
    filters: {
      entityType?: string;
      actor?: string;
      startDate?: Date;
      endDate?: Date;
    } = {},
  ) {
    const page = Math.max(1, Number(params?.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(params?.limit ?? 20)));
    const skip = (page - 1) * limit;

    const search = String(params?.search ?? '').trim();
    const entityType = String(filters.entityType ?? '').trim();
    const actor = String(filters.actor ?? '').trim();
    const startDate = filters.startDate;
    const endDate = filters.endDate;

    const where: any = {};

    if (entityType) {
      where.entityType = entityType;
    }

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = startDate;
      if (endDate) where.timestamp.lte = endDate;
    }

    if (actor) {
      where.OR = [
        { actorName: { contains: actor, mode: 'insensitive' } },
        { actorSurname: { contains: actor, mode: 'insensitive' } },
        { actorUsername: { contains: actor, mode: 'insensitive' } },
        { actorEmail: { contains: actor, mode: 'insensitive' } },
      ];
    }

    if (search) {
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { action: { contains: search, mode: 'insensitive' } },
            { entityType: { contains: search, mode: 'insensitive' } },
            { entityId: { contains: search, mode: 'insensitive' } },
            { entityLabel: { contains: search, mode: 'insensitive' } },
            { actorName: { contains: search, mode: 'insensitive' } },
            { actorSurname: { contains: search, mode: 'insensitive' } },
            { actorUsername: { contains: search, mode: 'insensitive' } },
            { actorEmail: { contains: search, mode: 'insensitive' } },
          ],
        },
      ];
    }

    const [items, totalCount] = await Promise.all([
      (this.prisma as any).auditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip,
        take: limit,
      }),
      (this.prisma as any).auditLog.count({ where }),
    ]);

    const mappedItems = (items as any[]).map((item) => ({
      ...item,
      changes: Array.isArray(item.changes) ? item.changes : null,
    }));

    const totalPages = Math.max(1, Math.ceil(totalCount / limit));
    const hasMore = page < totalPages;

    return {
      items: mappedItems,
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
