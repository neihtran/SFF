import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateChannelDto } from './dto/create-channel.dto';
import { ChannelResponseDto } from './dto/channel-response.dto';

@Injectable()
export class ChannelsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    serverId: string,
    dto: CreateChannelDto,
  ): Promise<ChannelResponseDto> {
    return this.prisma.channel.create({
      data: {
        serverId,
        name: dto.name,
        type: dto.type,
      },
    });
  }

  async findByServer(serverId: string): Promise<ChannelResponseDto[]> {
    return this.prisma.channel.findMany({
      where: { serverId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(channelId: string, serverId: string): Promise<ChannelResponseDto> {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
    });
    if (!channel) {
      throw new NotFoundException('Channel not found');
    }
    return channel;
  }

  async delete(channelId: string, serverId: string): Promise<void> {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
    });

    if (!channel) {
      throw new NotFoundException('Channel not found');
    }

    if (channel.serverId !== serverId) {
      throw new ForbiddenException('Channel does not belong to this server');
    }

    // Cascade xoá: messages → attachments, reactions, embeddings, translations
    await this.prisma.channel.delete({ where: { id: channelId } });
  }
}
