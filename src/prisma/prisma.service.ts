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
      'Attendance',
      'Exam',
      'Assignment',
      'Result',
      'Invoice',
      'Payment',
      'FeeStructure',
      'Event',
      'Announcement',
      'ChatConversation',
      'ChatConversationMember',
      'ChatMessage',
      'SetupState',
      'Invitation',
    ]);

    const extended = this.$extends({
      query: {
        $allModels: {
          $allOperations: async ({ model, operation, args, query }) => {
            if (!model) return query(args);
            const modelName: string = model as unknown as string;
            const op = String(operation || '').toLowerCase();

            if (modelName === 'AuditLog') {
              const forbidden = new Set([
                'update',
                'delete',
                'upsert',
                'updatemany',
                'deletemany',
              ]);
              if (forbidden.has(op)) {
                throw new Error('AuditLog is immutable and append-only');
              }
              return query(args);
            }

            if (modelName === 'SecurityLog') {
              return query(args);
            }
            if (!auditableModels.has(modelName)) return query(args);

            const isWrite =
              op === 'create' ||
              op === 'update' ||
              op === 'delete' ||
              op === 'upsert';
            if (!isWrite) return query(args);

            const argsAny = args as any;
            const where = argsAny?.where;
            const whereId = where?.id;
            const entityId = typeof whereId === 'string' ? whereId : undefined;

            const delegateName = `${modelName.charAt(0).toLowerCase()}${modelName.slice(1)}`;
            const delegate = (extended as any)[delegateName];

            let before: any = null;
            let after: any = null;

            if (
              (op === 'update' || op === 'delete' || op === 'upsert') &&
              where &&
              delegate?.findUnique
            ) {
              before = await delegate.findUnique({ where }).catch(() => null);
            }

            const result = await query(args);

            if (
              (op === 'create' || op === 'update' || op === 'upsert') &&
              delegate?.findUnique
            ) {
              const idToFetch =
                op === 'create'
                  ? (result as any)?.id || entityId
                  : entityId || (result as any)?.id;
              if (typeof idToFetch === 'string') {
                after = await delegate.findUnique({ where: { id: idToFetch } });
              } else if (where) {
                after = await delegate
                  .findUnique({ where })
                  .catch(() => result);
              } else {
                after = result;
              }
            }

            const changes = computeChanges(before, after);
            if (!changes.length) {
              return result;
            }

            if (modelName === 'Attendance') {
              const isEdit = (op === 'update' || op === 'upsert') && !!before;
              if (!isEdit) {
                return result;
              }
            }

            const ctx = getAuditRequestContext();
            const actor = ctx?.actor;
            const ipAddress = ctx?.ipAddress;

            const auditDelegate = (extended as any).auditLog;
            if (auditDelegate?.create) {
              const action =
                op === 'upsert'
                  ? before
                    ? 'UPDATE'
                    : 'CREATE'
                  : op.toUpperCase();
              await auditDelegate
                .create({
                  data: {
                    action,
                    entityType: modelName,
                    entityId: entityId || (after as any)?.id || null,
                    entityLabel:
                      getEntityLabel(after) || getEntityLabel(before),
                    actorId: actor?.id || null,
                    actorUsername: actor?.username || null,
                    actorName: actor?.name || null,
                    actorSurname: actor?.surname || null,
                    actorEmail: actor?.email || null,
                    actorRole: actor?.role || null,
                    ipAddress: ipAddress || null,
                    changes: changes.length ? changes : null,
                    before: before ? toSerializable(before) : null,
                    after: after ? toSerializable(after) : null,
                  },
                })
                .catch(() => undefined);
            }

            return result;
          },
        },
      },
    });
    const reservedClientKeys = new Set([
      'pool',
      'constructor',
      '__proto__',
      'prototype',
    ]);
    for (const key of Reflect.ownKeys(extended as any)) {
      if (typeof key === 'string' && reservedClientKeys.has(key)) continue;
      if (
        typeof key === 'string' &&
        !key.startsWith('$') &&
        !key.startsWith('_')
      ) {
        continue;
      }
      const descriptor = Object.getOwnPropertyDescriptor(extended as any, key);
      if (descriptor) {
        Object.defineProperty(this as any, key, descriptor);
      }
    }
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
    await this.pool.end();
  }
}
