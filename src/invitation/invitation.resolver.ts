import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/shared/auth/guards/jwtAuth.guard';
import { RolesGuard } from 'src/shared/auth/guards/roles.guard';
import { HasRoles } from 'src/shared/auth/decorators/roles.decorator';
import { Roles } from 'src/shared/enum/role';
import { InvitationService } from './invitation.service';
import { CreateInvitationInput } from './input/create.invitation.input';
import { Invitation, InvitationPreview } from './types/invitation.types';
import { InviteStatus } from './enum/inviteStatus';
import { AcceptInvitationInput } from './input/accept.invitation.input';
import { AuthResponse } from 'src/shared/auth/response/auth.response';

@Resolver()
export class InvitationResolver {
  constructor(private readonly invitationService: InvitationService) {}

  @Mutation(() => Invitation)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @HasRoles(Roles.ADMIN, Roles.SUPER_ADMIN)
  async createInvitation(
    @Context() context: any,
    @Args('input') input: CreateInvitationInput,
  ) {
    const invitedByUserId = context.req.user.userId;
    return this.invitationService.createInvitation(
      invitedByUserId,
      input.email,
      input.role,
    );
  }

  @Mutation(() => Invitation)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @HasRoles(Roles.ADMIN, Roles.SUPER_ADMIN)
  async resendInvitation(@Context() context: any, @Args('id') id: string) {
    const invitedByUserId = context.req.user.userId;
    return this.invitationService.resendInvitation(invitedByUserId, id);
  }

  @Mutation(() => Invitation)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @HasRoles(Roles.ADMIN, Roles.SUPER_ADMIN)
  async revokeInvitation(@Args('id') id: string) {
    return this.invitationService.revokeInvitation(id);
  }

  @Query(() => [Invitation])
  @UseGuards(JwtAuthGuard, RolesGuard)
  @HasRoles(Roles.ADMIN, Roles.SUPER_ADMIN)
  async invitations(
    @Args('status', { nullable: true, type: () => InviteStatus })
    status?: InviteStatus,
  ) {
    return this.invitationService.listInvitations(status);
  }

  @Query(() => InvitationPreview)
  async validateInvitationToken(@Args('token') token: string) {
    const invite = await this.invitationService.validateInvitationToken(token);
    return {
      email: invite.email,
      role: invite.role as any,
      status: invite.status as any,
      expiresAt: invite.expiresAt,
    };
  }

  @Mutation(() => AuthResponse)
  async acceptInvitation(
    @Args('input') input: AcceptInvitationInput,
    @Context() context?: any,
  ) {
    const ipAddress =
      context?.req?.ip || context?.req?.connection?.remoteAddress;
    return this.invitationService.acceptInvitation({
      ...input,
      ipAddress,
    });
  }
}
