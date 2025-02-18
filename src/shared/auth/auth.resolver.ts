import { Resolver, Mutation, Args } from '@nestjs/graphql';
import { AuthService } from './auth.service';
import { AuthResponse } from './response/auth.response';
import { BaseLoginInput } from './input/login.input';
import {
  AdminSignupInput,
  TeacherSignupInput,
  StudentSignupInput,
  ParentSignupInput,
} from './input/signup.input';
// import { JwtAuthGuard } from './guards/jwtAuth.guard';
// import { UseGuards } from '@nestjs/common';
import { TokenResponse } from './response/token.response';
import { ResetPasswordInput } from './input/reset.password.input';

@Resolver()
export class AuthResolver {
  constructor(private authService: AuthService) {}

  @Mutation(() => AuthResponse)
  async adminSignup(
    @Args('input') input: AdminSignupInput,
  ): Promise<AuthResponse> {
    return await this.authService.signup(input);
  }

  @Mutation(() => AuthResponse)
  async teacherSignup(
    @Args('input') input: TeacherSignupInput,
  ): Promise<AuthResponse> {
    return await this.authService.signup(input);
  }

  @Mutation(() => AuthResponse)
  async studentSignup(
    @Args('input') input: StudentSignupInput,
  ): Promise<AuthResponse> {
    return await this.authService.signup(input);
  }

  @Mutation(() => AuthResponse)
  async parentSignup(
    @Args('input') input: ParentSignupInput,
  ): Promise<AuthResponse> {
    return await this.authService.signup(input);
  }

  @Mutation(() => AuthResponse)
  async login(@Args('input') input: BaseLoginInput): Promise<AuthResponse> {
    return await this.authService.login(input);
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
