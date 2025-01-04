import { Resolver } from '@nestjs/graphql';
import { LessonService } from './lesson.service';

@Resolver()
export class LessonResolver {
  constructor(private lessonService: LessonService) {}
}
