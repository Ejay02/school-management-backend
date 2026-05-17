import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Observable, defer } from 'rxjs';
import { auditContext, type AuditRequestContext } from './audit-context';

@Injectable()
export class AuditContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const type = context.getType<'http' | 'graphql' | 'ws'>();

    if (type !== 'http' && type !== 'graphql') {
      return next.handle();
    }

    const req =
      type === 'graphql'
        ? GqlExecutionContext.create(context).getContext().req
        : context.switchToHttp().getRequest();

    const user = req?.user;
    const ipAddress =
      (req?.headers?.['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ||
      req?.ip ||
      req?.socket?.remoteAddress ||
      undefined;

    const store: AuditRequestContext = {
      ipAddress,
      actor: user
        ? {
            id: user.id,
            username: user.username,
            name: user.name,
            surname: user.surname,
            email: user.email || user.institutionalEmail,
            role: user.role,
          }
        : undefined,
    };

    return auditContext.run(store, () => defer(() => next.handle()));
  }
}

