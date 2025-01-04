import { Module } from '@nestjs/common';
import { SubjectResolver } from './subject.resolver';
import { SubjectService } from './subject.service';

@Module({
  imports: [],
  providers: [
    SubjectService,
    // JwtService,
    SubjectResolver,
  ],
  exports: [SubjectService],
})
export class SubjectModule {}
