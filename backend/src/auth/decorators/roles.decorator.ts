import { SetMetadata } from '@nestjs/common';
import { GlobalRole } from '../../generated/prisma/enums';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: GlobalRole[]) => SetMetadata(ROLES_KEY, roles);