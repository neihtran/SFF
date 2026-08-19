import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------- list ----------
  async list(userId: string, unreadOnly = false) {
    return this.prisma.notification.findMany({
      where: { userId, ...(unreadOnly ? { isRead: false } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  // ---------- unreadCount ----------
  async unreadCount(userId: string) {
    return this.prisma.notification.count({
      where: { userId, isRead: false },
    });
  }

  // ---------- markRead ----------
  async markRead(userId: string, id: string) {
    const n = await this.prisma.notification.findUnique({ where: { id } });
    if (!n) throw new NotFoundException('Notification not found');
    if (n.userId !== userId) {
      throw new ForbiddenException('Not your notification');
    }
    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  }

  // ---------- markAllRead ----------
  async markAllRead(userId: string) {
    const { count } = await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    return { count };
  }

  // ---------- create (called by MessagesService) ----------
  async create(
    userId: string,
    type: NotificationType,
    content: string,
  ) {
    return this.prisma.notification.create({
      data: { userId, type, content },
    });
  }
}