import {
  SetMetadata,
  applyDecorators,
} from '@nestjs/common';
import { ServerRole } from '@prisma/client';

export const REQUIRED_SERVER_ROLE_KEY = 'requiredServerRole';
export const RequireServerRole = (...roles: ServerRole[]) =>
  SetMetadata(REQUIRED_SERVER_ROLE_KEY, roles);
