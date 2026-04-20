import { Module } from '@nestjs/common';
import { ResultService } from './result.service';
import { ResultResolver } from './result.resolver';
import { AnnouncementModule } from 'src/announcement/announcement.module';
import { ClassModule } from 'src/class/class.module';

@Module({
  imports: [AnnouncementModule, ClassModule],
  providers: [ResultService, ResultResolver],
  exports: [ResultService],
})
export class ResultModule {}
