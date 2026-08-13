import { Request } from 'express';
import { ServerMember } from '@prisma/client';

/**
 * Extend Express Request để include serverMembership sau khi ServerRoleGuard chạy.
 * Dùng: request.serverMembership.role, request.serverMembership.userId ...
 */
export interface ServerRequest extends Request {
  serverMembership?: ServerMember;
}
