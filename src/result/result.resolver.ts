import { Resolver } from '@nestjs/graphql';
import { ResultService } from './result.service';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/shared/auth/guards/jwtAuth.guard';
import { RolesGuard } from 'src/shared/auth/guards/roles.guard';

@Resolver()
@UseGuards(JwtAuthGuard, RolesGuard)
export class ResultResolver {
  constructor(private resultService: ResultService) {}
}
