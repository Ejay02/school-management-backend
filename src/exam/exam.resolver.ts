import { Resolver } from '@nestjs/graphql';
import { ExamService } from './exam.service';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/shared/auth/guards/jwtAuth.guard';
import { RolesGuard } from 'src/shared/auth/guards/roles.guard';

@Resolver()
@UseGuards(JwtAuthGuard, RolesGuard)
export class ExamResolver {
  constructor(private examService: ExamService) {}
}
