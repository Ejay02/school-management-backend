import { AsyncLocalStorage } from 'node:async_hooks';

export type AuditActor = {
  id?: string;
  username?: string;
  name?: string;
  surname?: string;
  email?: string;
  role?: string;
};

export type AuditRequestContext = {
  actor?: AuditActor;
  ipAddress?: string;
};

export const auditContext = new AsyncLocalStorage<AuditRequestContext>();

export const getAuditRequestContext = (): AuditRequestContext | undefined =>
  auditContext.getStore();

