import { Resolver } from '@nestjs/graphql';
import { ClassService } from './class.service';

@Resolver()
export class ClassResolver {
  constructor(private classService: ClassService) {}
}
