import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ChannelsService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------- create ----------
  async create(serverId: string, name: string, type: 'TEXT' | 'VOICE') {
    const server = await this.prisma.server.findUnique({ where: { id: serverId } });
    if (!server) throw new NotFoundException('Server not found');

    return this.prisma.channel.create({
      data: { serverId, name, type },
    });
  }

  // ---------- findByServer ----------
  async findByServer(serverId: string) {
    return this.prisma.channel.findMany({
      where: { serverId },
      orderBy: [{ type: 'asc' }, { createdAt: 'asc' }],
    });
  }

  // ---------- findOne ----------
  async findOne(channelId: string) {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
      include: { server: { select: { id: true, name: true } } },
    });
    if (!channel) throw new NotFoundException('Channel not found');
    return channel;
  }

  // ---------- delete ----------
  async delete(channelId: string, serverId: string) {
    const channel = await this.prisma.channel.findUnique({ where: { id: channelId } });
    if (!channel) throw new NotFoundException('Channel not found');
    if (channel.serverId !== serverId) throw new ForbiddenException('Channel does not belong to this server');

    return this.prisma.channel.delete({ where: { id: channelId } });
  }

  // ============================================================
  // DIRECT MESSAGE
  // ============================================================

  /**
   * Tìm (hoặc tạo mới) kênh DM 1-1 giữa 2 user.
   * - DM channel có serverId = null, type = DM.
   * - ChannelMember chứa đúng 2 user.
   */
  async getOrCreateDmChannel(userId1: string, userId2: string) {
    if (userId1 === userId2) {
      throw new BadRequestException('Cannot create DM with yourself');
    }

    const [u1, u2] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId1 }, select: { id: true } }),
      this.prisma.user.findUnique({ where: { id: userId2 }, select: { id: true } }),
    ]);
    if (!u1 || !u2) throw new NotFoundException('User not found');

    // Tìm channel DM đã có: serverId=null, type=DM, có đủ 2 thành viên
    const existing = await this.prisma.channel.findFirst({
      where: {
        type: 'DM',
        serverId: null,
        AND: [
          { members: { some: { userId: userId1 } } },
          { members: { some: { userId: userId2 } } },
        ],
      },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, email: true, avatarUrl: true } },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            sender: { select: { id: true, name: true, avatarUrl: true } },
          },
        },
      },
    });

    if (existing) {
      return {
        ...existing,
        lastMessage: existing.messages[0] ?? null,
      };
    }

    // Tạo mới + 2 dòng channel_members trong 1 transaction
    const created = await this.prisma.channel.create({
      data: {
        type: 'DM',
        serverId: null,
        name: null,
        members: {
          create: [{ userId: userId1 }, { userId: userId2 }],
        },
      },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, email: true, avatarUrl: true } },
          },
        },
      },
    });

    return { ...created, lastMessage: null };
  }

  /**
   * Liệt kê tất cả kênh DM của user hiện tại, kèm tin nhắn cuối cùng
   * để client hiển thị preview.
   */
  async listMyDmChannels(userId: string) {
    return this.prisma.channel.findMany({
      where: {
        type: 'DM',
        members: { some: { userId } },
      },
      include: {
        members: {
          where: { userId: { not: userId } },
          include: {
            user: { select: { id: true, name: true, email: true, avatarUrl: true } },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            sender: { select: { id: true, name: true, avatarUrl: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}