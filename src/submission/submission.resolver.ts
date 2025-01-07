import { Resolver } from '@nestjs/graphql';
import { SubmissionService } from './submission.service';

@Resolver()
export class SubmissionResolver {
  constructor(private submissionService: SubmissionService) {}
}
