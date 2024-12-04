import { Resolver, Mutation, Args } from '@nestjs/graphql';
import { AdminService } from './admin.service';
import { AuthResponse } from 'src/shared/auth/response/auth.response';
import { SignupInput } from 'src/shared/auth/input/signup.input';
import { LoginInput } from '../shared/auth/input/login.input';

@Resolver()
export class AdminResolver {
  constructor(private adminService: AdminService) {}

  @Mutation(() => AuthResponse)
  async signup(@Args('input') input: SignupInput): Promise<AuthResponse> {
    return this.adminService.signup(input);
  }

  @Mutation(() => AuthResponse)
  async login(@Args('input') input: LoginInput): Promise<AuthResponse> {
    return this.adminService.login(input);
  }
}
