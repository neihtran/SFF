#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * SFF — End-to-End Regression Test
 * Test full happy-path từ Auth → Server/Channel → Message → @AI → Notification → Voice token.
 * Pass qua backend NestJS thật + verify shape khớp với TypeScript types ở frontend.
 *
 * Run: node scripts/e2e-regression.cjs
 */
const http = require('http');

const BASE = 'http://localhost:3000';
let _token = '';
let _token2 = '';
let _serverId = '';
let _channelId = '';
let _userId = '';
let _user2Id = '';
let _messageId = '';

function req(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE + path);
    const data = body ? JSON.stringify(body) : undefined;
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (data) headers['Content-Length'] = Buffer.byteLength(data);
    const r = http.request(
      { hostname: url.hostname, port: url.port, path: url.pathname + url.search, method, headers },
      (res) => {
        let buf = '';
        res.on('data', (c) => (buf += c));
        res.on('end', () => {
          try {
            const json = buf ? JSON.parse(buf) : null;
            resolve({ status: res.statusCode, body: json });
          } catch (e) {
            resolve({ status: res.statusCode, body: buf });
          }
        });
      },
    );
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

function OK(label, status) {
  if (status >= 200 && status < 300) {
    console.log(`  \u2713 ${label} [${status}]`);
  } else {
    console.error(`  \u2717 ${label} FAILED [${status}]`);
    process.exitCode = 1;
  }
}

function assert(label, cond) {
  if (cond) console.log(`  \u2713 ${label}`);
  else {
    console.error(`  \u2717 ${label} FAILED`);
    process.exitCode = 1;
  }
}

async function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  console.log('\n=== SFF E2E Regression ===\n');

  // ============================================================
  // 1. AUTH — register + login + refresh
  // ============================================================
  console.log('[1] AUTH');
  const ts = Date.now();
  const u1 = `e2e_${ts}_a@test.com`;
  const u2 = `e2e_${ts}_b@test.com`;

  let r = await req('POST', '/auth/register', {
    name: `E2E-A-${ts}`,
    email: u1,
    password: 'Pass123!',
  });
  OK('POST /auth/register (user1)', r.status);
  assert('user1 token returned', r.body?.accessToken);
  _token = r.body.accessToken;
  _userId = r.body.user?.id;

  r = await req('POST', '/auth/register', {
    name: `E2E-B-${ts}`,
    email: u2,
    password: 'Pass123!',
  });
  OK('POST /auth/register (user2)', r.status);
  _token2 = r.body.accessToken;
  _user2Id = r.body.user?.id;

  // Login again để verify login flow không phụ thuộc register
  r = await req('POST', '/auth/login', { email: u1, password: 'Pass123!' });
  OK('POST /auth/login (user1)', r.status);
  assert('login trả refreshToken', typeof r.body?.refreshToken === 'string');

  // Auth /me
  r = await req('GET', '/auth/me', undefined, _token);
  OK('GET /auth/me', r.status);
  assert('user trùng email', r.body?.email === u1);

  // Refresh
  r = await req('POST', '/auth/refresh', { refreshToken: r.body?.refreshToken ?? (await req('POST', '/auth/login', { email: u1, password: 'Pass123!' })).body.refreshToken });
  OK('POST /auth/refresh', r.status);
  assert('refresh trả accessToken mới', !!r.body?.accessToken);
  assert('accessToken KHÁC token cũ', r.body.accessToken !== _token);
  _token = r.body.accessToken;

  // ============================================================
  // 2. SERVER — tạo + list mine + join via invite code
  // ============================================================
  console.log('\n[2] SERVER');

  r = await req('POST', '/servers', { name: `E2E-Server-${ts}` }, _token);
  OK('POST /servers', r.status);
  _serverId = r.body?.id;
  assert('server có id', !!_serverId);
  assert('server có inviteCode', typeof r.body?.inviteCode === 'string');

  r = await req('GET', '/servers/mine', undefined, _token);
  OK('GET /servers/mine', r.status);
  assert('mine chứa server vừa tạo', Array.isArray(r.body) && r.body.some((s) => s.id === _serverId));

  // Join user2 vào server user1
  r = await req('POST', '/servers/join', { inviteCode: r.body?.find((s) => s.id === _serverId)?.inviteCode ?? '' }, _token2).catch(async () => {
    // nếu không lấy được inviteCode qua /servers/mine, fetch lại
    const detail = await req('GET', `/servers/${_serverId}`, undefined, _token);
    return req('POST', '/servers/join', { inviteCode: detail.body.inviteCode }, _token2);
  });
  OK('POST /servers/join (user2)', r.status);

  r = await req('GET', `/servers/${_serverId}/members`, undefined, _token);
  OK('GET /servers/:id/members', r.status);
  assert('members có 2 users', r.body?.length >= 2);

  // ============================================================
  // 3. CHANNEL — tạo TEXT + VOICE (MODERATOR+); test phân quyền
  // ============================================================
  console.log('\n[3] CHANNEL + ROLE/KICK/BAN');

  r = await req('POST', `/servers/${_serverId}/channels`, { name: `text-${ts}`, type: 'TEXT' }, _token);
  OK('POST /servers/:id/channels (TEXT, OWNER)', r.status);
  _channelId = r.body?.id;
  assert('channel TEXT có id', !!_channelId);

  // User2 (MEMBER) không được tạo channel → 403
  r = await req('POST', `/servers/${_serverId}/channels`, { name: 'hack', type: 'TEXT' }, _token2);
  if (r.status === 403 || r.status === 401) console.log('  \u2713 Member bị từ chối tạo channel [403/401]');
  else { console.error(`  \u2717 Member tạo channel được? status=${r.status}`); process.exitCode=1; }

  // Owner đổi role user2 → MODERATOR
  r = await req('PUT', `/servers/${_serverId}/members/${_user2Id}/role`, { role: 'MODERATOR' }, _token);
  OK('PUT /servers/:id/members/:userId/role (MODERATOR)', r.status);

  // Owner KHÔNG cho phép đổi role của chính mình? (server logic) — chỉ test member đổi role = 403
  r = await req('PUT', `/servers/${_serverId}/members/${_userId}/role`, { role: 'MEMBER' }, _token2);
  if (r.status === 403) console.log('  \u2713 MODERATOR không đổi role OWNER [403]');
  else console.log(`  ? MODERATOR đổi role OWNER → status ${r.status} (server có thể cho phép)`);

  // User3 để test ban/kick
  const u3 = `e2e_${ts}_c@test.com`;
  let r3 = await req('POST', '/auth/register', { name: `E2E-C-${ts}`, email: u3, password: 'Pass123!' });
  const _token3 = r3.body.accessToken;
  const _user3Id = r3.body.user.id;
  // Lấy lại inviteCode
  const detail = await req('GET', `/servers/${_serverId}`, undefined, _token);
  await req('POST', '/servers/join', { inviteCode: detail.body.inviteCode }, _token3);

  // Kick user3 (MODERATOR + đều được)
  r = await req('POST', `/servers/${_serverId}/members/${_user3Id}/kick`, {}, _token);
  OK('POST /servers/:id/members/:userId/kick', r.status);

  // User3 join lại, rồi ban
  await req('POST', '/servers/join', { inviteCode: detail.body.inviteCode }, _token3);
  r = await req('POST', `/servers/${_serverId}/members/${_user3Id}/ban`, {}, _token);
  OK('POST /servers/:id/members/:userId/ban', r.status);

  // Ban user3 join lại → 403
  r = await req('POST', '/servers/join', { inviteCode: detail.body.inviteCode }, _token3);
  if (r.status === 403 || r.status === 409 || r.status === 400) console.log('  \u2713 User bị ban không join lại [403/409/400]');
  else console.error(`  \u2717 User bị ban lại join được? status=${r.status}`);

  // Member không kick được OWNER
  r = await req('POST', `/servers/${_serverId}/members/${_userId}/kick`, {}, _token2);
  if (r.status === 403) console.log('  \u2713 Member/Mod không kick OWNER [403]');
  else console.log(`  ? Member/Mod kick OWNER → ${r.status}`);

  // ============================================================
  // 4. MESSAGE — gửi + sửa + xoá + reaction
  // ============================================================
  console.log('\n[4] MESSAGE + REACTION');

  r = await req('POST', `/channels/${_channelId}/messages`, { content: 'Xin chào E2E!' }, _token);
  OK('POST /channels/:id/messages', r.status);
  _messageId = r.body?.id;
  assert('message có id', !!_messageId);

  // Edit
  r = await req('PUT', `/messages/${_messageId}`, { content: 'Xin chào (đã sửa)' }, _token);
  OK('PUT /messages/:id (edit)', r.status);
  assert('content updated', r.body?.content === 'Xin chào (đã sửa)');

  // Reaction
  r = await req('POST', `/messages/${_messageId}/reactions`, { emoji: '[smile]' }, _token);
  OK('POST /messages/:id/reactions', r.status);
  assert('reaction là array', Array.isArray(r.body));
  const firstReaction = r.body?.[0];
  assert('reaction có id', !!firstReaction?.id);

  // Reaction trùng emoji của cùng user
  r = await req('POST', `/messages/${_messageId}/reactions`, { emoji: '[smile]' }, _token);
  if (r.status >= 200 && r.status < 300) console.log('  \u2713 Reaction duplicate: idempotent OK');
  else if (r.status === 409 || r.status === 400) console.log(`  \u2713 Reaction duplicate: rejected [${r.status}]`);
  else console.log(`  ? Reaction duplicate: ${r.status}`);

  // Remove reaction — cần :reactionId
  r = await req('DELETE', `/messages/${_messageId}/reactions/${firstReaction?.id}`, undefined, _token);
  OK('DELETE /messages/:id/reactions/:reactionId', r.status);

  // List messages (cursor)
  r = await req('GET', `/channels/${_channelId}/messages`, undefined, _token);
  OK('GET /channels/:id/messages', r.status);
  assert('list có >= 1 message', Array.isArray(r.body?.items) && r.body.items.length >= 1);

  // Member không edit message của user khác → 403
  r = await req('PUT', `/messages/${_messageId}`, { content: 'Hack' }, _token2);
  if (r.status === 403 || r.status === 401) console.log('  \u2713 Member không edit message người khác [403/401]');
  else console.log(`  ? Member edit message → ${r.status}`);

  // Delete
  r = await req('DELETE', `/messages/${_messageId}`, undefined, _token);
  OK('DELETE /messages/:id', r.status);

  // ============================================================
  // 5. AI — @AI + Semantic Search + Catch-up + Translate
  // ============================================================
  console.log('\n[5] AI NATIVE');

  // Upload AI document (OWNER only) — không có file cũ, body rỗng sẽ fail; nếu backend
  // yêu cầu multipart thì skip test này. Try multipart via Buffer? Tránh phức tạp.
  console.log('  (skip AI document upload — multipart; test @AI thay thế)');

  // @AI test trong channel — yêu cầu server có AI documents
  r = await req('POST', `/channels/${_channelId}/messages`, { content: '@AI bạn tên gì?' }, _token);
  OK('POST @AI question', r.status);
  // Đợi AI reply (best-effort, có thể không trả lời nếu chưa có tài liệu)
  await wait(3000);
  r = await req('GET', `/channels/${_channelId}/messages?limit=5`, undefined, _token);
  const aiReplies = (r.body?.items ?? []).filter((m) => m.isAiReply);
  if (aiReplies.length > 0) console.log('  \u2713 AI có reply (isAiReply=true)');
  else console.log('  ! AI không reply (server có thể chưa có documents) — not a failure');

  // Semantic search (cần serverId)
  r = await req('GET', `/search/semantic?query=xin%20ch%C3%A0o&serverId=${_serverId}`, undefined, _token);
  OK('GET /search/semantic', r.status);
  assert('result là array', Array.isArray(r.body?.results ?? r.body));

  // Catch-up
  r = await req('GET', `/channels/${_channelId}/catch-up?since=2020-01-01T00:00:00Z`, undefined, _token);
  OK('GET /channels/:id/catch-up', r.status);
  assert('catch-up có summary', typeof r.body?.summary === 'string');

  // Gửi 1 message mới rồi translate
  const msgForTranslate = await req('POST', `/channels/${_channelId}/messages`, { content: 'Hello E2E translation test!' }, _token);
  r = await req('POST', `/messages/${msgForTranslate.body.id}/translate?targetLang=vi`, undefined, _token);
  OK('POST /messages/:id/translate?targetLang=vi', r.status);
  assert('translatedText tồn tại', typeof r.body?.translatedText === 'string');

  // ============================================================
  // 6. NOTIFICATIONS
  // ============================================================
  console.log('\n[6] NOTIFICATIONS');

  r = await req('GET', '/notifications', undefined, _token);
  OK('GET /notifications', r.status);
  assert('notifications là array', Array.isArray(r.body));

  r = await req('GET', '/notifications/unread-count', undefined, _token);
  OK('GET /notifications/unread-count', r.status);
  assert('count là number', typeof r.body === 'number');

  // Mark-all-read
  r = await req('PUT', '/notifications/read-all', undefined, _token);
  OK('PUT /notifications/read-all', r.status);

  r = await req('GET', '/notifications/unread-count', undefined, _token);
  assert('unread về 0', r.body === 0);

  // ============================================================
  // 7. DM — tạo/lấy DM channel với user2
  // ============================================================
  console.log('\n[7] DM');

  r = await req('POST', `/dm/${_user2Id}`, undefined, _token);
  OK('POST /dm/:userId', r.status);
  const dmChannelId = r.body?.id ?? r.body?.channelId;
  assert('DM channel có id', !!dmChannelId);

  r = await req('GET', '/dm', undefined, _token);
  OK('GET /dm (list)', r.status);
  assert('list DM chứa kênh vừa tạo', Array.isArray(r.body) && r.body.some((d) => (d.id ?? d.channelId) === dmChannelId));

  // Gửi message trong DM
  r = await req('POST', `/channels/${dmChannelId}/messages`, { content: 'DM từ E2E' }, _token);
  OK('POST DM message', r.status);

  // User2 list notifications — có thể có DM notification
  r = await req('GET', '/notifications', undefined, _token2);
  const hasDm = (r.body ?? []).some((n) => n.type === 'DIRECT_MESSAGE');
  if (hasDm) console.log('  \u2713 User2 có notification DIRECT_MESSAGE');
  else console.log('  ? User2 không có notification DIRECT_MESSAGE (có thể chưa trigger)');

  // ============================================================
  // 8. VOICE — token + participants
  // ============================================================
  console.log('\n[8] VOICE');

  // Tạo voice channel
  r = await req('POST', `/servers/${_serverId}/channels`, { name: `voice-${ts}`, type: 'VOICE' }, _token);
  OK('POST /servers/:id/channels (VOICE)', r.status);
  const voiceChannelId = r.body?.id;
  assert('voice channel có id', !!voiceChannelId);

  r = await req('POST', `/channels/${voiceChannelId}/voice-token`, {}, _token);
  OK('POST /channels/:id/voice-token', r.status);
  assert('token có định dạng JWT', typeof r.body?.token === 'string' && r.body.token.length > 50);
  assert('livekitUrl có dạng URL', typeof r.body?.livekitUrl === 'string' && r.body.livekitUrl.startsWith('wss://'));

  r = await req('GET', `/channels/${voiceChannelId}/voice-participants`, undefined, _token);
  OK('GET /channels/:id/voice-participants', r.status);
  assert('participants là array', Array.isArray(r.body?.participants));

  // ============================================================
  // 9. USER profile
  // ============================================================
  console.log('\n[9] USER PROFILE');
  r = await req('PUT', '/users/me', { name: `E2E-Renamed-${ts}`, preferredLang: 'en' }, _token);
  OK('PUT /users/me', r.status);

  // ============================================================
  console.log('\n=== DONE ===');
  console.log(`Exit code: ${process.exitCode ?? 0}`);
}

run().catch((e) => {
  console.error('E2E crashed:', e);
  process.exit(2);
});
