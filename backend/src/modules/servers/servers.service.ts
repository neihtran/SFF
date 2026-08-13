import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateServerDto } from './dto/create-server.dto';
import { ServerResponseDto } from './dto/server-response.dto';

@Injectable()
export class ServersService {
  private readonly logger = new Logger(ServersService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Create ────────────────────────────────────────────────
  async create(
    userId: string,
    dto: CreateServerDto,
  ): Promise<ServerResponseDto> {
    const inviteCode = this.generateInviteCode();

    const server = await this.prisma.$transaction(async (tx) => {
      const s = await tx.server.create({
        data: {
          name: dto.name,
          iconUrl: dto.iconUrl,
          ownerId: userId,
          inviteCode,
        },
      });

      // Owner tự động là thành viên với role OWNER
      await tx.serverMember.create({
        data: {
          serverId: s.id,
          userId,
          role: 'OWNER',
        },
      });

      return s;
    });

    this.logger.log(`Server "${server.name}" (${server.id}) created by user ${userId}`);

    return server;
  }

  // ─── Find Mine ─────────────────────────────────────────────
  async findMine(userId: string): Promise<ServerResponseDto[]> {
    const memberships = await this.prisma.serverMember.findMany({
      where: {
        userId,
        status: 'ACTIVE',
      },
      include: {
        server: {
          select: {
            id: true,
            name: true,
            iconUrl: true,
            inviteCode: true,
            createdAt: true,
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });

    return memberships.map((m) => m.server);
  }

  // ─── Find One ───────────────────────────────────────────────
  async findOne(serverId: string, userId: string): Promise<ServerResponseDto> {
    const membership = await this.prisma.serverMember.findUnique({
      where: {
        serverId_userId: { serverId, userId },
      },
    });

    if (!membership || membership.status === 'BANNED') {
      throw new ForbiddenException('You are not a member of this server');
    }

    const server = await this.prisma.server.findUnique({
      where: { id: serverId },
    });

    if (!server) {
      throw new NotFoundException('Server not found');
    }

    return server;
  }

  // ─── Join by Invite Code ───────────────────────────────────
  async join(
    userId: string,
    inviteCode: string,
  ): Promise<ServerResponseDto> {
    const server = await this.prisma.server.findUnique({
      where: { inviteCode },
    });

    if (!server) {
      throw new NotFoundException('Invalid invite code');
    }

    const existing = await this.prisma.serverMember.findUnique({
      where: {
        serverId_userId: { serverId: server.id, userId },
      },
    });

    if (existing?.status === 'BANNED') {
      throw new ForbiddenException('You are banned from this server');
    }

    if (existing) {
      throw new ConflictException('You are already a member of this server');
    }

    await this.prisma.serverMember.create({
      data: {
        serverId: server.id,
        userId,
        role: 'MEMBER',
      },
    });

    this.logger.log(`User ${userId} joined server ${server.id} via invite code`);

    return server;
  }

  // ─── Leave ─────────────────────────────────────────────────
  async leave(serverId: string, userId: string): Promise<void> {
    const membership = await this.prisma.serverMember.findUnique({
      where: {
        serverId_userId: { serverId, userId },
      },
    });

    if (!membership) {
      throw new NotFoundException('Membership not found');
    }

    if (membership.role === 'OWNER') {
      throw new ForbiddenException(
        'Owner cannot leave. Transfer ownership to another member or delete the server.',
      );
    }

    await this.prisma.serverMember.delete({
      where: { serverId_userId: { serverId, userId } },
    });

    this.logger.log(`User ${userId} left server ${serverId}`);
  }

  // ─── Regenerate Invite Code ────────────────────────────────
  async regenerateInviteCode(
    serverId: string,
    userId: string,
  ): Promise<{ inviteCode: string }> {
    // Ownership check done by ServerRoleGuard
    const newCode = this.generateInviteCode();

    await this.prisma.server.update({
      where: { id: serverId },
      data: { inviteCode: newCode },
    });

    this.logger.log(`Invite code regenerated for server ${serverId}`);

    return { inviteCode: newCode };
  }

  // ─── Helpers ────────────────────────────────────────────────
  private generateInviteCode(length = 8): string {
    return randomBytes(length)
      .toString('base64url')
      .slice(0, length)
      .toUpperCase();
  }
}
