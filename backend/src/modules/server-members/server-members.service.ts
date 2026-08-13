import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import type { ServerMember, User } from '@prisma/client';

import { UpdateRoleDto } from './dto';

@Injectable()
export class ServerMembersService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Get Members ─────────────────────────────────────────────

  async getMembers(serverId: string): Promise<ServerMemberWithUser[]> {
    const members = await this.prisma.serverMember.findMany({
      where: { serverId },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
      orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
    });
    return members;
  }

  // ── Update Role ─────────────────────────────────────────────

  async updateRole(
    serverId: string,
    targetUserId: string,
    dto: UpdateRoleDto,
  ): Promise<ServerMemberWithUser> {
    const [server, targetMember] = await Promise.all([
      this.prisma.server.findUnique({ where: { id: serverId } }),
      this.prisma.serverMember.findUnique({
        where: { serverId_userId: { serverId, userId: targetUserId } },
      }),
    ]);

    if (!server) throw new NotFoundException('Server không tồn tại');
    if (!targetMember)
      throw new NotFoundException('Thành viên không tồn tại trong server');

    // Không cho đổi role của Owner
    if (targetMember.role === 'OWNER') {
      throw new BadRequestException('Không thể thay đổi role của chủ sở hữu');
    }

    // Nếu đổi về MEMBER, kiểm tra người thực hiện có quyền không
    // Guard @RequireServerRole('OWNER') đã đảm bảo requester là OWNER

    const updated = await this.prisma.serverMember.update({
      where: { serverId_userId: { serverId, userId: targetUserId } },
      data: { role: dto.role },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    });

    return updated;
  }

  // ── Kick ───────────────────────────────────────────────────

  async kick(
    serverId: string,
    targetUserId: string,
    requesterId: string,
  ): Promise<void> {
    const targetMember = await this.prisma.serverMember.findUnique({
      where: { serverId_userId: { serverId, userId: targetUserId } },
    });

    if (!targetMember)
      throw new NotFoundException('Thành viên không tồn tại trong server');

    // Không kick được Owner
    if (targetMember.role === 'OWNER') {
      throw new ForbiddenException('Không thể kick chủ sở hữu');
    }

    // MODERATOR không kick được MODERATOR khác
    if (
      targetMember.role === 'MODERATOR' &&
      requesterId !==
        (await this.prisma.server.findUnique({ where: { id: serverId } }))
          ?.ownerId
    ) {
      throw new ForbiddenException(
        'Không thể kick thành viên có vai trò cao hơn bạn',
      );
    }

    await this.prisma.serverMember.delete({
      where: { serverId_userId: { serverId, userId: targetUserId } },
    });
  }

  // ── Ban ───────────────────────────────────────────────────

  async ban(
    serverId: string,
    targetUserId: string,
    requesterId: string,
  ): Promise<ServerMemberWithUser> {
    const targetMember = await this.prisma.serverMember.findUnique({
      where: { serverId_userId: { serverId, userId: targetUserId } },
    });

    if (!targetMember) throw new NotFoundException('Thành viên không tồn tại');

    if (targetMember.role === 'OWNER') {
      throw new ForbiddenException('Không thể cấm chủ sở hữu');
    }

    const server = await this.prisma.server.findUnique({
      where: { id: serverId },
    });
    const isOwner = server?.ownerId === requesterId;

    // MODERATOR không ban được MODERATOR khác
    if (targetMember.role === 'MODERATOR' && !isOwner) {
      throw new ForbiddenException(
        'Không thể cấm thành viên có vai trò cao hơn bạn',
      );
    }

    const updated = await this.prisma.serverMember.update({
      where: { serverId_userId: { serverId, userId: targetUserId } },
      data: { status: 'BANNED' },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    });

    return updated;
  }

  // ── Unban ─────────────────────────────────────────────────

  async unban(
    serverId: string,
    targetUserId: string,
  ): Promise<ServerMemberWithUser> {
    const targetMember = await this.prisma.serverMember.findUnique({
      where: { serverId_userId: { serverId, userId: targetUserId } },
    });

    if (!targetMember) throw new NotFoundException('Thành viên không tồn tại');

    if (targetMember.status !== 'BANNED') {
      throw new BadRequestException('Thành viên không bị cấm');
    }

    const updated = await this.prisma.serverMember.update({
      where: { serverId_userId: { serverId, userId: targetUserId } },
      data: { status: 'ACTIVE' },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    });

    return updated;
  }
}

export type ServerMemberWithUser = ServerMember & {
  user: Pick<User, 'id' | 'name' | 'email' | 'avatarUrl'>;
};
