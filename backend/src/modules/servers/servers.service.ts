import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { INVITE_CODE_LENGTH } from '../../config/constants';

@Injectable()
export class ServersService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------- create ----------
  async create(ownerId: string, name: string, iconUrl?: string) {
    const inviteCode = this._generateInviteCode();

    return this.prisma.server.create({
      data: {
        name,
        iconUrl,
        ownerId,
        inviteCode,
        members: {
          create: {
            userId: ownerId,
            role: 'OWNER',
          },
        },
      },
      include: { members: true },
    });
  }

  // ---------- findMine ----------
  async findMine(userId: string) {
    return this.prisma.server.findMany({
      where: {
        members: { some: { userId, status: 'ACTIVE' } },
      },
      include: {
        members: {
          where: { userId },
          select: { role: true, status: true },
        },
        _count: { select: { members: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ---------- findOne ----------
  async findOne(serverId: string) {
    const server = await this.prisma.server.findUnique({
      where: { id: serverId },
      include: {
        owner: { select: { id: true, name: true, avatarUrl: true } },
        _count: { select: { members: true } },
      },
    });
    if (!server) throw new NotFoundException('Server not found');
    return server;
  }

  // ---------- join ----------
  async join(userId: string, inviteCode: string) {
    const server = await this.prisma.server.findUnique({ where: { inviteCode } });
    if (!server) throw new NotFoundException('Invalid invite code');

    const existing = await this.prisma.serverMember.findUnique({
      where: { serverId_userId: { serverId: server.id, userId } },
    });

    if (existing) {
      if (existing.status === 'BANNED') {
        throw new ForbiddenException('You are banned from this server');
      }
      throw new ConflictException('You are already a member');
    }

    return this.prisma.serverMember.create({
      data: { serverId: server.id, userId, role: 'MEMBER' },
      include: { server: { select: { id: true, name: true } } },
    });
  }

  // ---------- leave ----------
  async leave(userId: string, serverId: string) {
    const member = await this.prisma.serverMember.findUnique({
      where: { serverId_userId: { serverId, userId } },
    });
    if (!member) throw new NotFoundException('Not a member of this server');
    if (member.role === 'OWNER') {
      throw new ForbiddenException('Owner cannot leave the server. Transfer ownership or delete the server.');
    }

    return this.prisma.serverMember.delete({
      where: { serverId_userId: { serverId, userId } },
    });
  }

  // ---------- regenerateInviteCode ----------
  async regenerateInviteCode(userId: string, serverId: string) {
    const server = await this.prisma.server.findUnique({ where: { id: serverId } });
    if (!server) throw new NotFoundException('Server not found');
    if (server.ownerId !== userId) throw new ForbiddenException('Only the owner can regenerate invite code');

    const newCode = this._generateInviteCode();
    return this.prisma.server.update({
      where: { id: serverId },
      data: { inviteCode: newCode },
      select: { inviteCode: true },
    });
  }

  // ---------- helpers ----------
  private _generateInviteCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }
}
