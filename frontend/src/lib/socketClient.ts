// ============================================================
// SFF — Socket.io Client (realtime chat, typing, online status)
// Reuse cùng 1 connection; auth qua JWT.
// ============================================================

import { io, Socket } from 'socket.io-client';
import { getAccessToken } from './axiosClient';

const socketUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (socket) return socket;
  socket = io(socketUrl, {
    transports: ['websocket'],
    autoConnect: false,
    auth: (cb) => {
      cb({ token: getAccessToken() });
    },
  });
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
