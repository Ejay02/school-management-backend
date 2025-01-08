import { Resolver } from '@nestjs/graphql';
import { EventService } from './event.service';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/shared/auth/guards/jwtAuth.guard';
import { RolesGuard } from 'src/shared/auth/guards/roles.guard';

@Resolver()
@UseGuards(JwtAuthGuard, RolesGuard)
export class EventResolver {
  constructor(private eventService: EventService) {}
}
