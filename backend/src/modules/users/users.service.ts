import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateMeDto } from './dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Tìm user theo tên (cho autocomplete / mention) */
  async searchByName(query: string, limit = 20) {
    return this.prisma.user.findMany({
      where: {
        name: { contains: query, mode: 'insensitive' },
      },
      select: { id: true, name: true, email: true, avatarUrl: true },
      take: limit,
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, avatarUrl: true, preferredLang: true },
    });
  }

  /**
   * PUT /users/me — cập nhật profile user hiện tại.
   * - Chỉ cập nhật field được truyền lên (partial update).
   * - KHÔNG cho phép đổi email (sensitive — cần flow riêng).
   * - Trả về user object đã update (select giống findOne).
   */
  async updateMe(userId: string, dto: UpdateMeDto) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.preferredLang !== undefined ? { preferredLang: dto.preferredLang } : {}),
      },
      select: { id: true, name: true, email: true, avatarUrl: true, preferredLang: true },
    });
  }
}
