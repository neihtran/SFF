import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import type { Channel } from '@prisma/client';

import { CreateChannelDto } from './dto';

@Injectable()
export class ChannelsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Create Channel ─────────────────────────────────────────

  async create(serverId: string, dto: CreateChannelDto): Promise<Channel> {
    return this.prisma.channel.create({
      data: {
        serverId,
        name: dto.name,
        type: dto.type,
      },
    });
  }

  // ── Get Channels for Server ─────────────────────────────────

  async findByServer(serverId: string): Promise<Channel[]> {
    return this.prisma.channel.findMany({
      where: { serverId },
      orderBy: { createdAt: 'asc' },
    });
  }

  // ── Get One Channel ──────────────────────────────────────────

  async findOne(channelId: string): Promise<Channel> {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
    });
    if (!channel) throw new NotFoundException('Channel không tồn tại');
    return channel;
  }

  // ── Delete Channel ───────────────────────────────────────────

  async delete(serverId: string, channelId: string): Promise<void> {
    const channel = await this.prisma.channel.findFirst({
      where: { id: channelId, serverId },
    });
    if (!channel)
      throw new NotFoundException('Channel không tồn tại trong server này');

    await this.prisma.channel.delete({ where: { id: channelId } });
  }
}
