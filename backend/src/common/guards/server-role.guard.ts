import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { PrismaService } from '@/prisma/prisma.service';
import { isRoleAtLeast } from '@/common/types/server-role.enum';
import {
  MIN_ROLE_KEY,
  REQUIRE_MEMBERSHIP_KEY,
  type MinRole,
} from '@/common/decorators/require-server-role.decorator';

@Injectable()
export class ServerRoleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const minRole = this.reflector.get<MinRole>(
      MIN_ROLE_KEY,
      context.getHandler(),
    );
    if (!minRole) return true; // Không yêu cầu kiểm tra role

    const requireMembership =
      this.reflector.get<boolean>(
        REQUIRE_MEMBERSHIP_KEY,
        context.getHandler(),
      ) ?? true;

    const request = context.switchToHttp().getRequest<{
      user?: { id: string };
      params: Record<string, string>;
    }>();
    const currentUserId = request.user?.id;
    if (!currentUserId) throw new ForbiddenException('Chưa đăng nhập');

    // serverId có thể nằm ở :id hoặc :serverId tùy route
    const serverId =
      request.params['id'] ??
      request.params['serverId'] ??
      request.params['server_id'];

    if (!serverId) {
      throw new ForbiddenException('Thiếu tham số server ID');
    }

    // 1. Server phải tồn tại
    const server = await this.prisma.server.findUnique({
      where: { id: serverId },
    });
    if (!server) throw new NotFoundException('Server không tồn tại');

    // 2. Kiểm tra thành viên (nếu cần)
    if (requireMembership) {
      const membership = await this.prisma.serverMember.findUnique({
        where: { serverId_userId: { serverId, userId: currentUserId } },
      });

      if (!membership) {
        throw new ForbiddenException(
          'Bạn không phải thành viên của server này',
        );
      }

      if (membership.status === 'BANNED') {
        throw new ForbiddenException('Bạn đã bị cấm khỏi server này');
      }

      // 3. So sánh role
      if (!isRoleAtLeast(membership.role, minRole)) {
        throw new ForbiddenException(
          `Cần quyền ${minRole} trở lên để thực hiện hành động này`,
        );
      }
    }

    return true;
  }
}
