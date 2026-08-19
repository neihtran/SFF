import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccessToken } from 'livekit-server-sdk';
import { PrismaService } from '../../prisma/prisma.service';
import { LIVEKIT_TOKEN_TTL_SECONDS } from '../../config/constants';

export interface VoiceToken {
  token: string;
  livekitUrl: string;
}

@Injectable()
export class VoiceService {
  private readonly logger = new Logger(VoiceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  // ============================================================
  // generateVoiceToken
  // ============================================================
  /**
   * Sinh LiveKit AccessToken để user join 1 voice channel.
   * - Kiểm tra channel tồn tại + type = VOICE
   * - Kiểm tra user là ACTIVE member của server chứa channel (MEMBER+)
   * - identity = userId (LiveKit biết chính xác là ai)
   * - room = channelId (1-1 mapping channel VOICE ↔ LiveKit room)
   */
  async generateVoiceToken(channelId: string, userId: string): Promise<VoiceToken> {
    // 1. Verify channel
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
      select: { id: true, type: true, serverId: true, name: true },
    });

    if (!channel) {
      throw new NotFoundException('Channel not found');
    }
    if (channel.type !== 'VOICE') {
      throw new ForbiddenException('This is not a voice channel');
    }

    // 2. Verify membership — MEMBER trở lên
    if (!channel.serverId) {
      // DM channel cannot be voice
      throw new ForbiddenException('Voice channels must belong to a server');
    }

    const member = await this.prisma.serverMember.findUnique({
      where: { serverId_userId: { serverId: channel.serverId, userId } },
    });

    if (!member) {
      throw new ForbiddenException('You are not a member of this server');
    }
    if (member.status !== 'ACTIVE') {
      throw new ForbiddenException('Your membership is not active');
    }

    // 3. Get user info for identity
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true },
    });
    if (!user) {
      throw new ForbiddenException('User not found');
    }

    // 4. Generate LiveKit token
    const apiKey = this.config.getOrThrow<string>('LIVEKIT_API_KEY');
    const apiSecret = this.config.getOrThrow<string>('LIVEKIT_API_SECRET');
    const livekitUrl = this.config.getOrThrow<string>('LIVEKIT_URL');

    const token = new AccessToken(apiKey, apiSecret, {
      identity: userId,
      name: user.name,
    });

    token.addGrant({
      room: channelId,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    token.ttl = LIVEKIT_TOKEN_TTL_SECONDS;

    const jwt = await token.toJwt();
    this.logger.debug(`Voice token generated for ${userId} in room ${channelId}`);

    return { token: jwt, livekitUrl };
  }

  // ============================================================
  // getRoomParticipants (optional)
  // ============================================================
  /**
   * Lấy danh sách participant đang ở trong LiveKit room tương ứng với channel.
   * Dùng LiveKit Server SDK (RoomServiceClient).
   */
  async getRoomParticipants(channelId: string): Promise<{ participants: string[] }> {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
      select: { id: true, type: true },
    });

    if (!channel) throw new NotFoundException('Channel not found');
    if (channel.type !== 'VOICE') {
      throw new ForbiddenException('Not a voice channel');
    }

    try {
      const { RoomServiceClient } = await import('livekit-server-sdk');
      const apiKey = this.config.getOrThrow<string>('LIVEKIT_API_KEY');
      const apiSecret = this.config.getOrThrow<string>('LIVEKIT_API_SECRET');
      const livekitUrl = this.config.getOrThrow<string>('LIVEKIT_URL');

      const roomClient = new RoomServiceClient(livekitUrl, apiKey, apiSecret);
      const room = await roomClient.listParticipants(channelId);

      return {
        participants: room.map((p) => p.identity),
      };
    } catch (err) {
      this.logger.warn(
        `Failed to fetch room participants for ${channelId}: ${(err as Error).message}`,
      );
      return { participants: [] };
    }
  }
}
