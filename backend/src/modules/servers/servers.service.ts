import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { nanoid } from 'nanoid';
import type { Server, ServerMember, User } from '@prisma/client';

import { CreateServerDto, JoinServerDto } from './dto';

@Injectable()
export class ServersService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Create ───────────────────────────────────────────────────

  async create(
    dto: CreateServerDto,
    userId: string,
  ): Promise<ServerWithMember> {
    let inviteCode = nanoid(8);

    // Đảm bảo invite code unique
    let exists = await this.prisma.server.findUnique({ where: { inviteCode } });
    while (exists) {
      inviteCode = nanoid(8);
      exists = await this.prisma.server.findUnique({ where: { inviteCode } });
    }

    const server = await this.prisma.server.create({
      data: {
        name: dto.name,
        iconUrl: dto.iconUrl,
        ownerId: userId,
        inviteCode,
        members: {
          create: { userId, role: 'OWNER' },
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
          },
        },
      },
    });

    return server;
  }

  // ── Find Mine ────────────────────────────────────────────────

  async findMine(userId: string): Promise<ServerWithMember[]> {
    const memberships = await this.prisma.serverMember.findMany({
      where: { userId, status: 'ACTIVE' },
      include: {
        server: {
          include: {
            members: {
              include: {
                user: { select: { id: true, name: true, avatarUrl: true } },
              },
            },
          },
        },
      },
    });

    return memberships
      .filter((m) => m.server !== null)
      .map((m) => ({
        ...m.server,
        members: m.server.members,
      })) as ServerWithMember[];
  }

  // ── Find One ─────────────────────────────────────────────────

  async findOne(serverId: string): Promise<ServerWithMember> {
    const server = await this.prisma.server.findUnique({
      where: { id: serverId },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
          },
        },
      },
    });

    if (!server) throw new NotFoundException('Server không tồn tại');
    return server;
  }

  // ── Join by invite code ─────────────────────────────────────

  async join(dto: JoinServerDto, userId: string): Promise<ServerWithMember> {
    const server = await this.prisma.server.findUnique({
      where: { inviteCode: dto.inviteCode },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
          },
        },
      },
    });

    if (!server) throw new NotFoundException('Mã invite không hợp lệ');

    const existing = server.members.find((m) => m.userId === userId);
    if (existing) {
      if (existing.status === 'BANNED') {
        throw new ForbiddenException('Bạn đã bị cấm khỏi server này');
      }
      throw new ConflictException('Bạn đã là thành viên của server này');
    }

    const updated = await this.prisma.server.update({
      where: { id: server.id },
      data: {
        members: { create: { userId, role: 'MEMBER' } },
      },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
          },
        },
      },
    });

    return updated;
  }

  // ── Leave ────────────────────────────────────────────────────

  async leave(serverId: string, userId: string): Promise<void> {
    const membership = await this.prisma.serverMember.findUnique({
      where: { serverId_userId: { serverId, userId } },
    });

    if (!membership)
      throw new NotFoundException('Bạn không phải thành viên của server');

    if (membership.role === 'OWNER') {
      throw new ForbiddenException(
        'Chủ sở hữu không thể rời server. Hãy chuyển quyền hoặc xoá server.',
      );
    }

    await this.prisma.serverMember.delete({
      where: { serverId_userId: { serverId, userId } },
    });
  }

  // ── Regenerate Invite Code ───────────────────────────────────

  async regenerateInviteCode(
    serverId: string,
    userId: string,
  ): Promise<{ inviteCode: string }> {
    const server = await this.prisma.server.findUnique({
      where: { id: serverId },
    });
    if (!server) throw new NotFoundException('Server không tồn tại');

    if (server.ownerId !== userId) {
      throw new ForbiddenException('Chỉ chủ sở hữu mới có thể đổi mã invite');
    }

    let newCode = nanoid(8);
    let exists = await this.prisma.server.findUnique({
      where: { inviteCode: newCode },
    });
    while (exists) {
      newCode = nanoid(8);
      exists = await this.prisma.server.findUnique({
        where: { inviteCode: newCode },
      });
    }

    await this.prisma.server.update({
      where: { id: serverId },
      data: { inviteCode: newCode },
    });

    return { inviteCode: newCode };
  }
}

// ── Type helpers ────────────────────────────────────────────────

export type ServerWithMember = Server & {
  members: (ServerMember & {
    user: Pick<User, 'id' | 'name' | 'email' | 'avatarUrl'>;
  })[];
};
