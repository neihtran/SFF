import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  forwardRef,
  Inject,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ChatGatewayService } from '../chat-gateway/chat-gateway.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RagService } from '../ai/rag.service';
import { AiService } from '../ai/ai.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { DEFAULT_PAGE_SIZE, EMBEDDING_DIMENSION } from '../../config/constants';

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp']);

function fileTypeFromUrl(url: string): 'image' | 'file' {
  const m = url.toLowerCase().match(/\.([a-z0-9]{1,5})(?:\?|#|$)/);
  const ext = m ? `.${m[1]}` : '';
  return IMAGE_EXTS.has(ext) ? 'image' : 'file';
}

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => ChatGatewayService))
    private readonly gateway: ChatGatewayService,
    private readonly notifications: NotificationsService,
    @Inject(forwardRef(() => RagService))
    private readonly rag: RagService,
    private readonly ai: AiService,
  ) {}

  // ============================================================
  // CREATE
  // ============================================================
  async create(channelId: string, userId: string, dto: CreateMessageDto) {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
      select: { id: true, type: true, serverId: true, name: true },
    });
    if (!channel) throw new NotFoundException('Channel not found');

    await this.assertCanSend(channelId, userId, channel.type, channel.serverId);

    // Tạo message + attachments trong 1 transaction
    const message = await this.prisma.$transaction(async (tx) => {
      const m = await tx.message.create({
        data: {
          channelId,
          senderId: userId,
          content: dto.content,
        },
      });
      if (dto.attachmentUrls && dto.attachmentUrls.length > 0) {
        await tx.messageAttachment.createMany({
          data: dto.attachmentUrls.map((url) => ({
            messageId: m.id,
            fileUrl: url,
            fileType: fileTypeFromUrl(url),
          })),
        });
      }
      return tx.message.findUniqueOrThrow({
        where: { id: m.id },
        include: {
          sender: { select: { id: true, name: true, avatarUrl: true } },
          attachments: true,
          reactions: {
            include: {
              user: { select: { id: true, name: true } },
            },
          },
        },
      });
    });

    // Side-effects: notifications
    try {
      await this._createSideEffectNotifications(message, channel);
    } catch (err) {
      this.logger.warn(`Notification side-effect failed: ${(err as Error).message}`);
    }

    // Realtime broadcast
    this.gateway.emitMessageNew(channelId, message);

    // ===== FIRE-AND-FORGET SIDE EFFECTS =====
    // 1) Auto-generate embedding (không await, không chặn response)
    void this._generateEmbeddingBgf(message.id, message.content);

    // 2) @AI trigger
    const aiMatch = message.content.match(/^@AI(?:@?)\s*(.*)/is);
    if (aiMatch && channel.serverId) {
      const question = aiMatch[1].trim();
      if (question) {
        void this._triggerAiPersona(channel.serverId, channelId, question, userId);
      }
    }

    return message;
  }

  // ============================================================
  // FIND BY CHANNEL (cursor pagination)
  // ============================================================
  async findByChannel(
    channelId: string,
    cursor: string | undefined,
    limit: number | undefined,
  ) {
    const take = limit ?? DEFAULT_PAGE_SIZE;

    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
      select: { id: true, type: true, serverId: true },
    });
    if (!channel) throw new NotFoundException('Channel not found');

    const items = await this.prisma.message.findMany({
      where: {
        channelId,
        ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take,
      include: {
        sender: { select: { id: true, name: true, avatarUrl: true } },
        attachments: true,
        reactions: {
          include: {
            user: { select: { id: true, name: true } },
          },
        },
      },
    });

    const nextCursor = items.length === take ? items[items.length - 1].createdAt.toISOString() : null;

    return {
      items: items.reverse(),
      nextCursor,
    };
  }

  // ============================================================
  // UPDATE
  // ============================================================
  async update(messageId: string, userId: string, content: string) {
    const msg = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!msg) throw new NotFoundException('Message not found');
    if (msg.senderId !== userId) {
      throw new ForbiddenException('You can only edit your own messages');
    }

    const updated = await this.prisma.message.update({
      where: { id: messageId },
      data: { content, editedAt: new Date() },
      include: {
        sender: { select: { id: true, name: true, avatarUrl: true } },
        attachments: true,
        reactions: {
          include: { user: { select: { id: true, name: true } } },
        },
      },
    });

    this.gateway.emitMessageEdited(updated.channelId, updated);
    return updated;
  }

  // ============================================================
  // REMOVE
  // ============================================================
  async remove(messageId: string, userId: string) {
    const msg = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: { channel: { select: { id: true, serverId: true } } },
    });
    if (!msg) throw new NotFoundException('Message not found');

    let allowed = msg.senderId === userId;
    if (!allowed && msg.channel.serverId) {
      const member = await this.prisma.serverMember.findUnique({
        where: {
          serverId_userId: { serverId: msg.channel.serverId, userId },
        },
      });
      if (member && (member.role === 'OWNER' || member.role === 'MODERATOR')) {
        allowed = true;
      }
    }

    if (!allowed) {
      throw new ForbiddenException(
        'You can only delete your own messages, or you must be a moderator/owner',
      );
    }

    await this.prisma.message.delete({ where: { id: messageId } });
    this.gateway.emitMessageDeleted(msg.channelId, messageId);
    return { id: messageId };
  }

  // ============================================================
  // REACTIONS
  // ============================================================
  async addReaction(messageId: string, userId: string, emoji: string) {
    const msg = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: { id: true, channelId: true },
    });
    if (!msg) throw new NotFoundException('Message not found');

    await this.prisma.messageReaction.upsert({
      where: {
        messageId_userId_emoji: { messageId, userId, emoji },
      },
      create: { messageId, userId, emoji },
      update: {},
    });

    const reactions = await this._getReactionsForMessage(messageId);
    this.gateway.emitReactionUpdated(msg.channelId, messageId, reactions);
    return reactions;
  }

  async removeReaction(messageId: string, userId: string, emoji: string) {
    const msg = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: { id: true, channelId: true },
    });
    if (!msg) throw new NotFoundException('Message not found');

    await this.prisma.messageReaction.deleteMany({
      where: { messageId, userId, emoji },
    });

    const reactions = await this._getReactionsForMessage(messageId);
    this.gateway.emitReactionUpdated(msg.channelId, messageId, reactions);
    return reactions;
  }

  // ============================================================
  // helpers
  // ============================================================

  private async assertCanSend(
    channelId: string,
    userId: string,
    type: 'TEXT' | 'VOICE' | 'DM',
    serverId: string | null,
  ): Promise<void> {
    if (type === 'DM' || !serverId) {
      const member = await this.prisma.channelMember.findUnique({
        where: { channelId_userId: { channelId, userId } },
      });
      if (!member) {
        throw new ForbiddenException('You are not a member of this DM channel');
      }
      return;
    }

    const member = await this.prisma.serverMember.findUnique({
      where: { serverId_userId: { serverId, userId } },
    });
    if (!member || member.status !== 'ACTIVE') {
      throw new ForbiddenException('You are not an active member of this server');
    }
  }

  private async _getReactionsForMessage(messageId: string) {
    return this.prisma.messageReaction.findMany({
      where: { messageId },
      include: { user: { select: { id: true, name: true } } },
    });
  }

  private async _createSideEffectNotifications(
    message: { id: string; channelId: string; senderId: string | null; content: string },
    channel: { type: 'TEXT' | 'VOICE' | 'DM'; serverId: string | null; name: string | null },
  ): Promise<void> {
    if (!message.senderId) return;

    if (channel.type === 'DM') {
      const others = await this.prisma.channelMember.findMany({
        where: { channelId: message.channelId, userId: { not: message.senderId } },
        select: { userId: true },
      });
      for (const o of others) {
        await this.notifications.create(
          o.userId,
          'DIRECT_MESSAGE',
          message.content.slice(0, 200),
        );
      }
      return;
    }

    const mentions = Array.from(message.content.matchAll(/@([a-zA-Z0-9_]{2,30})/g)).map((m) => m[1]);
    if (mentions.length === 0) return;

    const users = await this.prisma.user.findMany({
      where: { name: { in: mentions } },
      select: { id: true, name: true },
    });
    for (const u of users) {
      if (u.id === message.senderId) continue;
      const member = await this.prisma.serverMember.findUnique({
        where: { serverId_userId: { serverId: channel.serverId!, userId: u.id } },
      });
      if (!member || member.status !== 'ACTIVE') continue;

      await this.notifications.create(
        u.id,
        'MENTION',
        `${message.content.slice(0, 200)}`,
      );
    }
  }

  // ============================================================
  // FIRE-AND-FORGET SIDE EFFECTS
  // ============================================================

  /**
   * Sinh embedding cho tin nhắn mới và lưu vào message_embeddings.
   * Chạy nền (không await), không làm fail việc gửi tin.
   */
  private async _generateEmbeddingBgf(messageId: string, content: string): Promise<void> {
    try {
      const vector = await this.ai.generateEmbedding(content);
      const vecStr = `[${vector.join(',')}]`;

      await this.prisma.$executeRaw`
        INSERT INTO message_embeddings (id, message_id, embedding, created_at)
        VALUES (gen_random_uuid(), ${messageId}, ${vecStr}::vector(768), NOW())
        ON CONFLICT (message_id) DO UPDATE SET embedding = EXCLUDED.embedding`;
    } catch (err) {
      this.logger.warn(`Auto-embed failed for message ${messageId}: ${(err as Error).message}`);
    }
  }

  /**
   * Trigger AI Persona khi tin nhắn bắt đầu bằng @AI.
   * Chạy nền, không chặn response.
   */
  private async _triggerAiPersona(
    serverId: string,
    channelId: string,
    question: string,
    userId: string,
  ): Promise<void> {
    try {
      await this.rag.askAiPersona(serverId, question, channelId, userId);
    } catch (err) {
      this.logger.error(`@AI trigger failed: ${(err as Error).message}`);
    }
  }
}
