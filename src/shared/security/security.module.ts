import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { SecurityService } from './security.service';
import { CustomThrottlerGuard } from './custom-throttler.guard';
import { SecurityResolver } from './security.resolver';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60,
        limit: 10,
      },
    ]),
  ],
  providers: [
    SecurityService,
    SecurityResolver,
    {
      provide: APP_GUARD,
      useClass: CustomThrottlerGuard,
    },
  ],
  exports: [SecurityService],
})
export class SecurityModule {}
