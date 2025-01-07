import { Resolver } from '@nestjs/graphql';
import { EventService } from './event.service';

@Resolver()
export class EventResolver {
  constructor(private eventService: EventService) {}
}
