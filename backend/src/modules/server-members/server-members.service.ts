import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { MemberStatus, ServerRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SERVER_ROLE_LEVELS } from '../../config/constants';

@Injectable()
export class ServerMembersService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------- getMembers ----------
  async getMembers(serverId: string) {
    return this.prisma.serverMember.findMany({
      where: { serverId, status: 'ACTIVE' },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
      orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
    });
  }

  // ---------- updateRole ----------
  async updateRole(
    requesterId: string,
    serverId: string,
    targetUserId: string,
    newRole: 'MODERATOR' | 'MEMBER',
  ) {
    // Fetch requester + target memberships in parallel
    const [requester, target] = await Promise.all([
      this.prisma.serverMember.findUnique({
        where: { serverId_userId: { serverId, userId: requesterId } },
      }),
      this.prisma.serverMember.findUnique({
        where: { serverId_userId: { serverId, userId: targetUserId } },
      }),
    ]);

    if (!requester) throw new NotFoundException('You are not a member of this server');
    if (!target) throw new NotFoundException('Target user is not a member of this server');
    if (target.role === 'OWNER') throw new ForbiddenException('Cannot change owner role');

    // Prevent escalating above own level
    const maxRoleForRoleChange = requester.role === 'OWNER' ? 'OWNER' : requester.role;
    const targetLevel = SERVER_ROLE_LEVELS[newRole];
    const requesterLevel = SERVER_ROLE_LEVELS[maxRoleForRoleChange];

    if (targetLevel >= requesterLevel) {
      throw new ForbiddenException('Cannot assign a role equal to or higher than your own role');
    }

    return this.prisma.serverMember.update({
      where: { serverId_userId: { serverId, userId: targetUserId } },
      data: { role: newRole },
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
    });
  }

  // ---------- kick ----------
  async kick(requesterId: string, serverId: string, targetUserId: string) {
    const [requester, target] = await Promise.all([
      this.prisma.serverMember.findUnique({
        where: { serverId_userId: { serverId, userId: requesterId } },
      }),
      this.prisma.serverMember.findUnique({
        where: { serverId_userId: { serverId, userId: targetUserId } },
      }),
    ]);

    if (!requester) throw new NotFoundException('You are not a member of this server');
    if (!target) throw new NotFoundException('Target user is not a member of this server');
    if (target.role === 'OWNER') throw new ForbiddenException('Cannot kick the owner');

    const requesterLevel = SERVER_ROLE_LEVELS[requester.role];
    const targetLevel = SERVER_ROLE_LEVELS[target.role];

    if (targetLevel >= requesterLevel) {
      throw new ForbiddenException('Cannot kick a member with role equal to or higher than yours');
    }

    return this.prisma.serverMember.delete({
      where: { serverId_userId: { serverId, userId: targetUserId } },
    });
  }

  // ---------- ban ----------
  async ban(requesterId: string, serverId: string, targetUserId: string) {
    const [requester, target] = await Promise.all([
      this.prisma.serverMember.findUnique({
        where: { serverId_userId: { serverId, userId: requesterId } },
      }),
      this.prisma.serverMember.findUnique({
        where: { serverId_userId: { serverId, userId: targetUserId } },
      }),
    ]);

    if (!requester) throw new NotFoundException('You are not a member of this server');
    if (!target) throw new NotFoundException('Target user is not a member of this server');
    if (target.role === 'OWNER') throw new ForbiddenException('Cannot ban the owner');

    const requesterLevel = SERVER_ROLE_LEVELS[requester.role];
    const targetLevel = SERVER_ROLE_LEVELS[target.role];

    if (targetLevel >= requesterLevel) {
      throw new ForbiddenException('Cannot ban a member with role equal to or higher than yours');
    }

    return this.prisma.serverMember.update({
      where: { serverId_userId: { serverId, userId: targetUserId } },
      data: { status: 'BANNED' },
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
    });
  }

  // ---------- unban ----------
  async unban(requesterId: string, serverId: string, targetUserId: string) {
    const requester = await this.prisma.serverMember.findUnique({
      where: { serverId_userId: { serverId, userId: requesterId } },
    });
    if (!requester) throw new NotFoundException('You are not a member of this server');

    const target = await this.prisma.serverMember.findUnique({
      where: { serverId_userId: { serverId, userId: targetUserId } },
    });

    if (!target) {
      // User was never a member — re-invite them as MEMBER
      return this.prisma.serverMember.create({
        data: { serverId, userId: targetUserId, role: 'MEMBER', status: 'ACTIVE' },
        include: {
          user: { select: { id: true, name: true, email: true, avatarUrl: true } },
        },
      });
    }

    if (target.status !== 'BANNED') {
      throw new ForbiddenException('User is not banned');
    }

    return this.prisma.serverMember.update({
      where: { serverId_userId: { serverId, userId: targetUserId } },
      data: { status: 'ACTIVE' },
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
    });
  }
}
