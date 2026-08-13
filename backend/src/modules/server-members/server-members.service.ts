import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ServerRole, MemberStatus } from '@prisma/client';
import { MemberResponseDto } from './dto/member-response.dto';

@Injectable()
export class ServerMembersService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── List Members ─────────────────────────────────────────
  async findAll(serverId: string): Promise<MemberResponseDto[]> {
    const members = await this.prisma.serverMember.findMany({
      where: { serverId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
    });

    return members.map((m) => ({
      id: m.id,
      serverId: m.serverId,
      userId: m.userId,
      role: m.role,
      status: m.status,
      joinedAt: m.joinedAt,
      user: m.user,
    }));
  }

  // ─── Update Role ───────────────────────────────────────────
  async updateRole(
    serverId: string,
    targetUserId: string,
    newRole: 'MODERATOR' | 'MEMBER',
    actorRole: ServerRole,
  ): Promise<MemberResponseDto> {
    if (actorRole !== 'OWNER') {
      throw new ForbiddenException('Only the owner can change member roles');
    }

    const target = await this.prisma.serverMember.findUnique({
      where: { serverId_userId: { serverId, userId: targetUserId } },
    });

    if (!target) {
      throw new NotFoundException('Member not found in this server');
    }

    if (target.role === 'OWNER') {
      throw new BadRequestException('Cannot change the owner role');
    }

    const updated = await this.prisma.serverMember.update({
      where: { serverId_userId: { serverId, userId: targetUserId } },
      data: { role: newRole },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });

    return {
      id: updated.id,
      serverId: updated.serverId,
      userId: updated.userId,
      role: updated.role,
      status: updated.status,
      joinedAt: updated.joinedAt,
      user: updated.user,
    };
  }

  // ─── Kick ──────────────────────────────────────────────────
  async kick(
    serverId: string,
    targetUserId: string,
    actorRole: ServerRole,
    actorUserId: string,
  ): Promise<void> {
    const target = await this.prisma.serverMember.findUnique({
      where: { serverId_userId: { serverId, userId: targetUserId } },
    });

    if (!target) {
      throw new NotFoundException('Member not found in this server');
    }

    if (target.role === 'OWNER') {
      throw new ForbiddenException('Cannot kick the owner');
    }

    // MODERATOR chỉ kick được MEMBER
    if (actorRole === 'MODERATOR' && target.role !== 'MEMBER') {
      throw new ForbiddenException(
        'Moderators can only kick members with the MEMBER role',
      );
    }

    // Không tự kick chính mình (dùng leave() thay vì kick())
    if (actorUserId === targetUserId) {
      throw new BadRequestException('Use the leave endpoint to leave the server');
    }

    await this.prisma.serverMember.delete({
      where: { serverId_userId: { serverId, userId: targetUserId } },
    });
  }

  // ─── Ban ──────────────────────────────────────────────────
  async ban(
    serverId: string,
    targetUserId: string,
    actorRole: ServerRole,
    actorUserId: string,
  ): Promise<MemberResponseDto> {
    if (actorRole === 'MEMBER') {
      throw new ForbiddenException('Only moderators and owners can ban members');
    }

    const target = await this.prisma.serverMember.findUnique({
      where: { serverId_userId: { serverId, userId: targetUserId } },
    });

    if (!target) {
      throw new NotFoundException('Member not found in this server');
    }

    if (target.role === 'OWNER') {
      throw new ForbiddenException('Cannot ban the owner');
    }

    if (actorRole === 'MODERATOR' && target.role === 'MODERATOR') {
      throw new ForbiddenException('Moderators cannot ban other moderators');
    }

    if (actorUserId === targetUserId) {
      throw new BadRequestException('Cannot ban yourself');
    }

    const updated = await this.prisma.serverMember.update({
      where: { serverId_userId: { serverId, userId: targetUserId } },
      data: { status: 'BANNED' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });

    return {
      id: updated.id,
      serverId: updated.serverId,
      userId: updated.userId,
      role: updated.role,
      status: updated.status,
      joinedAt: updated.joinedAt,
      user: updated.user,
    };
  }

  // ─── Unban ────────────────────────────────────────────────
  async unban(
    serverId: string,
    targetUserId: string,
    actorRole: ServerRole,
  ): Promise<MemberResponseDto> {
    if (actorRole === 'MEMBER') {
      throw new ForbiddenException('Only moderators and owners can unban members');
    }

    const target = await this.prisma.serverMember.findUnique({
      where: { serverId_userId: { serverId, userId: targetUserId } },
    });

    if (!target) {
      throw new NotFoundException('Member record not found');
    }

    if (target.status !== 'BANNED') {
      throw new BadRequestException('Member is not banned');
    }

    const updated = await this.prisma.serverMember.update({
      where: { serverId_userId: { serverId, userId: targetUserId } },
      data: { status: 'ACTIVE' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });

    return {
      id: updated.id,
      serverId: updated.serverId,
      userId: updated.userId,
      role: updated.role,
      status: updated.status,
      joinedAt: updated.joinedAt,
      user: updated.user,
    };
  }
}
