import { Args, Context, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AnnouncementService } from './announcement.service';
import { Announcement } from './types/announcement.types';
import { HasRoles } from 'src/shared/auth/decorators/roles.decorator';
import { UseGuards } from '@nestjs/common';
import { Roles } from 'src/shared/enum/role';
import { JwtAuthGuard } from 'src/shared/auth/guards/jwtAuth.guard';
import { RolesGuard } from 'src/shared/auth/guards/roles.guard';

import { AnnouncementQueryInput } from './types/announcement-query.input';

@Resolver()
@UseGuards(JwtAuthGuard, RolesGuard)
export class AnnouncementResolver {
  constructor(private readonly announcementService: AnnouncementService) {}

  @Mutation(() => Announcement)
  @HasRoles(Roles.ADMIN, Roles.TEACHER, Roles.SUPER_ADMIN)
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

    return await this.announcementService.createAnnouncement({
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
    Roles.SUPER_ADMIN,
    Roles.ADMIN,
    Roles.TEACHER,
    Roles.STUDENT,
    Roles.PARENT,
  )
  async getAllAnnouncements(
    @Context() context,
    @Args('params', { nullable: true }) params?: AnnouncementQueryInput,
  ) {
    const result = await this.announcementService.getAllAnnouncements(
      context.req.user.userId,
      context.req.user.role,
      params || {},
    );

    return result.data;
  }

  @Query(() => Announcement)
  @HasRoles(
    Roles.ADMIN,
    Roles.PARENT,
    Roles.TEACHER,
    Roles.STUDENT,
    Roles.SUPER_ADMIN,
  )
  async getAnnouncementById(
    @Args('announcementId') announcementId: string,
    @Context() context: any,
  ) {
    return await this.announcementService.getAnnouncementById(
      context.req.user.userId,
      context.req.user.role,
      announcementId,
    );
  }

  @Mutation(() => Announcement)
  @HasRoles(Roles.ADMIN, Roles.TEACHER, Roles.SUPER_ADMIN)
  async editAnnouncement(
    @Context() context,
    @Args('announcementId') announcementId: string,
    @Args('title') title: string,
    @Args('content') content: string,
    @Args('targetRoles', { type: () => [String], nullable: true })
    targetRoles?: Roles[],
  ) {
    return await this.announcementService.editAnnouncement(
      context.req.user.userId,
      context.req.user.role,
      announcementId,
      { title, content, targetRoles },
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
  async markAnnouncementAsRead(
    @Context() context,
    @Args('announcementId') announcementId: string,
  ) {
    return await this.announcementService.markAnnouncementAsRead(
      context.req.user.userId,
      context.req.user.role,
      announcementId,
    );
  }

  @Query(() => Int)
  @HasRoles(
    Roles.ADMIN,
    Roles.PARENT,
    Roles.TEACHER,
    Roles.STUDENT,
    Roles.SUPER_ADMIN,
  )
  async getUnreadAnnouncementsCount(@Context() context) {
    return await this.announcementService.getUnreadCount(
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
  async personalAnnouncementDelete(
    @Context() context,
    @Args('announcementId') announcementId: string,
  ) {
    return await this.announcementService.personalAnnouncementDelete(
      context.req.user.userId,
      announcementId,
    );
  }

  @Mutation(() => Boolean)
  @HasRoles(Roles.ADMIN, Roles.TEACHER, Roles.SUPER_ADMIN)
  async globalAnnouncementDelete(
    @Context() context,
    @Args('announcementId') announcementId: string,
  ) {
    return await this.announcementService.globalAnnouncementDelete(
      context.req.user.userId,
      context.req.user.role,
      announcementId,
    );
  }

  @Mutation(() => Boolean)
  @HasRoles(
    Roles.ADMIN,
    Roles.TEACHER,
    Roles.SUPER_ADMIN,
    Roles.STUDENT,
    Roles.PARENT,
  )
  async archiveAnnouncement(
    @Context() context,
    @Args('announcementId') announcementId: string,
  ) {
    return await this.announcementService.archiveAnnouncement(
      context.req.user.userId,
      context.req.user.role,
      announcementId,
    );
  }

  @Mutation(() => Boolean)
  @HasRoles(
    Roles.ADMIN,
    Roles.TEACHER,
    Roles.SUPER_ADMIN,
    Roles.STUDENT,
    Roles.PARENT,
  )
  async unarchiveAnnouncement(
    @Context() context,
    @Args('announcementId') announcementId: string,
  ) {
    return await this.announcementService.unarchiveAnnouncement(
      context.req.user.userId,
      context.req.user.role,
      announcementId,
    );
  }

  // Update getAllAnnouncements to accept archived parameter
}
