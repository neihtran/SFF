import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ServerRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SERVER_ROLE_LEVELS } from '../../config/constants';
import {
  REQUIRED_SERVER_ROLE_KEY,
} from '../decorators/require-server-role.decorator';

@Injectable()
export class ServerRoleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<ServerRole[]>(
      REQUIRED_SERVER_ROLE_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );

    // Nếu không có decorator @RequireServerRole, cho phép đi qua
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    if (!user) throw new ForbiddenException('Not authenticated');

    // Lấy serverId từ params: /servers/:id/... hoặc /channels/:channelId/...
    const serverId = this._extractServerId(request);
    if (!serverId) throw new ForbiddenException('Server context not found');

    const member = await this.prisma.serverMember.findUnique({
      where: { serverId_userId: { serverId, userId: user.id } },
    });

    if (!member) throw new ForbiddenException('Not a member of this server');

    if (member.status === 'BANNED') {
      throw new ForbiddenException('You are banned from this server');
    }

    const maxAllowed = Math.max(...requiredRoles.map((r) => SERVER_ROLE_LEVELS[r]));
    const userLevel = SERVER_ROLE_LEVELS[member.role];

    if (userLevel < maxAllowed) {
      throw new ForbiddenException(
        `Requires ${requiredRoles.join(' or ')} role, but you are ${member.role}`,
      );
    }

    // Gắn role hiện tại vào request để service dùng nếu cần
    request.serverRole = member.role;
    return true;
  }

  private _extractServerId(request: { params: Record<string, string> }): string | null {
    return (
      request.params['serverId'] ??
      request.params['id'] ??
      null
    );
  }
}
