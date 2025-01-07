import { Resolver } from '@nestjs/graphql';
import { ResultService } from './result.service';

@Resolver()
export class ResultResolver {
  constructor(private resultService: ResultService) {}
}
