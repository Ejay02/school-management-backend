import { Resolver } from '@nestjs/graphql';
import { ExamService } from './exam.service';

@Resolver()
export class ExamResolver {
  constructor(private examService: ExamService) {}
}
