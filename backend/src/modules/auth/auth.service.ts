import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { BCRYPT_SALT_ROUNDS } from '../../config/constants';
import { AuthResponseDto } from './dto/auth-response.dto';
import { TokenResponseDto } from './dto/token-response.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly cfg: ConfigService,
  ) {}

  // ─── Register ───────────────────────────────────────────────
  async register(
    name: string,
    email: string,
    password: string,
  ): Promise<AuthResponseDto> {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('Email already in use');
    }

    const passwordHash = await hash(password, BCRYPT_SALT_ROUNDS);

    const user = await this.prisma.user.create({
      data: { name, email, passwordHash },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        preferredLang: true,
        createdAt: true,
      },
    });

    const { accessToken, refreshToken } = await this.issueTokens(user.id, user.email);

    return { user, accessToken, refreshToken };
  }

  // ─── Login ─────────────────────────────────────────────────
  async login(
    email: string,
    password: string,
  ): Promise<AuthResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        preferredLang: true,
        createdAt: true,
        passwordHash: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await compare(password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const { passwordHash: _ph, ...userPublic } = user;
    const { accessToken, refreshToken } = await this.issueTokens(user.id, user.email);

    return { user: userPublic, accessToken, refreshToken };
  }

  // ─── Refresh Token ────────────────────────────────────────
  async refreshToken(refreshToken: string): Promise<TokenResponseDto> {
    let payload: { sub: string; email: string };

    try {
      payload = this.jwt.verify<{ sub: string; email: string }>(refreshToken, {
        secret: this.cfg.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const stored = await this.prisma.refreshToken.findFirst({
      where: {
        userId: payload.sub,
        revoked: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!stored) {
      throw new UnauthorizedException('Refresh token revoked or expired');
    }

    const tokenMatches = await compare(refreshToken, stored.tokenHash);
    if (!tokenMatches) {
      // Token không khớp → có thể bị leak → revoke tất cả token cũ của user
      await this.prisma.refreshToken.updateMany({
        where: { userId: payload.sub, revoked: false },
        data: { revoked: true },
      });
      throw new UnauthorizedException('Refresh token reuse detected — all sessions revoked');
    }

    const accessToken = this.jwt.sign(
      { sub: payload.sub, email: payload.email },
      {
        secret: this.cfg.get<string>('JWT_SECRET'),
        expiresIn: '15m',
      },
    );

    return { accessToken };
  }

  // ─── Validate User (for Guards) ───────────────────────────
  async validateUser(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        preferredLang: true,
        createdAt: true,
      },
    });
  }

  // ─── Issue Tokens ──────────────────────────────────────────
  private async issueTokens(
    userId: string,
    email: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const payload = { sub: userId, email };

    const accessToken = this.jwt.sign(payload, {
      secret: this.cfg.get<string>('JWT_SECRET'),
      expiresIn: '15m',
    });

    const refreshToken = this.jwt.sign(payload, {
      secret: this.cfg.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: '7d',
    });

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const refreshTokenHash = await hash(refreshToken, BCRYPT_SALT_ROUNDS);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: refreshTokenHash,
        expiresAt,
      },
    });

    return { accessToken, refreshToken };
  }
}
