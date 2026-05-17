import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { getAuditRequestContext } from '../shared/audit/audit-context';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly pool: Pool;

  constructor() {
    const connectionString = process.env.DATABASE_URL ?? '';
    const pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);

    super({ adapter });
    this.pool = pool;

    const rawClient = this;

    const toSerializable = (value: any): any => {
      if (value === undefined) return null;
      if (value === null) return null;
      if (value instanceof Date) return value.toISOString();
      if (typeof value === 'bigint') return value.toString();
      if (Array.isArray(value)) return value.map((v) => toSerializable(v));
      if (typeof value === 'object') {
        const out: Record<string, any> = {};
        for (const [k, v] of Object.entries(value)) {
          out[k] = toSerializable(v);
        }
        return out;
      }
      return value;
    };

    const formatValue = (value: any): any => {
      const v = toSerializable(value);
      if (v === null) return null;
      if (typeof v === 'object') return JSON.stringify(v);
      return String(v);
    };

    const shouldIgnoreField = (field: string) => {
      const blocked = new Set([
        'password',
        'refreshToken',
        'resetToken',
        'otp',
        'otpCode',
        'token',
        'createdAt',
        'updatedAt',
      ]);
      return blocked.has(field);
    };

    const computeChanges = (before: any, after: any) => {
      const b = before || {};
      const a = after || {};
      const keys = new Set<string>([...Object.keys(b), ...Object.keys(a)]);
      const changes: Array<{ field: string; before: any; after: any }> = [];
      for (const key of keys) {
        if (shouldIgnoreField(key)) continue;
        const beforeVal = b[key];
        const afterVal = a[key];
        const beforeStr = JSON.stringify(toSerializable(beforeVal));
        const afterStr = JSON.stringify(toSerializable(afterVal));
        if (beforeStr !== afterStr) {
          changes.push({
            field: key,
            before: formatValue(beforeVal),
            after: formatValue(afterVal),
          });
        }
      }
      return changes;
    };

    const getEntityLabel = (record: any) => {
      if (!record) return null;
      const name = record?.name;
      const surname = record?.surname;
      const title = record?.title;
      const username = record?.username;
      const label =
        [name, surname].filter(Boolean).join(' ').trim() ||
        (typeof title === 'string' ? title : '') ||
        (typeof username === 'string' ? username : '');
      return label || null;
    };

    const auditableModels = new Set([
      'Admin',
      'Teacher',
      'Student',
      'Parent',
      'Class',
      'Subject',
      'Lesson',
      'Exam',
      'Assignment',
      'Invoice',
      'Payment',
      'FeeStructure',
      'Event',
      'Announcement',
      'SetupState',
      'Invitation',
    ]);

    const extended = rawClient.$extends({
      query: {
        $allModels: {
          $allOperations: async ({ model, operation, args, query }) => {
            if (!model) return query(args);
            const modelName: string = model as unknown as string;
            if (modelName === 'AuditLog' || modelName === 'SecurityLog') {
              return query(args);
            }
            if (!auditableModels.has(modelName)) return query(args);

            const op = String(operation || '').toLowerCase();
            const isWrite =
              op === 'create' || op === 'update' || op === 'delete';
            if (!isWrite) return query(args);

            const argsAny = args as any;
            const whereId = argsAny?.where?.id;
            const entityId = typeof whereId === 'string' ? whereId : undefined;

            const delegateName = `${modelName.charAt(0).toLowerCase()}${modelName.slice(1)}`;
            const delegate = (rawClient as any)[delegateName];

            let before: any = null;
            let after: any = null;

            if (
              (op === 'update' || op === 'delete') &&
              entityId &&
              delegate?.findUnique
            ) {
              before = await delegate.findUnique({ where: { id: entityId } });
            }

            const result = await query(args);

            if ((op === 'create' || op === 'update') && delegate?.findUnique) {
              const idToFetch =
                op === 'create'
                  ? (result as any)?.id || entityId
                  : entityId || (result as any)?.id;
              if (typeof idToFetch === 'string') {
                after = await delegate.findUnique({ where: { id: idToFetch } });
              } else {
                after = result;
              }
            }

            const changes = computeChanges(before, after);
            const ctx = getAuditRequestContext();
            const actor = ctx?.actor;
            const ipAddress = ctx?.ipAddress;

            await (rawClient as any).auditLog.create({
              data: {
                action: op.toUpperCase(),
                entityType: modelName,
                entityId: entityId || (after as any)?.id || null,
                entityLabel: getEntityLabel(after) || getEntityLabel(before),
                actorId: actor?.id || null,
                actorUsername: actor?.username || null,
                actorName: actor?.name || null,
                actorSurname: actor?.surname || null,
                actorEmail: actor?.email || null,
                actorRole: actor?.role || null,
                ipAddress: ipAddress || null,
                changes: changes.length ? (changes as any) : null,
                before: before ? (toSerializable(before) as any) : null,
                after: after ? (toSerializable(after) as any) : null,
              },
            });

            return result;
          },
        },
      },
    });

    (extended as any).onModuleInit = async () => {
      await extended.$connect();
    };

    (extended as any).onModuleDestroy = async () => {
      await extended.$disconnect();
      await pool.end();
    };

    return extended as any;
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
    await this.pool.end();
  }
}
