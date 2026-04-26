import { Module } from '@nestjs/common';
import { SetupService } from './setup.service';
import { SetupResolver } from './setup.resolver';

@Module({
  providers: [SetupService, SetupResolver],
  exports: [SetupService],
})
export class SetupModule {}
