import { SetMetadata } from '@nestjs/common';
import { Roles } from 'src/shared/enum/role';

export const ROLES_KEY = 'roles';
export const HasRoles = (...roles: Roles[]) => SetMetadata(ROLES_KEY, roles);
