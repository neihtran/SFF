import { Logger } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { JwtPayload } from '../auth/strategies/jwt.strategy';

interface AuthedSocket extends Socket {
  data: { userId: string; email: string };
}

@WebSocketGateway({
  cors: { origin: true, credentials: true },
})
export class ChatGatewayService implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ChatGatewayService.name);

  /**
   * userId → set of socketIds (cho online status)
   */
  private readonly onlineUsers = new Map<string, Set<string>>();

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  // ============================================================
  // HANDSHAKE — verify JWT
  // ============================================================
  async handleConnection(socket: AuthedSocket) {
    try {
      const token =
        (socket.handshake.auth?.token as string | undefined) ??
        (socket.handshake.headers['authorization'] as string | undefined)?.replace(
          /^Bearer\s+/i,
          '',
        );

      if (!token) {
        socket.emit('auth:error', { message: 'Missing token' });
        socket.disconnect(true);
        return;
      }

      const payload = this.jwt.verify<JwtPayload>(token, {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
      });
      socket.data.userId = payload.sub;
      socket.data.email = payload.email;

      // Join personal room để có thể push notif riêng (nếu cần sau)
      void socket.join(`user:${payload.sub}`);

      // Track online
      const sockets = this.onlineUsers.get(payload.sub) ?? new Set<string>();
      sockets.add(socket.id);
      this.onlineUsers.set(payload.sub, sockets);

      // Broadcast online status (chỉ cho clients đang connect tới các channel user là member)
      this.server.emit('user:online', { userId: payload.sub });

      this.logger.log(`WS connect: ${payload.sub} (${socket.id})`);
    } catch (err) {
      this.logger.warn(`WS auth failed (${socket.id}): ${(err as Error).message}`);
      socket.emit('auth:error', { message: 'Invalid token' });
      socket.disconnect(true);
    }
  }

  handleDisconnect(socket: AuthedSocket) {
    const userId = socket.data?.userId;
    if (!userId) return;
    const set = this.onlineUsers.get(userId);
    if (set) {
      set.delete(socket.id);
      if (set.size === 0) {
        this.onlineUsers.delete(userId);
        this.server.emit('user:offline', { userId });
      }
    }
    this.logger.log(`WS disconnect: ${userId} (${socket.id})`);
  }

  // ============================================================
  // ROOM JOIN/LEAVE
  // ============================================================
  @SubscribeMessage('channel:join')
  onJoin(
    @ConnectedSocket() socket: AuthedSocket,
    @MessageBody() body: { channelId: string },
  ) {
    if (!body?.channelId) return { ok: false, error: 'channelId required' };
    void socket.join(`channel:${body.channelId}`);
    return { ok: true, channelId: body.channelId };
  }

  @SubscribeMessage('channel:leave')
  onLeave(
    @ConnectedSocket() socket: AuthedSocket,
    @MessageBody() body: { channelId: string },
  ) {
    if (!body?.channelId) return { ok: false, error: 'channelId required' };
    void socket.leave(`channel:${body.channelId}`);
    return { ok: true, channelId: body.channelId };
  }

  // ============================================================
  // TYPING (broadcast, không lưu DB)
  // ============================================================
  @SubscribeMessage('typing:start')
  onTypingStart(
    @ConnectedSocket() socket: AuthedSocket,
    @MessageBody() body: { channelId: string },
  ) {
    if (!body?.channelId) return;
    socket.to(`channel:${body.channelId}`).emit('typing:update', {
      channelId: body.channelId,
      userId: socket.data.userId,
      isTyping: true,
    });
  }

  @SubscribeMessage('typing:stop')
  onTypingStop(
    @ConnectedSocket() socket: AuthedSocket,
    @MessageBody() body: { channelId: string },
  ) {
    if (!body?.channelId) return;
    socket.to(`channel:${body.channelId}`).emit('typing:update', {
      channelId: body.channelId,
      userId: socket.data.userId,
      isTyping: false,
    });
  }

  // ============================================================
  // EMIT (called by MessagesService)
  // ============================================================
  emitMessageNew(channelId: string, message: unknown) {
    this.server.to(`channel:${channelId}`).emit('message:new', message);
  }

  emitMessageEdited(channelId: string, message: unknown) {
    this.server.to(`channel:${channelId}`).emit('message:edited', message);
  }

  emitMessageDeleted(channelId: string, messageId: string) {
    this.server.to(`channel:${channelId}`).emit('message:deleted', { id: messageId });
  }

  emitReactionUpdated(channelId: string, messageId: string, reactions: unknown) {
    this.server
      .to(`channel:${channelId}`)
      .emit('reaction:updated', { messageId, reactions });
  }

  /** Trả về user nào đang online (cho /users/online hoặc tương tự sau) */
  isOnline(userId: string): boolean {
    return this.onlineUsers.has(userId);
  }
}