import { Resolver, Mutation, Args, Context, Query } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthResponse } from './response/auth.response';
import { BaseLoginInput } from './input/login.input';
import {
  AdminSignupInput,
  TeacherSignupInput,
  StudentSignupInput,
  ParentSignupInput,
} from './input/signup.input';
import { TokenResponse } from './response/token.response';
import { ResetPasswordInput } from './input/reset.password.input';
import GraphQLJSON from 'graphql-type-json';
import { JwtAuthGuard } from './guards/jwtAuth.guard';
import { RolesGuard } from './guards/roles.guard';
import { HasRoles } from './decorators/roles.decorator';
import { Roles } from '../enum/role';

@Resolver()
export class AuthResolver {
  constructor(private readonly authService: AuthService) {}

  @Query(() => GraphQLJSON)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @HasRoles(Roles.ADMIN, Roles.SUPER_ADMIN)
  async welcomeEmailPreview(
    @Args('role', { type: () => Roles }) role: Roles,
    @Args('name', { nullable: true }) name?: string,
  ) {
    return this.authService.welcomeEmailPreview({ role, name });
  }

  @Mutation(() => AuthResponse)
  async adminSignup(
    @Args('input') input: AdminSignupInput,
    @Context() context?: any,
  ): Promise<AuthResponse> {
    const ipAddress =
      context?.req?.ip || context?.req?.connection?.remoteAddress;
    return await this.authService.signup(input, ipAddress);
  }

  @Mutation(() => AuthResponse)
  async teacherSignup(
    @Args('input') input: TeacherSignupInput,
    @Context() context?: any,
  ): Promise<AuthResponse> {
    const ipAddress =
      context?.req?.ip || context?.req?.connection?.remoteAddress;
    return await this.authService.signup(input, ipAddress);
  }

  @Mutation(() => AuthResponse)
  async studentSignup(
    @Args('input') input: StudentSignupInput,
    @Context() context?: any,
  ): Promise<AuthResponse> {
    const ipAddress =
      context?.req?.ip || context?.req?.connection?.remoteAddress;
    return await this.authService.signup(input, ipAddress);
  }

  @Mutation(() => AuthResponse)
  async parentSignup(
    @Args('input') input: ParentSignupInput,
    @Context() context?: any,
  ): Promise<AuthResponse> {
    const ipAddress =
      context?.req?.ip || context?.req?.connection?.remoteAddress;
    return await this.authService.signup(input, ipAddress);
  }

  @Mutation(() => AuthResponse)
  async login(
    @Args('input') input: BaseLoginInput,
    @Context() context?: any,
  ): Promise<AuthResponse> {
    // If context exists and has request info, extract IP
    const ipAddress =
      context?.req?.ip || context?.req?.connection?.remoteAddress;

    // Pass IP if available, otherwise just pass the input
    return await this.authService.login(input, ipAddress);
  }

  @Mutation(() => TokenResponse)
  async refreshTokens(
    @Args('refreshToken') refreshToken: string,
  ): Promise<TokenResponse> {
    return await this.authService.refreshTokens(refreshToken);
  }

  @Mutation(() => Boolean)
  // @UseGuards(JwtAuthGuard)
  async logout(@Args('refreshToken') refreshToken: string): Promise<boolean> {
    await this.authService.logout(refreshToken);
    return true;
  }

  @Mutation(() => AuthResponse)
  async resetPassword(
    @Args('input') input: ResetPasswordInput,
  ): Promise<AuthResponse> {
    return await this.authService.resetPassword(
      input.username,
      input.newPassword,
      input.role,
    );
  }
}
