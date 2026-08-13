import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ChannelsService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------- create ----------
  async create(serverId: string, name: string, type: 'TEXT' | 'VOICE') {
    // Verify server exists
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
}
