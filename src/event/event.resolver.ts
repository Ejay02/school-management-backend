import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import { EventService } from './event.service';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/shared/auth/guards/jwtAuth.guard';
import { RolesGuard } from 'src/shared/auth/guards/roles.guard';
import { Roles } from 'src/shared/enum/role';
import { HasRoles } from 'src/shared/auth/decorators/roles.decorator';
import { CreateEventInput } from './input/create.event.input';

@Resolver()
@UseGuards(JwtAuthGuard, RolesGuard)
export class EventResolver {
  constructor(private eventService: EventService) {}

  @Query()
  async getEvents(@Args('filter') filter: any, @Context() context) {
    const { userId, role } = context.req.user;
    return this.eventService.getEvents(filter, userId, role);
  }

  // @Query()
  // async event(@Args('id') id: string) {
  //   return this.eventService.getEvent(id);
  // }

  @Mutation()
  @HasRoles(Roles.ADMIN, Roles.SUPER_ADMIN)
  @UseGuards(RolesGuard)
  async createEvent(@Args('data') data: CreateEventInput, @Context() context) {
    return this.eventService.createEvent(
      data,
      context.req.user.role,
      context.req.user.userId,
    );
  }

  @Mutation()
  @HasRoles(Roles.ADMIN, Roles.SUPER_ADMIN)
  @UseGuards(RolesGuard)
  async updateEvent(@Args('input') input: any, @Context() context) {
    return this.eventService.updateEvent(input.id, input, context.req.user.id);
  }

  @Mutation()
  @HasRoles(Roles.ADMIN, Roles.SUPER_ADMIN)
  @UseGuards(RolesGuard)
  async cancelEvent(
    @Args('id') id: string,
    @Args('reason') reason: string,
    @Context() context,
  ) {
    return this.eventService.cancelEvent(id, reason, context.req.user.id);
  }
}
