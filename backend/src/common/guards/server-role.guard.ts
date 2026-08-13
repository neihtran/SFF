import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ServerRole } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { REQUIRED_ROLE_KEY } from '../decorators/require-server-role.decorator';

/**
 * Role priority: OWNER > MODERATOR > MEMBER
 * Higher number = more privilege.
 */
const ROLE_RANK: Record<ServerRole, number> = {
  OWNER: 3,
  MODERATOR: 2,
  MEMBER: 1,
};

@Injectable()
export class ServerRoleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const requiredRole = this.reflector.getAllAndOverride<ServerRole>(
      REQUIRED_ROLE_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );

    // Nếu endpoint không có @RequireServerRole → cho qua (đã có JwtAuthGuard check auth)
    if (!requiredRole) return true;

    const request = ctx.switchToHttp().getRequest();
    const user = request.user as { id: string } | undefined;

    if (!user?.id) {
      throw new UnauthorizedException('Not authenticated');
    }

    // serverId có thể nằm ở nhiều param khác nhau tùy route
    const serverId =
      request.params?.serverId ??
      request.params?.id ??
      request.params?.server_id;

    if (!serverId) {
      // Nếu param không có serverId → guard không áp dụng (có thể route không phải server-scoped)
      // Hoặc serverId nằm trong body/query (không phổ biến trong SFF)
      throw new ForbiddenException(
        'ServerRoleGuard: serverId not found in route params',
      );
    }

    const membership = await this.prisma.serverMember.findUnique({
      where: {
        serverId_userId: {
          serverId,
          userId: user.id,
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException('You are not a member of this server');
    }

    if (membership.status === 'BANNED') {
      throw new ForbiddenException('You are banned from this server');
    }

    const userRank = ROLE_RANK[membership.role];
    const requiredRank = ROLE_RANK[requiredRole];

    if (userRank < requiredRank) {
      throw new ForbiddenException(
        `Insufficient role: requires '${requiredRole}' but you have '${membership.role}'`,
      );
    }

    // Gắn membership vào request để service có thể dùng mà không cần query lại
    request.serverMembership = membership;

    return true;
  }
}
