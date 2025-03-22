import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Skip throttling for WebSocket connections
    if (context.getType() === 'ws') {
      return true;
    }

    // Skip throttling for GraphQL playground and operations
    const req = context.switchToHttp().getRequest();

    // Check if request exists before trying to access properties using optional chaining
    if (!req?.ip) {
      // If there's no request object or IP, skip throttling
      return true;
    }

    if (req?.url?.includes('/graphql')) {
      return true;
    }

    // Also check if it's a GraphQL context
    if (context.getType() === 'http') {
      const request = context.switchToHttp().getRequest();
      if (request?.path?.includes('/graphql')) {
        return true;
      }
    }

    try {
      // For other HTTP requests, use the parent implementation
      return await super.canActivate(context);
    } catch (error) {
      // If there's an error with the throttler, log it and allow the request
      console.error('Throttler error:', error.message);
      return true;
    }
  }
}
