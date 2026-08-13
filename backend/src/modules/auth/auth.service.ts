import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import ms from 'ms';

import { PrismaService } from '@/prisma/prisma.service';
import {
  BCRYPT_SALT_ROUNDS,
  JWT_ACCESS_TTL,
  JWT_REFRESH_TTL,
} from '@/config/constants';
import { LoginDto, RefreshTokenDto, RegisterDto } from './dto';
import type { User } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  // ── Register ────────────────────────────────────────────────────

  async register(dto: RegisterDto): Promise<TokensPayload> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email đã được sử dụng');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        passwordHash,
        preferredLang: dto.preferredLang ?? 'vi',
      },
    });

    return this.issueTokens(user);
  }

  // ── Login ──────────────────────────────────────────────────────

  async login(dto: LoginDto): Promise<TokensPayload> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    return this.issueTokens(user);
  }

  // ── Refresh Token ───────────────────────────────────────────────

  async refreshToken(dto: RefreshTokenDto): Promise<TokensPayload> {
    const tokenHash = await bcrypt.hash(dto.refreshToken, 5);

    const record = await this.prisma.refreshToken.findFirst({
      where: {
        tokenHash,
        revoked: false,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });

    if (!record) {
      throw new UnauthorizedException(
        'Refresh token không hợp lệ hoặc đã hết hạn',
      );
    }

    // Rotate: revoke old token
    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { revoked: true },
    });

    return this.issueTokens(record.user);
  }

  // ── Me ──────────────────────────────────────────────────────────

  async me(userId: string): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    return toPublicUser(user);
  }

  // ── Validate User (used by JwtStrategy) ─────────────────────────

  async validateUser(userId: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id: userId } });
  }

  // ── Token issuance ─────────────────────────────────────────────

  private async issueTokens(user: User): Promise<TokensPayload> {
    const payload = { sub: user.id, email: user.email };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.config.get<string>('JWT_SECRET')!,
      expiresIn: JWT_ACCESS_TTL,
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.config.get<string>('JWT_REFRESH_SECRET')!,
      expiresIn: JWT_REFRESH_TTL,
    });

    const tokenHash = await bcrypt.hash(refreshToken, 5);
    const expiresAt = new Date(Date.now() + ms(JWT_REFRESH_TTL));

    await this.prisma.refreshToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    const publicUser = toPublicUser(user);
    return { user: publicUser, accessToken, refreshToken };
  }
}

// ── Types ──────────────────────────────────────────────────────────

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  preferredLang: string;
}

export interface TokensPayload {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
}

function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl,
    preferredLang: user.preferredLang,
  };
}
