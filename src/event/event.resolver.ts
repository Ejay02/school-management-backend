import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import { EventService } from './event.service';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/shared/auth/guards/jwtAuth.guard';
import { RolesGuard } from 'src/shared/auth/guards/roles.guard';
import { Roles } from 'src/shared/enum/role';
import { HasRoles } from 'src/shared/auth/decorators/roles.decorator';
import { CreateEventInput } from './input/create.event.input';
import { EventFilter } from './interface/event.filter';
import { EditEventInput } from './input/edit.event.input';
import { Event } from './types/event.types';
import { PaginationInput } from 'src/shared/pagination/input/pagination.input';

@Resolver()
@UseGuards(JwtAuthGuard, RolesGuard)
export class EventResolver {
  constructor(private readonly eventService: EventService) {}

  @Query(() => [Event])
  @HasRoles(
    Roles.ADMIN,
    Roles.TEACHER,
    Roles.PARENT,
    Roles.STUDENT,
    Roles.SUPER_ADMIN,
  )
  async getEvents(
    @Args('filter') filter: EventFilter,
    @Context() context,
    @Args('params', { nullable: true }) params?: PaginationInput,
  ) {
    const result = await this.eventService.getEvents(
      filter,
      context.req.user.userId,
      context.req.user.role,
      params || {},
    );
    return result.data;
  }

  @Query(() => Event)
  @HasRoles(
    Roles.ADMIN,
    Roles.TEACHER,
    Roles.PARENT,
    Roles.STUDENT,
    Roles.SUPER_ADMIN,
  )
  async getEventById(@Args('id') id: string, @Context() context) {
    return await this.eventService.getEventById(
      id,
      context.req.user.userId,
      context.req.user.role,
    );
  }

  @Mutation(() => Event)
  @HasRoles(
    Roles.ADMIN,
    Roles.TEACHER,
    Roles.PARENT,
    Roles.STUDENT,
    Roles.SUPER_ADMIN,
  )
  async createEvent(@Args('data') data: CreateEventInput, @Context() context) {
    return await this.eventService.createEvent(
      data,
      context.req.user.role,
      context.req.user.userId,
    );
  }

  @Mutation(() => Event)
  @HasRoles(
    Roles.ADMIN,
    Roles.TEACHER,
    Roles.PARENT,
    Roles.STUDENT,
    Roles.SUPER_ADMIN,
  )
  async updateEvent(
    @Args('eventId') eventId: string,
    @Args('input') input: EditEventInput,
    @Context() context,
  ) {
    return await this.eventService.updateEvent(
      eventId,
      input,
      context.req.user.userId,
    );
  }

  @Mutation(() => Event)
  @HasRoles(
    Roles.ADMIN,
    Roles.TEACHER,
    Roles.PARENT,
    Roles.STUDENT,
    Roles.SUPER_ADMIN,
  )
  async cancelEvent(
    @Args('id') id: string,
    @Args('reason') reason: string,
    @Context() context,
  ) {
    return await this.eventService.cancelEvent(
      id,
      reason,
      context.req.user.userId,
    );
  }

  @Mutation(() => Boolean)
  @HasRoles(
    Roles.ADMIN,
    Roles.TEACHER,
    Roles.PARENT,
    Roles.STUDENT,
    Roles.SUPER_ADMIN,
  )
  async deleteEvent(@Args('eventId') eventId: string, @Context() context) {
    return await this.eventService.deleteEvent(
      eventId,
      context.req.user.userId,
      context.req.user.role,
    );
  }

  @Mutation(() => Boolean)
  @HasRoles(
    Roles.ADMIN,
    Roles.PARENT,
    Roles.TEACHER,
    Roles.STUDENT,
    Roles.SUPER_ADMIN,
  )
  async markEventAsRead(@Args('eventId') eventId: string, @Context() context) {
    return await this.eventService.markEventAsRead(
      eventId,
      context.req.user.userId,
    );
  }
}
