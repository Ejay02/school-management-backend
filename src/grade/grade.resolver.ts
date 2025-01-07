import { Resolver } from '@nestjs/graphql';
import { GradeService } from './grade.service';

@Resolver()
export class GradeResolver {
  constructor(private gradeService: GradeService) {}
}
