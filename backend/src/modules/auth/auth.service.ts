import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { JWT_ACCESS_TTL, JWT_REFRESH_TTL, BCRYPT_SALT_ROUNDS } from '../../config/constants';
import { JwtPayload } from './strategies/jwt.strategy';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  // ---------- register ----------
  async register(name: string, email: string, password: string) {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    const user = await this.prisma.user.create({
      data: { name, email, passwordHash },
      select: { id: true, name: true, email: true, avatarUrl: true, preferredLang: true },
    });

    const tokens = await this._generateTokens(user.id, user.email);
    await this._storeRefreshToken(user.id, tokens.refreshToken);

    return { user, ...tokens };
  }

  // ---------- login ----------
  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true, passwordHash: true, avatarUrl: true, preferredLang: true },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this._generateTokens(user.id, user.email);
    await this._storeRefreshToken(user.id, tokens.refreshToken);

    const { passwordHash: _, ...safeUser } = user;
    return { user: safeUser, ...tokens };
  }

  // ---------- refresh ----------
  async refreshTokens(refreshToken: string) {
    let payload: JwtPayload;
    try {
      payload = this.jwt.verify<JwtPayload>(refreshToken, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const stored = await this.prisma.refreshToken.findFirst({
      where: { userId: payload.sub, revoked: false },
      orderBy: { createdAt: 'desc' },
    });

    if (!stored) {
      throw new UnauthorizedException('Refresh token not found');
    }

    const valid = await bcrypt.compare(refreshToken, stored.tokenHash);
    if (!valid) {
      throw new UnauthorizedException('Token mismatch');
    }

    if (stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    // Revoke old token
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revoked: true },
    });

    // Revoke all other tokens for this user (optional: single session)
    await this.prisma.refreshToken.updateMany({
      where: { userId: payload.sub, id: { not: stored.id } },
      data: { revoked: true },
    });

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: payload.sub },
      select: { id: true, email: true },
    });

    return this._generateTokens(user.id, user.email);
  }

  // ---------- validateUser (for JWT strategy) is handled in JwtStrategy ----------

  // ---------- helpers ----------
  private async _generateTokens(userId: string, email: string): Promise<{ accessToken: string; refreshToken: string }> {
    const payload: JwtPayload = { sub: userId, email };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
        expiresIn: JWT_ACCESS_TTL,
      }),
      this.jwt.signAsync(payload, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: JWT_REFRESH_TTL,
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private _parseJwtTtl(ttl: string): Date {
    const expiresAt = new Date();
    const match = ttl.match(/^(\d+)([smhd])$/);
    if (!match) return expiresAt;
    const [, value, unit] = match;
    const num = parseInt(value, 10);
    switch (unit) {
      case 's': expiresAt.setSeconds(expiresAt.getSeconds() + num); break;
      case 'm': expiresAt.setMinutes(expiresAt.getMinutes() + num); break;
      case 'h': expiresAt.setHours(expiresAt.getHours() + num); break;
      case 'd': expiresAt.setDate(expiresAt.getDate() + num); break;
    }
    return expiresAt;
  }

  private async _storeRefreshToken(userId: string, token: string): Promise<void> {
    const tokenHash = await bcrypt.hash(token, BCRYPT_SALT_ROUNDS);
    const expiresAt = this._parseJwtTtl(JWT_REFRESH_TTL);

    await this.prisma.refreshToken.create({
      data: { userId, tokenHash, expiresAt },
    });
  }
}
