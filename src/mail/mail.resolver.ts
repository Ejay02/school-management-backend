import { UseGuards } from '@nestjs/common';
import { Resolver } from '@nestjs/graphql';
import { JwtAuthGuard } from 'src/shared/auth/guards/jwtAuth.guard';
import { RolesGuard } from 'src/shared/auth/guards/roles.guard';
import { MailService } from './mail.service';

@Resolver()
@UseGuards(JwtAuthGuard, RolesGuard)
export class MailResolver {
  constructor(private mailService: MailService) {}
}
