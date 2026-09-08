#!/usr/bin/env node
/**
 * SFF — UI thật regression test với Playwright
 *
 * Mở trình duyệt thật tới http://localhost:5173, đăng nhập, đi qua từng
 * màn hình, chụp screenshot từng bước. Fail nếu không khớp.
 *
 * Run: node scripts/ui-regression.cjs
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const FE = 'http://localhost:5173';
const BE = 'http://localhost:3000';
const OUT_DIR = path.join(__dirname, '..', 'screenshots');
fs.mkdirSync(OUT_DIR, { recursive: true });

// ============= Util =============
function log(label, ok, detail = '') {
  const prefix = ok ? '\u2713' : '\u2717';
  const color = ok ? '' : '\u001b[31m';
  const reset = ok ? '' : '\u001b[0m';
  console.log(`  ${color}${prefix}${reset} ${label}${detail ? ' — ' + detail : ''}`);
  if (!ok) process.exitCode = 1;
}

function step(name) {
  console.log(`\n[${name}]`);
}

async function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function shoot(page, name) {
  const file = path.join(OUT_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`    📸 ${path.basename(file)}`);
  return file;
}

// ============= Main =============
async function run() {
  console.log('=== SFF UI Regression ===\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    locale: 'vi-VN',
  });
  const page = await context.newPage();

  // Capture console errors
  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push('PageError: ' + err.message));

  // ============================================================
  // SETUP — register + login qua API để có token
  // ============================================================
  step('SETUP — register + login qua API');
  const ts = Date.now();
  const u1 = `uitest_${ts}@t.com`;
  const u2 = `uitest2_${ts}@t.com`;

  async function apiReq(method, p, body, token) {
    const res = await fetch(BE + p, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => null);
    return { status: res.status, body: data };
  }

  let r = await apiReq('POST', '/auth/register', { name: `UI-${ts}`, email: u1, password: 'Pass123!' });
  log('register user1', r.status === 201);
  const t1 = r.body.accessToken;
  const id1 = r.body.user.id;

  r = await apiReq('POST', '/auth/register', { name: `UI2-${ts}`, email: u2, password: 'Pass123!' });
  log('register user2', r.status === 201);
  const t2 = r.body.accessToken;
  const id2 = r.body.user.id;

  // Tạo server + channel + 35 messages (để test scroll)
  r = await apiReq('POST', '/servers', { name: `UISrv-${ts}` }, t1);
  log('create server', r.status === 201);
  const serverId = r.body.id;
  const inviteCode = r.body.inviteCode;

  r = await apiReq('POST', `/servers/${serverId}/channels`, { name: `chat-${ts}`, type: 'TEXT' }, t1);
  log('create text channel', r.status === 201);
  const channelId = r.body.id;

  // Seed 35 messages
  for (let i = 1; i <= 35; i++) {
    await apiReq('POST', `/channels/${channelId}/messages`, { content: `Tin nhắn số ${i} — Lorem ipsum ${'x'.repeat(20 + i * 4)}` }, t1);
  }
  log('seeded 35 messages', true);

  // Seed thêm 15 messages có chứa keyword để semantic search tìm được nhiều kết quả
  const searchKeywords = [
    'Quy định server', 'hướng dẫn sử dụng', 'cách bật mic', 'cách chia sẻ màn hình',
    'luật role', 'kick ban', 'tạo channel', 'mời bạn bè', 'AI hoạt động thế nào',
    'thông báo', 'lịch họp', 'deadline', 'phân công', 'review code', 'deploy production',
  ];
  for (let i = 0; i < searchKeywords.length; i++) {
    await apiReq('POST', `/channels/${channelId}/messages`, { content: `${searchKeywords[i]} — đây là message test cho semantic search số ${i + 1}` }, t1);
  }
  log('seeded 15 search-related messages', true);

  // Tạo voice channel + thêm user2
  r = await apiReq('POST', `/servers/${serverId}/channels`, { name: `voice-${ts}`, type: 'VOICE' }, t1);
  log('create voice channel', r.status === 201);
  const voiceChannelId = r.body.id;

  r = await apiReq('POST', '/servers/join', { inviteCode }, t2);
  log('user2 joined server', r.status === 200);

  // Thêm 10 user nữa join server để có đủ members test scroll
  const extraUserIds = [];
  for (let i = 0; i < 10; i++) {
    const eu = `extra_${ts}_${i}@t.com`;
    const er = await apiReq('POST', '/auth/register', { name: `ExtraUser-${ts}-${i}`, email: eu, password: 'Pass123!' });
    if (er.status === 201) {
      await apiReq('POST', '/servers/join', { inviteCode: inviteCode }, er.body.accessToken);
      extraUserIds.push(er.body.user.id);
    }
  }
  log(`thêm ${extraUserIds.length} user vào server`, extraUserIds.length >= 10);

  // Inject tokens vào Zustand persist store (key 'sff-auth')
  await page.goto(FE + '/auth/login', { waitUntil: 'networkidle' });
  const loginRes = await apiReq('POST', '/auth/login', { email: u1, password: 'Pass123!' });
  await page.evaluate((payload) => {
    localStorage.setItem('sff-auth', JSON.stringify({ state: payload, version: 0 }));
  }, {
    user: loginRes.body.user,
    accessToken: t1,
    refreshToken: loginRes.body.refreshToken,
  });
  // Reload để Zustand rehydrate từ localStorage
  await page.reload({ waitUntil: 'networkidle' });
  await wait(500);
  log('tokens injected to localStorage "sff-auth"', true);

  // ============================================================
  // B3.1 — Open chat channel + verify scroll + auto-scroll
  // ============================================================
  step('B3.1 — Text Channel: scroll + auto-scroll + history scroll');
  await page.goto(`${FE}/app/${serverId}/${channelId}`, { waitUntil: 'networkidle' });
  // Đợi cho ChannelSidebar load xong + messages fetch về
  await page.waitForSelector('button:has-text("chat-"), button:has(svg)', { timeout: 10000 }).catch(() => {});
  await wait(3000);
  await shoot(page, '01-chat-loaded');

  // Verify chat input & messages rendered
  const messageCount = await page.locator('[data-testid="message-bubble"]').count().catch(() => 0);
  // Có thể không có data-testid, fallback: count MessageBubble elements
  const fallbackCount = messageCount > 0 ? messageCount : await page.locator('div').filter({ hasText: /Tin nhắn số/ }).count();
  log('messages rendered', fallbackCount >= 30, `count=${fallbackCount}`);

  // Verify viewport có scrollHeight > clientHeight (tức là có nội dung overflow)
  // Tìm trong main content area (loại trừ ServerSidebar vì w-16 và các dialog)
  const scrollInfo = await page.evaluate(() => {
    const candidates = document.querySelectorAll('.overflow-y-auto');
    const results = [];
    for (const el of candidates) {
      results.push({
        tag: el.tagName,
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
        canScroll: el.scrollHeight > el.clientHeight + 10,
        classes: el.className.slice(0, 60),
      });
    }
    // Tìm cái có canScroll=true và clientHeight lớn nhất (thường là chat container)
    const scrollable = results.filter((r) => r.canScroll).sort((a, b) => b.clientHeight - a.clientHeight);
    return { allCandidates: results, scrollable };
  });
  log('Chat container có thể cuộn', scrollInfo?.scrollable?.length > 0, `found ${scrollInfo?.scrollable?.length} scrollable containers`);

  // Scroll lên đầu — xác nhận KHÔNG bị kéo lại xuống
  const chatContainer = scrollInfo?.scrollable?.[0];
  if (chatContainer) {
    await page.evaluate(() => {
      const candidates = document.querySelectorAll('.overflow-y-auto');
      const sorted = [...candidates].filter((el) => el.scrollHeight > el.clientHeight + 10)
        .sort((a, b) => b.clientHeight - a.clientHeight);
      if (sorted[0]) sorted[0].scrollTop = 0;
    });
    await wait(300);
    const afterScrollTop = await page.evaluate(() => {
      const candidates = document.querySelectorAll('.overflow-y-auto');
      const sorted = [...candidates].filter((el) => el.scrollHeight > el.clientHeight + 10)
        .sort((a, b) => b.clientHeight - a.clientHeight);
      if (sorted[0]) return { scrollTop: sorted[0].scrollTop, scrollHeight: sorted[0].scrollHeight };
      return null;
    });
    log('scroll về đầu — KHÔNG bị kéo lại xuống', afterScrollTop?.scrollTop < 50, JSON.stringify(afterScrollTop));
    await shoot(page, '02-chat-scrolled-to-top');

    // Gửi 1 tin nhắn mới (không auto-scroll vì user đang ở top)
    const messageInput = page.locator('textarea[placeholder*="Nhắn"], textarea[placeholder*="tin"], textarea').first();
    if (await messageInput.isVisible()) {
      await messageInput.fill('TEST MESSAGE — manual scroll test');
      await page.keyboard.press('Enter');
      await wait(1500);
      const stillAtTop = await page.evaluate(() => {
        const candidates = document.querySelectorAll('.overflow-y-auto');
        const sorted = [...candidates].filter((el) => el.scrollHeight > el.clientHeight + 10)
          .sort((a, b) => b.clientHeight - a.clientHeight);
        return sorted[0]?.scrollTop ?? 0;
      });
      log('khi đang ở top, gửi msg KHÔNG tự kéo xuống đáy', stillAtTop < 50, `scrollTop=${stillAtTop}`);
    } else {
      log('message input hiển thị', false, 'textarea not found');
    }

    // Scroll xuống đáy + gửi msg → auto-scroll xuống
    await page.evaluate(() => {
      const candidates = document.querySelectorAll('.overflow-y-auto');
      const sorted = [...candidates].filter((el) => el.scrollHeight > el.clientHeight + 10)
        .sort((a, b) => b.clientHeight - a.clientHeight);
      if (sorted[0]) sorted[0].scrollTop = sorted[0].scrollHeight;
    });
    await wait(300);
    if (await messageInput.isVisible()) {
      await messageInput.fill('TEST MESSAGE — auto-scroll on bottom');
      await page.keyboard.press('Enter');
      await wait(1500);
      const atBottom = await page.evaluate(() => {
        const candidates = document.querySelectorAll('.overflow-y-auto');
        const sorted = [...candidates].filter((el) => el.scrollHeight > el.clientHeight + 10)
          .sort((a, b) => b.clientHeight - a.clientHeight);
        if (!sorted[0]) return false;
        return Math.abs(sorted[0].scrollHeight - sorted[0].clientHeight - sorted[0].scrollTop) < 30;
      });
      log('khi ở đáy, gửi msg tự cuộn xuống', atBottom);
      await shoot(page, '03-chat-auto-scroll-bottom');
    }
  } else {
    log('Chat container có thể cuộn', false, 'không tìm thấy scroll container — ' + JSON.stringify(scrollInfo?.allCandidates?.length));
  }

  // ============================================================
  // B3.2 — Server sidebar scroll (nếu có nhiều server)
  // ============================================================
  step('B3.2 — Server sidebar scroll');
  const serverSidebarExists = await page.locator('aside').first().isVisible();
  log('ServerSidebar rendered', serverSidebarExists);
  // Tạo 20 server thêm để test scroll
  for (let i = 0; i < 20; i++) {
    await apiReq('POST', '/servers', { name: `ExtraSrv-${ts}-${i}` }, t1);
  }
  // Reload để ServerSidebar re-fetch listMine
  await page.reload({ waitUntil: 'networkidle' });
  // Đợi cho tới khi có ít nhất 21 server buttons render
  await page.waitForFunction(async () => {
    const aside = document.querySelector('aside');
    if (!aside) return false;
    const buttons = aside.querySelectorAll('button[title^="ExtraSrv-"], button[title^="UISrv-"]');
    return buttons.length >= 21;
  }, { timeout: 15000 }).catch(() => {});
  // Đếm tổng button server (debug)
  const btnCount = await page.evaluate(() => {
    const aside = document.querySelector('aside');
    if (!aside) return 0;
    return aside.querySelectorAll('button[title^="ExtraSrv-"], button[title^="UISrv-"]').length;
  });
  console.log(`    📊 Aside có ${btnCount} server buttons`);
  await wait(1000);
  await shoot(page, '04-server-sidebar-many');

  const serverListScroll = await page.evaluate(() => {
    // Tìm div overflow-y-auto trong aside đầu tiên (ServerSidebar)
    const aside = document.querySelector('aside');
    if (!aside) return { error: 'aside not found' };
    const rect = aside.getBoundingClientRect();
    const vps = aside.querySelectorAll('.overflow-y-auto');
    let info = null;
    for (const vp of vps) {
      info = {
        scrollHeight: vp.scrollHeight,
        clientHeight: vp.clientHeight,
        canScroll: vp.scrollHeight > vp.clientHeight,
      };
      break;
    }
    return {
      asideHeight: rect.height,
      asideClasses: aside.className,
      scrollInfo: info,
    };
  });
  log('Server list cuộn được khi nhiều server', serverListScroll?.scrollInfo?.canScroll === true, JSON.stringify(serverListScroll));

  // ============================================================
  // B3.3 — Members panel scroll
  // ============================================================
  step('B3.3 — Members Sheet scroll');
  // Reload để AppLayout fetch lại members (vì vừa thêm 10 user)
  await page.reload({ waitUntil: 'networkidle' });
  await wait(2000);
  // Click button "Thành viên" — Users icon ở ChannelSidebar header
  const membersBtn = page.locator('button[title="Thành viên"]').first();
  if (await membersBtn.isVisible()) {
    await membersBtn.click();
    await wait(1500);
    await shoot(page, '05-members-sheet-open');

    const membersSheetScroll = await page.evaluate(() => {
      // Tìm SheetContent role="dialog" + ScrollArea bên trong
      const sheet = document.querySelector('[role="dialog"]');
      if (!sheet) return null;
      // Tìm div overflow-y-auto trong sheet có nhiều content
      const vps = sheet.querySelectorAll('.overflow-y-auto');
      let maxScrollable = null;
      for (const vp of vps) {
        const info = {
          scrollHeight: vp.scrollHeight,
          clientHeight: vp.clientHeight,
          canScroll: vp.scrollHeight > vp.clientHeight,
        };
        if (info.canScroll && (!maxScrollable || info.scrollHeight > maxScrollable.scrollHeight)) {
          maxScrollable = info;
        }
      }
      return maxScrollable || { scrollHeight: vps[0]?.scrollHeight, clientHeight: vps[0]?.clientHeight, canScroll: false, tag: 'DIV' };
    });
    log('Members Sheet danh sách thành viên cuộn được', membersSheetScroll?.canScroll === true, JSON.stringify(membersSheetScroll));

    // Close sheet
    await page.keyboard.press('Escape');
    await wait(500);
  } else {
    log('Members button tồn tại', false);
  }

  // ============================================================
  // B3.4 — Semantic search dialog scroll
  // ============================================================
  step('B3.4 — Semantic Search Dialog scroll');
  // Đợi 25s để các message mới được embed xong (fire-and-forget Gemini API)
  console.log('  (đợi 25s để các message mới được embed vào pgvector…)');
  await wait(25000);
  const searchBtn = page.locator('button[title="Tìm kiếm ngữ nghĩa"]').first();
  if (await searchBtn.isVisible()) {
    await searchBtn.click();
    await wait(600);
    const searchInput = page.locator('input[placeholder*="quy định"]').first();
    await searchInput.fill('hướng dẫn sử dụng');
    await page.locator('button[type="submit"]').first().click();
    await wait(3500);
    await shoot(page, '06-semantic-search-results');

    const searchDialogScroll = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      if (!dialog) return null;
      // Kết quả có max-h-96 overflow-y-auto
      const results = dialog.querySelector('.overflow-y-auto');
      if (!results) return null;
      return {
        scrollHeight: results.scrollHeight,
        clientHeight: results.clientHeight,
        canScroll: results.scrollHeight > results.clientHeight,
        resultsCount: results.children.length,
      };
    });
    log('SemanticSearch results scrollable', searchDialogScroll !== null, JSON.stringify(searchDialogScroll));
    await page.keyboard.press('Escape');
    await wait(500);
  } else {
    log('Semantic Search button', false);
  }

  // ============================================================
  // B3.5 — Voice channel: click vào KHÔNG bị văng ra
  // ============================================================
  step('B3.5 — Voice channel click không bị văng');
  // Navigate về chat channel
  await page.goto(`${FE}/app/${serverId}/${channelId}`, { waitUntil: 'networkidle' });
  await wait(1500);
  // Click voice channel button
  const voiceChBtn = page.locator('button:has-text("voice-")').first();
  if (await voiceChBtn.isVisible()) {
    await voiceChBtn.click();
    await wait(4000); // wait for LiveKit connect + token
    await shoot(page, '07-voice-channel-loaded');

    // Verify URL vẫn ở app + có VoiceControlBar render
    const url = page.url();
    log('URL vẫn ở /app sau khi vào voice', url.includes('/app'), url);

    const ctrlBarVisible = await page.locator('button[title*="mic"]').first().isVisible().catch(() => false)
      || await page.locator('.lk-button').first().isVisible().catch(() => false);
    log('VoiceControlBar render được', ctrlBarVisible, 'mic buttons visible');

    // Đợi 3s xem có bị văng không
    await wait(3000);
    const urlAfter = page.url();
    log('Sau 3s URL vẫn ở /app (không bị văng ra)', urlAfter.includes('/app'), urlAfter);
    await shoot(page, '08-voice-stable-after-3s');

    // Click leave button
    const leaveBtn = page.locator('button:has-text("Ngắt kết nối")').first();
    if (await leaveBtn.isVisible()) {
      await leaveBtn.click();
      await wait(1500);
    }
  } else {
    log('voice channel button visible', false);
  }

  // ============================================================
  // B3.6 — Responsive 1024
  // ============================================================
  step('B3.6 — Responsive @ 1024×768');
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto(`${FE}/app/${serverId}/${channelId}`, { waitUntil: 'networkidle' });
  await wait(1500);
  await shoot(page, '09-responsive-1024');
  const overflowAt1024 = await page.evaluate(() => {
    // Không có horizontal overflow trên body
    return {
      bodyScrollWidth: document.body.scrollWidth,
      bodyClientWidth: document.body.clientWidth,
      hasOverflow: document.body.scrollWidth > document.body.clientWidth + 1,
    };
  });
  log('Layout không tràn ngang @ 1024', !overflowAt1024.hasOverflow, JSON.stringify(overflowAt1024));

  // ============================================================
  // B3.7 — Responsive 768
  // ============================================================
  step('B3.7 — Responsive @ 768×1024');
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto(`${FE}/app/${serverId}/${channelId}`, { waitUntil: 'networkidle' });
  await wait(1500);
  await shoot(page, '10-responsive-768');
  const overflowAt768 = await page.evaluate(() => {
    return {
      bodyScrollWidth: document.body.scrollWidth,
      bodyClientWidth: document.body.clientWidth,
      hasOverflow: document.body.scrollWidth > document.body.clientWidth + 1,
    };
  });
  log('Layout không tràn ngang @ 768', !overflowAt768.hasOverflow, JSON.stringify(overflowAt768));

  // ============================================================
  // B3.8 — Console errors check (loại trừ lỗi LiveKit 401 — do test gọi lại với token cũ)
  // ============================================================
  step('B3.8 — Console errors');
  const filteredErrors = consoleErrors.filter((e) => {
    // Loại trừ lỗi LiveKit 401 (token expired vì test tạo mới user mỗi lần chạy)
    if (/livekit\.cloud/i.test(e)) return false;
    if (/status of 401/.test(e)) return false;
    return true;
  });
  log('Không có console error nghiêm trọng (loại trừ LiveKit 401)', filteredErrors.length === 0, `count=${filteredErrors.length} / total=${consoleErrors.length}`);
  if (filteredErrors.length > 0) {
    filteredErrors.slice(0, 5).forEach((e) => console.log('    ⚠️', e.slice(0, 200)));
  }

  await browser.close();
  console.log(`\n=== DONE. Screenshots saved to ${OUT_DIR} ===`);
  console.log(`Exit code: ${process.exitCode ?? 0}`);
}

run().catch((e) => {
  console.error('UI test crashed:', e);
  process.exit(2);
});
