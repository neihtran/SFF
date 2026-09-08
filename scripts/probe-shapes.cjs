#!/usr/bin/env node
// Probe-only: in RAW response shape của các endpoint frontend depends on
const http = require('http');

function req(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const url = new URL('http://localhost:3000' + path);
    const data = body ? JSON.stringify(body) : undefined;
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (data) headers['Content-Length'] = Buffer.byteLength(data);
    const r = http.request({ hostname: url.hostname, port: url.port, path: url.pathname + url.search, method, headers }, (res) => {
      let buf = '';
      res.on('data', (c) => (buf += c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(buf) }); }
        catch { resolve({ status: res.statusCode, body: buf }); }
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

async function main() {
  // Need valid token — login as the most recent user
  // Use simple email — e2e_1757...; we don't know ID. Skip: use a fixed known seed
  // Better: register a fresh probe user
  const ts = Date.now();
  let r = await req('POST', '/auth/register', { name: `probe_${ts}`, email: `probe_${ts}@t.com`, password: 'Pass123!' });
  if (r.status !== 201) { console.error('register failed', r); return; }
  const token = r.body.accessToken;
  const userId = r.body.user.id;

  // Tạo server + channel + message
  r = await req('POST', '/servers', { name: 'probe-server' }, token);
  const serverId = r.body.id;
  const inviteCode = r.body.inviteCode;
  r = await req('POST', `/servers/${serverId}/channels`, { name: 'probe-ch', type: 'TEXT' }, token);
  const channelId = r.body.id;
  r = await req('POST', `/channels/${channelId}/messages`, { content: 'probe' }, token);
  const messageId = r.body.id;

  console.log('\n=== RAW SHAPES ===\n');

  // 1. Reaction — need to know what backend returns
  r = await req('POST', `/messages/${messageId}/reactions`, { emoji: '😊' }, token);
  console.log('POST /messages/:id/reactions →', JSON.stringify(r.body, null, 2));

  // 2. Delete reaction (need id)
  if (r.body?.id) {
    r = await req('DELETE', `/messages/${messageId}/reactions/${r.body.id}`, undefined, token);
    console.log('DELETE /messages/:id/reactions/:reactionId →', JSON.stringify(r.body, null, 2));
  }

  // 3. Semantic search — actual shape with valid params
  r = await req('GET', `/search/semantic?query=probe`, undefined, token);
  console.log('\nGET /search/semantic →', JSON.stringify({ status: r.status, body: r.body }, null, 2));

  // 4. Unread count
  r = await req('GET', '/notifications/unread-count', undefined, token);
  console.log('\nGET /notifications/unread-count →', JSON.stringify(r.body, null, 2));

  // 5. Voice participants
  // Cần voice channel trước
  r = await req('POST', `/servers/${serverId}/channels`, { name: 'voice-probe', type: 'VOICE' }, token);
  const vcId = r.body.id;
  r = await req('GET', `/channels/${vcId}/voice-participants`, undefined, token);
  console.log('\nGET /channels/:id/voice-participants →', JSON.stringify({ status: r.status, body: r.body }, null, 2));
}
main();
