import { Resolver } from '@nestjs/graphql';
import { AdminService } from './admin.service';

@Resolver()
export class AdminResolver {
  constructor(private adminService: AdminService) {}

  // @Query()
  // @HasRoles(Roles.ADMIN)
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // async getAdmins() {
  //   // Only SUPER_ADMIN and ADMIN can access
  // }
}
