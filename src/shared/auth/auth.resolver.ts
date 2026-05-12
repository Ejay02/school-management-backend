import { Resolver, Mutation, Args, Context } from '@nestjs/graphql';
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

@Resolver()
export class AuthResolver {
  constructor(private readonly authService: AuthService) {}

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
