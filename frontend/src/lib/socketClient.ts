// ============================================================
// SFF — Socket.io Client (realtime chat, typing, online status)
// Reuse cùng 1 connection; auth qua JWT.
//
// Có auto-refresh + reconnect khi access token hết hạn:
// - Lắng nghe `connect_error` (lỗi handshake do token hết hạn) và
//   `disconnect` do server ép ngắt vì lý do auth.
// - Gọi lại refreshAccessToken() (dùng chung với axios interceptor).
// - Sau khi có access token mới → socket.connect() lại với token mới
//   (auth payload được cập nhật qua hàm `auth` callback).
// - Nếu refresh cũng fail (refresh token 7 ngày hết hạn) → onSessionExpired()
//   để app logout + redirect.
// - KHÔNG hiển thị toast/disconnect rõ rệt trên UI: việc reconnect diễn ra
//   im lặng, người dùng có thể tiếp tục gõ/gửi tin nhắn bình thường.
// ============================================================

import { io, Socket } from 'socket.io-client';
import {
  getAccessToken,
  refreshAccessToken,
  setSessionExpiredHandler,
} from './axiosClient';

const socketUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

let socket: Socket | null = null;
let refreshing: Promise<string> | null = null;

/** Kênh user đang subscribe (để auto re-join sau khi reconnect). */
const subscribedChannels = new Set<string>();

/** Đăng ký kênh để sau khi reconnect sẽ tự gửi lại channel:join. */
export function trackChannel(channelId: string, joined: boolean): void {
  if (joined) subscribedChannels.add(channelId);
  else subscribedChannels.delete(channelId);
}

/**
 * Lấy socket instance. Auto setup handlers cho auth recovery.
 * Gọi nhiều lần đều an toàn — handler được gắn 1 lần.
 */
export function getSocket(): Socket {
  if (socket) return socket;

  socket = io(socketUrl, {
    transports: ['websocket'],
    autoConnect: false,
    // auth được gọi mỗi lần handshake → luôn lấy token MỚI NHẤT từ memory
    auth: (cb) => {
      cb({ token: getAccessToken() });
    },
  });

  setupAuthRecovery(socket);
  return socket;
}

/** Re-join các channel đã subscribe sau khi reconnect. */
function rejoinChannels(s: Socket): void {
  for (const channelId of subscribedChannels) {
    s.emit('channel:join', { channelId });
  }
}

/**
 * Thử refresh access token. Nếu thành công, set socket.auth và connect lại.
 * Trả về Promise<boolean> — true nếu refresh OK (sẽ reconnect).
 *
 * Single-flight: nhiều connect_error song song chỉ refresh 1 lần.
 */
async function tryReauthAndReconnect(s: Socket): Promise<boolean> {
  if (!refreshing) {
    refreshing = refreshAccessToken()
      .then((newAccess) => {
        // Cập nhật auth payload cho handshake kế tiếp
        s.auth = { token: newAccess };
        return true;
      })
      .catch(() => false)
      .finally(() => {
        refreshing = null;
      });
  }
  const ok = await refreshing;
  if (ok && !s.connected) {
    // connect() sẽ chạy lại auth callback ở handshake, lấy token mới
    s.connect();
  }
  return ok;
}

function setupAuthRecovery(s: Socket): void {
  // Lỗi handshake: server từ chối connect vì token invalid/expired
  s.on('connect_error', async (err) => {
    const msg = (err?.message ?? '').toLowerCase();
    const isAuthError =
      msg.includes('jwt') ||
      msg.includes('token') ||
      msg.includes('unauthorized') ||
      msg.includes('auth');
    if (!isAuthError) {
      // Lỗi không liên quan auth (mạng, server down...) → để socket.io tự retry
      return;
    }
    await tryReauthAndReconnect(s);
  });

  // Server emit custom auth:error event khi từ chối 1 message vì auth
  // (ít gặp — handshake đã handle phần lớn), vẫn xử lý cho chắc
  s.on('auth:error', async () => {
    await tryReauthAndReconnect(s);
  });

  // Sau khi reconnect thành công, re-join các channel đang subscribe
  s.on('connect', () => {
    rejoinChannels(s);
  });
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  subscribedChannels.clear();
  // Hủy đăng ký session-expired handler — tránh trỏ tới component đã unmount
  setSessionExpiredHandler(null);
}