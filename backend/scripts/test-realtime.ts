/**
 * Test script: 2 user (A & B) realtime chat.
 *
 * Chuẩn bị:
 *   - Backend đang chạy ở http://localhost:3000
 *   - Database đã có ít nhất 2 user (a@example.com, b@example.com — password Test1234)
 *   - Cả 2 user cùng là MEMBER/OWNER của 1 server, có chung 1 channel TEXT.
 *
 * Chạy: npx ts-node scripts/test-realtime.ts
 *
 * Output:
 *   - In access token của A, B.
 *   - In channelId.
 *   - In realtime events nhận được (message:new, reaction:updated...).
 */

import { io, Socket } from 'socket.io-client';
import * as https from 'http';

const BASE = 'http://localhost:3000';

interface RegisterResp {
  user: { id: string; name: string; email: string };
  accessToken: string;
  refreshToken: string;
}

function httpJson(
  method: string,
  path: string,
  body?: unknown,
  token?: string,
): Promise<{ status: number; data: unknown }> {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : '';
    const req = https.request(
      `${BASE}${path}`,
      {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      },
      (res) => {
        let chunks = '';
        res.on('data', (c) => (chunks += c));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode ?? 0, data: JSON.parse(chunks) });
          } catch {
            resolve({ status: res.statusCode ?? 0, data: chunks });
          }
        });
      },
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function getOrCreateUser(name: string, email: string, password: string): Promise<RegisterResp> {
  // Thử login trước
  const login = await httpJson('POST', '/auth/login', { email, password });
  if (login.status === 200) {
    return login.data as RegisterResp;
  }
  const reg = await httpJson('POST', '/auth/register', { name, email, password });
  if (reg.status !== 201) {
    throw new Error(`Register failed for ${email}: ${reg.status} ${JSON.stringify(reg.data)}`);
  }
  return reg.data as RegisterResp;
}

async function setupChannel(aToken: string, bToken: string, bId: string): Promise<string> {
  // Tạo server mới (dùng user A)
  const srv = await httpJson('POST', '/servers', { name: 'RealtimeTest-' + Date.now() }, aToken);
  if (srv.status !== 201) throw new Error('Create server failed: ' + JSON.stringify(srv.data));
  const serverId = (srv.data as { id: string }).id;

  // Lấy inviteCode
  const srvOne = await httpJson('GET', `/servers/${serverId}`, undefined, aToken);
  const inviteCode = (srvOne.data as { inviteCode: string }).inviteCode;

  // B join
  const join = await httpJson('POST', '/servers/join', { inviteCode }, bToken);
  if (join.status !== 200) throw new Error('B join failed: ' + JSON.stringify(join.data));

  // Tạo channel TEXT
  const ch = await httpJson('POST', `/servers/${serverId}/channels`, { name: 'general', type: 'TEXT' }, aToken);
  if (ch.status !== 201) throw new Error('Create channel failed: ' + JSON.stringify(ch.data));

  return (ch.data as { id: string }).id;
}

function connectWs(token: string, label: string): Socket {
  const sock = io(BASE, {
    auth: { token },
    transports: ['websocket'],
  });

  sock.on('connect', () => console.log(`[${label}] WS connected: ${sock.id}`));
  sock.on('connect_error', (e) => console.error(`[${label}] connect_error:`, e.message));
  sock.on('auth:error', (e) => console.error(`[${label}] auth:error:`, e));
  sock.on('message:new', (m) => console.log(`[${label}] 📨 message:new`, m.id, m.content));
  sock.on('message:edited', (m) => console.log(`[${label}] ✏️  message:edited`, m.id));
  sock.on('message:deleted', (m) => console.log(`[${label}] 🗑️  message:deleted`, m.id));
  sock.on('reaction:updated', (m) => console.log(`[${label}] 😊 reaction:updated`, m.messageId));
  sock.on('typing:update', (m) => console.log(`[${label}] ⌨️  typing:update user=${m.userId} typing=${m.isTyping}`));
  sock.on('user:online', (m) => console.log(`[${label}] 🟢 user:online ${m.userId}`));
  sock.on('user:offline', (m) => console.log(`[${label}] ⚫ user:offline ${m.userId}`));

  return sock;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const ts = Date.now();
  const a = await getOrCreateUser(`Alice-${ts}`, `alice-${ts}@example.com`, 'Test1234');
  const b = await getOrCreateUser(`Bob-${ts}`, `bob-${ts}@example.com`, 'Test1234');
  console.log('A:', a.user.id, a.accessToken.slice(0, 20) + '…');
  console.log('B:', b.user.id, b.accessToken.slice(0, 20) + '…');

  const channelId = await setupChannel(a.accessToken, b.accessToken, b.user.id);
  console.log('Channel:', channelId);

  const sockA = connectWs(a.accessToken, 'A');
  const sockB = connectWs(b.accessToken, 'B');
  await sleep(800);

  // Join room
  sockA.emit('channel:join', { channelId });
  sockB.emit('channel:join', { channelId });
  await sleep(300);

  // 1) A gửi tin nhắn
  console.log('\n--- A sends message ---');
  const r1 = await httpJson(
    'POST',
    `/channels/${channelId}/messages`,
    { content: 'Xin chào từ A' },
    a.accessToken,
  );
  console.log('REST response:', r1.status, (r1.data as { id?: string }).id);
  await sleep(500);

  // 2) B reaction
  console.log('\n--- B reacts 👍 ---');
  const msgId = (r1.data as { id: string }).id;
  await httpJson('POST', `/messages/${msgId}/reactions`, { emoji: '👍' }, b.accessToken);
  await sleep(500);

  // 3) B gửi tin nhắn (test A nhận realtime)
  console.log('\n--- B sends message ---');
  await httpJson(
    'POST',
    `/channels/${channelId}/messages`,
    { content: 'Chào A, mình là B' },
    b.accessToken,
  );
  await sleep(500);

  // 4) A edit
  console.log('\n--- A edits ---');
  await httpJson('PUT', `/messages/${msgId}`, { content: 'Xin chào từ A (đã sửa)' }, a.accessToken);
  await sleep(500);

  // 5) Typing
  console.log('\n--- B typing ---');
  sockB.emit('typing:start', { channelId });
  await sleep(2000);
  sockB.emit('typing:stop', { channelId });
  await sleep(300);

  // 6) DM
  console.log('\n--- A opens DM with B ---');
  const dm = await httpJson('POST', `/dm/${b.user.id}`, undefined, a.accessToken);
  const dmChannelId = (dm.data as { id: string }).id;
  console.log('DM channel:', dmChannelId);

  sockA.emit('channel:join', { channelId: dmChannelId });
  sockB.emit('channel:join', { channelId: dmChannelId });
  await sleep(300);

  console.log('\n--- A sends DM to B ---');
  await httpJson(
    'POST',
    `/channels/${dmChannelId}/messages`,
    { content: 'Đây là tin nhắn riêng' },
    a.accessToken,
  );
  await sleep(500);

  // 7) Cursor pagination
  console.log('\n--- A fetches messages ---');
  const list = await httpJson(
    'GET',
    `/channels/${channelId}/messages?limit=10`,
    undefined,
    a.accessToken,
  );
  const items = (list.data as { items: unknown[] }).items;
  console.log(`Got ${items.length} messages, nextCursor=${(list.data as { nextCursor: string | null }).nextCursor}`);

  console.log('\n--- Done. Closing sockets in 2s ---');
  await sleep(2000);
  sockA.disconnect();
  sockB.disconnect();
  process.exit(0);
}

main().catch((e) => {
  console.error('TEST FAILED:', e);
  process.exit(1);
});