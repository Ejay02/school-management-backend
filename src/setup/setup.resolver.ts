import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/shared/auth/guards/jwtAuth.guard';
import { RolesGuard } from 'src/shared/auth/guards/roles.guard';
import { HasRoles } from 'src/shared/auth/decorators/roles.decorator';
import { Roles } from 'src/shared/enum/role';
import { SetupService } from './setup.service';
import { UpdateSetupStateInput } from './input/update.setup-state.input';
import {
  OnboardingChecklist,
  SetupProgress,
  SetupState,
} from './types/setup.types';

@Resolver()
@UseGuards(JwtAuthGuard, RolesGuard)
export class SetupResolver {
  constructor(private readonly setupService: SetupService) {}

  @Query(() => SetupState)
  @HasRoles(Roles.ADMIN, Roles.SUPER_ADMIN)
  async getSetupState() {
    return this.setupService.getSetupState();
  }

  @Query(() => SetupProgress, {
    description:
      'Returns a derived setup progress summary based on current database state (no manual flags).',
  })
  @HasRoles(Roles.ADMIN, Roles.SUPER_ADMIN)
  async getSetupProgress() {
    return this.setupService.getSetupProgress();
  }

  @Query(() => OnboardingChecklist, {
    description:
      'Returns a structured onboarding checklist derived from real backend state (classes, subjects/teacher links, and invitations) for rendering onboarding cards.',
  })
  @HasRoles(Roles.ADMIN, Roles.SUPER_ADMIN)
  async getOnboardingChecklist() {
    return this.setupService.getOnboardingChecklist();
  }

  @Mutation(() => SetupState)
  @HasRoles(Roles.ADMIN, Roles.SUPER_ADMIN)
  async updateSetupState(@Args('input') input: UpdateSetupStateInput) {
    return this.setupService.updateSetupState(input);
  }
}
