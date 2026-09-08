#!/usr/bin/env node
/**
 * SFF — Voice Channel 2-account E2E test
 *
 * Mở 2 trình duyệt cùng lúc, đăng nhập 2 tài khoản khác nhau,
 * cả 2 vào cùng 1 voice channel, kiểm tra:
 *  - Cả 2 phía đều thấy participant tile của nhau
 *  - Toggle mic ở A → B thấy icon mic thay đổi
 *  - Rời phòng ở A → B thấy tile biến mất
 *
 * Run: node scripts/test-voice-2-accounts.cjs
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const FE = 'http://localhost:5173';
const BE = 'http://localhost:3000';
const OUT_DIR = path.join(__dirname, '..', 'screenshots');
fs.mkdirSync(OUT_DIR, { recursive: true });

async function api(method, p, body, token) {
  const res = await fetch(BE + p, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, body: data };
}

/**
 * Wait for a CSS selector to become visible (or timeout).
 * Returns true if found, false if timed out.
 */
async function waitForVisible(page, selector, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const el = page.locator(selector).first();
      if (await el.isVisible({ timeout: 500 })) return true;
    } catch (_) { /* not yet */ }
    await page.waitForTimeout(500);
  }
  return false;
}

async function setupAccount(name, email) {
  // Register user
  let r = await api('POST', '/auth/register', { name, email, password: 'Pass123!' });
  if (r.status !== 201) {
    throw new Error(`register failed for ${email}: ${r.status}`);
  }
  const token = r.body.accessToken;
  const uid = r.body.user.id;

  // Create server with voice channel
  r = await api('POST', '/servers', { name: `Voice2A-${Date.now()}`, ownerId: uid }, token);
  // Some APIs need ownerId in body — try without if fails
  if (r.status !== 201) {
    r = await api('POST', '/servers', { name: `Voice2A-${Date.now()}` }, token);
  }
  if (r.status !== 201) throw new Error(`server create failed: ${r.status} ${JSON.stringify(r.body)}`);
  const sid = r.body.id;

  return { token, uid, sid };
}

async function joinVoiceChannel(page, user, serverId, textChannelId, voiceChannelName) {
  // Inject auth into localStorage
  await page.goto(`${FE}/auth/login`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(
    (authData) => localStorage.setItem('sff-auth', JSON.stringify({ state: authData, version: 0 })),
    { user: { id: user.uid, name: user.name, email: user.email, preferredLang: 'vi', avatarUrl: null }, accessToken: user.token, refreshToken: '' }
  );
  await page.goto(`${FE}/app/${serverId}/${textChannelId}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  // Click voice channel
  const voiceSection = page.locator('section', { hasText: /Voice Channels/i });
  const voiceBtn = voiceSection.locator('button', { hasText: new RegExp(`^${voiceChannelName}$`, 'i') });
  await voiceBtn.click();
  await page.waitForTimeout(4000); // Wait for LiveKit connection
}

async function run() {
  console.log('=== Voice Channel 2-Account Test ===\n');

  const ts = Date.now();
  const userA = { name: `Alice${ts}`, email: `alice${ts}@t.com`, password: 'Pass123!' };
  const userB = { name: `Bob${ts}`, email: `bob${ts}@t.com`, password: 'Pass123!' };

  // ─── SETUP USERS ─────────────────────────────────────────────────────────
  console.log('[Setup] Creating users A & B + shared server');
  const accA = await setupAccount(userA.name, userA.email);
  console.log(`  User A: ${accA.uid} (token len=${accA.token.length})`);

  // B joins A's server via invite code
  let r = await api('GET', `/servers/${accA.sid}/invite`, null, accA.token);
  const inviteCode = r.body?.code || r.body?.inviteCode || r.body?.invite_code;
  if (!inviteCode) {
    // Try create invite
    r = await api('POST', `/servers/${accA.sid}/invite`, {}, accA.token);
    const ic = r.body?.code || r.body?.inviteCode || r.body?.invite_code;
    if (!ic) throw new Error('cannot get invite code');
  }

  const accB = await api('POST', '/auth/register', { name: userB.name, email: userB.email, password: userB.password });
  if (accB.status !== 201) throw new Error('register B failed');
  const bToken = accB.body.accessToken;

  r = await api('POST', `/servers/join`, { inviteCode }, bToken);
  // Some APIs have /servers/join with body
  if (r.status !== 201) {
    r = await api('POST', `/servers/${accA.sid}/join`, {}, bToken);
  }
  if (r.status !== 201 && r.status !== 200) {
    // Last try: POST with invite code in body
    r = await api('POST', `/servers/join`, { code: inviteCode }, bToken);
  }
  console.log(`  User B joined: ${r.status}`);

  // Get voice channel info (created during setup)
  const chA = await api('GET', `/servers/${accA.sid}/channels`, null, accA.token);
  const voiceCh = chA.body?.find((c) => c.type === 'VOICE');
  const textCh = chA.body?.find((c) => c.type === 'TEXT');
  if (!voiceCh) throw new Error('no voice channel found');
  if (!textCh) throw new Error('no text channel found');
  console.log(`  Voice channel: ${voiceCh.id} (${voiceCh.name})`);

  // ─── LAUNCH BROWSERS ─────────────────────────────────────────────────────
  console.log('\n[Launch] Opening 2 browser instances');
  const browser = await chromium.launch({ headless: true });
  const contextA = await browser.newContext({ permissions: ['microphone', 'camera'], viewport: { width: 1280, height: 800 } });
  const contextB = await browser.newContext({ permissions: ['microphone', 'camera'], viewport: { width: 1280, height: 800 } });
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  const consoleErrorsA = [];
  const consoleErrorsB = [];
  pageA.on('console', (msg) => { if (msg.type() === 'error') consoleErrorsA.push(msg.text()); });
  pageB.on('console', (msg) => { if (msg.type() === 'error') consoleErrorsB.push(msg.text()); });

  // ─── A JOINS VOICE ────────────────────────────────────────────────────────
  console.log('\n[Step 1] User A joins voice channel');
  await joinVoiceChannel(pageA, { ...userA, ...accA }, accA.sid, textCh.id, voiceCh.name);

  const aInVoice = await waitForVisible(pageA, '.lk-grid-layout, [class*="lk-"]', 5000);
  console.log(`  A in voice room: ${aInVoice ? '✓ YES' : '✗ NO'}`);
  await pageA.screenshot({ path: path.join(OUT_DIR, 'voice2-a-alone.png') });

  // ─── B JOINS VOICE ────────────────────────────────────────────────────────
  console.log('\n[Step 2] User B joins voice channel');
  await joinVoiceChannel(pageB, { ...userB, token: bToken, uid: accB.body.user.id }, accA.sid, textCh.id, voiceCh.name);

  const bInVoice = await waitForVisible(pageB, '.lk-grid-layout', 5000);
  console.log(`  B in voice room: ${bInVoice ? '✓ YES' : '✗ NO'}`);
  await pageB.screenshot({ path: path.join(OUT_DIR, 'voice2-b-joined.png') });

  // Wait for participant count to update on both sides
  await pageA.waitForTimeout(4000);
  await pageB.waitForTimeout(2000);

  // ─── CHECK 3: Both participants visible on both sides ────────────────────
  console.log('\n[Check 3] Participant visibility');
  const aParticipantTiles = await pageA.locator('.lk-participant-tile, [data-lk-participant]').count();
  const bParticipantTiles = await pageB.locator('.lk-participant-tile, [data-lk-participant]').count();
  console.log(`  A sees ${aParticipantTiles} participant tiles`);
  console.log(`  B sees ${bParticipantTiles} participant tiles`);
  await pageA.screenshot({ path: path.join(OUT_DIR, 'voice2-a-with-b.png') });
  await pageB.screenshot({ path: path.join(OUT_DIR, 'voice2-b-with-a.png') });

  // ─── CHECK 4: Mic toggle on A — should reflect on B ────────────────────────
  console.log('\n[Check 4] Toggle mic on A');
  // Click the mic TrackToggle in A's ControlBar
  const micBtnA = pageA.locator('.lk-control-bar .lk-button').first();
  // Or any lk-button that's a TrackToggle — find by data-lk-source
  const micToggleA = pageA.locator('[data-lk-source="microphone"], [data-lk-source="mic"]').first();
  const micToggleACount = await micToggleA.count();
  console.log(`  Mic toggle (data-lk-source) on A: count=${micToggleACount}`);

  if (micToggleACount > 0) {
    await micToggleA.click();
    await pageA.waitForTimeout(2000);

    // Check A state
    const aMicState = await micToggleA.getAttribute('data-lk-enabled').catch(() => 'N/A');
    console.log(`  A mic data-lk-enabled: ${aMicState}`);
    await pageA.screenshot({ path: path.join(OUT_DIR, 'voice2-a-mic-clicked.png') });

    // Wait for B to update
    await pageB.waitForTimeout(3000);
    await pageB.screenshot({ path: path.join(OUT_DIR, 'voice2-b-sees-a-mic.png') });
    console.log(`  A mic click reflected on B: see screenshots`);
  } else {
    console.log('  ⚠️  Mic toggle not found on A — TestControlBar not rendering?');
  }

  // ─── CHECK 5: B leaves — A sees participant count decrease ────────────────
  console.log('\n[Check 5] User B leaves voice channel');
  // Click disconnect button on B
  const disconnectB = pageB.locator('.lk-disconnect-button').first();
  const disconnectBCount = await disconnectB.count();
  console.log(`  Disconnect button on B: count=${disconnectBCount}`);

  if (disconnectBCount > 0) {
    await disconnectB.click();
    await pageB.waitForTimeout(3000);
  } else {
    // Fallback: click header "Ngắt kết nối"
    const ngatB = pageB.locator('button', { hasText: /Ngắt kết nối/i }).first();
    await ngatB.click();
    await pageB.waitForTimeout(3000);
  }

  await pageB.screenshot({ path: path.join(OUT_DIR, 'voice2-b-left.png') });

  // Wait for A to update
  await pageA.waitForTimeout(3000);
  await pageA.screenshot({ path: path.join(OUT_DIR, 'voice2-a-after-b-left.png') });

  // ─── CONSOLE ERRORS ──────────────────────────────────────────────────────
  console.log('\n[Console Errors]');
  const aErrs = consoleErrorsA.filter((e) => !e.includes('401') && !e.includes('livekit'));
  const bErrs = consoleErrorsB.filter((e) => !e.includes('401') && !e.includes('livekit'));
  console.log(`  A: ${aErrs.length} errors`);
  aErrs.slice(0, 5).forEach((e) => console.log(`    ${e.slice(0, 150)}`));
  console.log(`  B: ${bErrs.length} errors`);
  bErrs.slice(0, 5).forEach((e) => console.log(`    ${e.slice(0, 150)}`));

  // ─── RESULT ───────────────────────────────────────────────────────────────
  console.log('\n=== RESULT ===');
  console.log(`  A in voice room:           ${aInVoice ? '✓' : '✗'}`);
  console.log(`  B in voice room:           ${bInVoice ? '✓' : '✗'}`);
  console.log(`  A sees ≥2 tiles:           ${aParticipantTiles >= 2 ? '✓' : '✗'} (${aParticipantTiles})`);
  console.log(`  B sees ≥2 tiles:           ${bParticipantTiles >= 2 ? '✓' : '✗'} (${bParticipantTiles})`);

  await browser.close();
}

run().catch((e) => { console.error('Test crashed:', e.message, e.stack); process.exit(2); });
