import { Resolver } from '@nestjs/graphql';
import { GradeService } from './grade.service';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/shared/auth/guards/jwtAuth.guard';
import { RolesGuard } from 'src/shared/auth/guards/roles.guard';

@Resolver()
@UseGuards(JwtAuthGuard, RolesGuard)
export class GradeResolver {
  constructor(private gradeService: GradeService) {}
}
