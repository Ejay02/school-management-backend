import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AnnouncementService } from './announcement.service';
import { Announcement } from './types/announcement.types';
import { HasRoles } from 'src/shared/auth/decorators/roles.decorator';
import { UseGuards } from '@nestjs/common';
import { Roles } from 'src/shared/enum/role';
import { JwtAuthGuard } from 'src/shared/auth/guards/jwtAuth.guard';
import { RolesGuard } from 'src/shared/auth/guards/roles.guard';

@Resolver()
export class AnnouncementResolver {
  constructor(private announcementService: AnnouncementService) {}

  @Mutation(() => Announcement)
  @HasRoles(Roles.ADMIN, Roles.TEACHER, Roles.SUPER_ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async createAnnouncement(
    @Args('title') title: string,
    @Args('content') content: string,
    @Context() context,
    @Args('classId', { nullable: true }) classId?: string,
    @Args('targetRoles', { type: () => [String], nullable: true })
    targetRoles?: Roles[],
  ) {
    const creatorId = context.req.user.userId;
    const creatorRole = context.req.user.role;

    return this.announcementService.createAnnouncement({
      title,
      content,
      creatorId,
      creatorRole,
      classId,
      targetRoles,
    });
  }

  @Query(() => [Announcement])
  @HasRoles(
    Roles.ADMIN,
    Roles.PARENT,
    Roles.TEACHER,
    Roles.STUDENT,
    Roles.SUPER_ADMIN,
  )
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getAllAnnouncements(@Context() context) {
    return this.announcementService.getAllAnnouncements(
      context.req.user.userId,
      context.req.user.role,
    );
  }
}
