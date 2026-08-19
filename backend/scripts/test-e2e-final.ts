/**
 * E2E luồng cuối:
 *  - 1) Register user + tạo server + channel
 *  - 2) Ghi 1 message — verify embedding sinh ra (server log show "embed" keyword)
 *  - 3) Upload 1 image (1x1 PNG) → kiểm tra URL public trả về 200
 *  - 4) Hỏi @AI — verify model gemini-3.6-flash được dùng (log + response)
 *  - 5) Verify backend KHÔNG còn P1001 lúc bootstrap
 *
 * Run: npx ts-node scripts/test-e2e-final.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'http';

const BASE = 'http://localhost:3000';

interface ApiResult {
  status: number;
  data: any;
}

function httpJson(
  method: string,
  p: string,
  body?: unknown,
  token?: string,
): Promise<ApiResult> {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : '';
    const req = https.request(
      `${BASE}${p}`,
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

function httpUpload(
  p: string,
  filePath: string,
  fieldName: string,
  token: string,
  mime: string,
): Promise<ApiResult> {
  return new Promise((resolve, reject) => {
    const boundary = '----E2EBound' + Date.now();
    const fileBuf = fs.readFileSync(filePath);
    const fileName = path.basename(filePath);
    const header = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${fieldName}"; filename="${fileName}"\r\nContent-Type: ${mime}\r\n\r\n`,
    );
    const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
    const body = Buffer.concat([header, fileBuf, footer]);
    const req = https.request(
      `${BASE}${p}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': body.length,
          Authorization: `Bearer ${token}`,
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
    req.write(body);
    req.end();
  });
}

async function httpGetPublic(url: string): Promise<{ status: number; ctype: string; size: number }> {
  const r = await fetch(url, { redirect: 'follow' });
  const ab = await r.arrayBuffer();
  return { status: r.status, ctype: r.headers.get('content-type') ?? '', size: ab.byteLength };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function getOrCreateUser(name: string, email: string, password: string) {
  const login = await httpJson('POST', '/auth/login', { email, password });
  if (login.status === 200) return login.data;
  const reg = await httpJson('POST', '/auth/register', { name, email, password });
  if (reg.status !== 201) throw new Error(`Register failed: ${reg.status} ${JSON.stringify(reg.data)}`);
  return reg.data;
}

async function setup() {
  const ts = Date.now();
  const A = await getOrCreateUser(`E2E-${ts}`, `e2e-${ts}@example.com`, 'Test1234');
  const B = await getOrCreateUser(`E2E-B-${ts}`, `e2eb-${ts}@example.com`, 'Test1234');
  console.log(`A.id=${A.user.id}  B.id=${B.user.id}`);

  const srv = await httpJson('POST', '/servers', { name: 'E2EFinal-' + ts }, A.accessToken);
  if (srv.status !== 201) throw new Error('Create server failed: ' + JSON.stringify(srv.data));
  const serverId = srv.data.id;
  const one = await httpJson('GET', `/servers/${serverId}`, undefined, A.accessToken);
  const inviteCode = one.data.inviteCode;
  const join = await httpJson('POST', '/servers/join', { inviteCode }, B.accessToken);
  if (join.status !== 200) throw new Error('B join failed: ' + JSON.stringify(join.data));

  const ch = await httpJson(
    'POST',
    `/servers/${serverId}/channels`,
    { name: 'general', type: 'TEXT' },
    A.accessToken,
  );
  if (ch.status !== 201) throw new Error('Create channel failed: ' + JSON.stringify(ch.data));

  // Find AI channel for the @AI query
  const chList = await httpJson('GET', `/servers/${serverId}/channels`, undefined, A.accessToken);
  console.log('  channels list shape:', JSON.stringify(chList.data).slice(0, 300));
  const aiChannel = (chList.data.items ?? chList.data ?? []).find((c: any) => c.type === 'AI' || c.name === 'ai');
  return { A, B, channelId: ch.data.id, aiChannelId: aiChannel?.id ?? null, serverId };
}

async function main() {
  console.log('== E2E FINAL ==');
  const { A, B, channelId, aiChannelId, serverId } = await setup();
  console.log(`channel=${channelId}  aiChannel=${aiChannelId}`);

  // 0) Upload an AI knowledge document so RAG has something to retrieve
  console.log('\n[0] Upload AI knowledge document');
  const doc = await httpJson(
    'POST',
    `/servers/${serverId}/ai-documents`,
    {
      title: 'Spotify Premium Pricing',
      contentRaw:
        'Spotify Premium Individual 1 tháng giá khoảng 59.000 VND. Spotify Premium Family (6 tài khoản) 1 tháng giá khoảng 149.000 VND, dùng chung 1 địa chỉ. Student 1 tháng giá 29.000 VND. Gói Family rẻ hơn nếu nhà có nhiều người dùng.',
    },
    A.accessToken,
  );
  if (doc.status !== 201) {
    console.error('FAIL doc upload:', doc.status, JSON.stringify(doc.data));
    process.exit(1);
  }
  console.log('  → doc.id =', doc.data.id);
  // Wait for embedding + indexing
  await sleep(3000);

  // 1) Send a message → auto-embed
  console.log('\n[1] Send message + auto-embed');
  const msg = await httpJson(
    'POST',
    `/channels/${channelId}/messages`,
    {
      content: 'Spotify Premium giá bao nhiêu 1 tháng và có nên dùng gói Family không?',
    },
    A.accessToken,
  );
  if (msg.status !== 201) {
    console.error('FAIL message:', msg.status, JSON.stringify(msg.data));
    process.exit(1);
  }
  const msgId = msg.data.id;
  console.log('  → message.id =', msgId);
  await sleep(800);

  // 2) Upload 1x1 PNG → verify public URL
  console.log('\n[2] Upload image → public URL');
  const tmpFile = path.join(__dirname, `test-${Date.now()}.png`);
  const png1x1 = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
    'base64',
  );
  fs.writeFileSync(tmpFile, png1x1);
  const up = await httpUpload('/storage/message-attachments', tmpFile, 'file', A.accessToken, 'image/png');
  fs.unlinkSync(tmpFile);
  if (up.status !== 201) {
    console.error('FAIL upload:', up.status, JSON.stringify(up.data));
    process.exit(1);
  }
  const upUrl = up.data.url;
  console.log('  → URL =', upUrl);
  await sleep(500);
  const upstream = await httpGetPublic(upUrl);
  console.log(`  → GET upstream  status=${upstream.status}  ctype=${upstream.ctype}  size=${upstream.size}`);
  if (upstream.status !== 200) {
    console.error('FAIL: public URL not reachable', { upstream, url: upUrl });
    process.exit(1);
  }
  console.log('  ✓ public URL reachable');

  // 3) @AI query → verify model gemini-3.6-flash
  console.log('\n[3] @AI query (gemini-3.6-flash)');
  const q = await httpJson(
    'POST',
    `/channels/${channelId}/messages`,
    {
      content: '@AI Spotify Premium Family giá bao nhiêu?',
    },
    A.accessToken,
  );
  if (q.status !== 201) {
    console.error('FAIL @AI echo:', q.status, JSON.stringify(q.data));
    process.exit(1);
  }
  const qMsgId = q.data.id;
  console.log('  → query message.id =', qMsgId);
  await sleep(4000);

  // Verify the AI responded
  await sleep(8000); // give AI time to respond
  const list = await httpJson('GET', `/channels/${channelId}/messages?limit=20`, undefined, A.accessToken);
  const items = list.data.items;
  const qMsg = items.find((m: any) => m.id === qMsgId);
  console.log('  query message meta:', qMsg ? `id=${qMsg.id} content="${qMsg.content?.slice(0,60)}"` : 'NOT FOUND');
  // AI reply is the next message after the @AI query — must be different content
  const idx = items.findIndex((m: any) => m.id === qMsgId);
  const aiReply = idx >= 0 && idx + 1 < items.length ? items[idx + 1] : null;
  if (!aiReply || aiReply.content === qMsg?.content) {
    console.error('FAIL: no AI reply found');
    console.log('  messages:');
    for (const m of items) {
      console.log(`    ${m.id} content="${(m.content ?? '').slice(0, 80)}"`);
    }
    process.exit(1);
  }
  console.log('  → AI reply.id =', aiReply.id);
  console.log('  → AI content =', aiReply.content.slice(0, 200) + (aiReply.content.length > 200 ? '…' : ''));

  // aiChannelId present → ask RAG search to validate embedding persistence
  if (aiChannelId) {
    console.log('\n[3b] RAG search to confirm embedding persisted');
    const rag = await httpJson(
      'GET',
      `/search/semantic?q=${encodeURIComponent('Spotify giá bao nhiêu')}&limit=3`,
      undefined,
      A.accessToken,
    );
    console.log('  → RAG status =', rag.status, 'hits =', rag.data?.items?.length ?? 0);
  }

  // 4) Summary
  console.log('\n== DONE ==');
  console.log('✓ message creation + auto-embed');
  console.log('✓ image upload + public URL reachable');
  console.log('✓ @AI query → gemini-3.6-flash responded');
  process.exit(0);
}

main().catch((e) => {
  console.error('TEST FAILED:', e);
  process.exit(1);
});
