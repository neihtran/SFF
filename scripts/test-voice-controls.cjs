#!/usr/bin/env node
/**
 * SFF — Voice Controls debug test
 *
 * Test: login → enter voice room → click mic button → check state change + console
 * Run: node scripts/test-voice-controls.cjs
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

async function run() {
  console.log('=== Voice Controls Debug Test ===\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    permissions: ['microphone', 'camera'],
  });
  const page = await context.newPage({ viewport: { width: 1440, height: 900 } });

  const allLogs = [];
  page.on('console', (msg) => {
    allLogs.push({ type: msg.type(), text: msg.text() });
  });
  page.on('pageerror', (e) => allLogs.push({ type: 'error', text: 'PAGE_ERROR: ' + e.message }));
  page.on('request', (req) => {
    if (req.url().includes('livekit') || req.url().includes('wss')) {
      allLogs.push({ type: 'log', text: `[NET] ${req.method()} ${req.url()}` });
    }
  });
  page.on('response', (res) => {
    if (res.url().includes('livekit') || res.url().includes('wss')) {
      allLogs.push({ type: 'log', text: `[NET-RES] ${res.status()} ${res.url()}` });
    }
  });

  // ─── SETUP ────────────────────────────────────────────────────────────────
  const ts = Date.now();
  const u = `vctrl_${ts}@t.com`;
  let r = await api('POST', '/auth/register', { name: `VCtrl${ts}`, email: u, password: 'Pass123!' });
  console.log('register:', r.status, r.body?.accessToken ? 'OK' : 'FAIL');
  const token = r.body.accessToken;
  const uid = r.body.user.id;

  r = await api('POST', '/servers', { name: `VCSrv${ts}` }, token);
  console.log('create server:', r.status, r.body?.id ? 'OK' : 'FAIL');
  const sid = r.body.id;

  r = await api('POST', `/servers/${sid}/channels`, { name: `vc${ts}`, type: 'VOICE' }, token);
  console.log('create voice channel:', r.status, r.body?.id ? 'OK' : 'FAIL');
  const vcid = r.body.id;
  const vcName = r.body.name;

  r = await api('POST', `/servers/${sid}/channels`, { name: `tc${ts}`, type: 'TEXT' }, token);
  const tcid = r.body.id;

  // ─── NAVIGATE ────────────────────────────────────────────────────────────
  await page.goto(`${FE}/auth/login`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(
    (authData) => localStorage.setItem('sff-auth', JSON.stringify({ state: authData, version: 0 })),
    { user: { id: uid, name: `VCtrl${ts}`, email: u, preferredLang: 'vi', avatarUrl: null }, accessToken: token, refreshToken: '' }
  );
  await page.goto(`${FE}/app/${sid}/${tcid}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  // Click voice channel
  const voiceSection = page.locator('section', { hasText: /Voice Channels/i });
  const voiceBtn = voiceSection.locator('button', { hasText: new RegExp(`^${vcName}$`, 'i') });
  await voiceBtn.click();
  await page.waitForTimeout(3000);
  console.log('\nVoice room entered');

  // ─── CHECKPOINT 1: Voice room rendered ───────────────────────────────────
  const lkGrid = await page.locator('.lk-grid-layout').isVisible().catch(() => false);
  const ngatBtn = await page.locator('text=Ngắt kết nối').isVisible().catch(() => false);
  console.log(`\n[CHECK 1] VoiceRoom visible: ${lkGrid}, Ngat visible: ${ngatBtn}`);

  // ─── CHECKPOINT 2: VoiceControlBar buttons ────────────────────────────────
  // VoiceControlBar has 4 buttons: mic, cam, screen, disconnect
  // The buttons are inside .lk-control-bar or custom div
  // Mic button: has emoji 🎤 or 🎙️
  const micButtons = await page.locator('button').filter({ hasText: /🎤|🎙️/ }).all();
  console.log(`\n[CHECK 2] Mic buttons found: ${micButtons.length}`);
  for (const btn of micButtons) {
    const title = await btn.getAttribute('title').catch(() => 'N/A');
    const ariaLabel = await btn.getAttribute('aria-label').catch(() => 'N/A');
    const classes = await btn.getAttribute('class').catch(() => 'N/A');
    console.log(`  button: title="${title}" aria-label="${ariaLabel}" class="${classes?.slice(0, 60)}"`);
  }

  // Also check for lk-control-bar buttons
  const lkBarButtons = await page.locator('.lk-control-bar button').all();
  console.log(`  lk-control-bar buttons: ${lkBarButtons.length}`);
  for (const btn of lkBarButtons) {
    const title = await btn.getAttribute('title').catch(() => 'N/A');
    const classes = await btn.getAttribute('class').catch(() => 'N/A');
    const rect = await btn.boundingBox();
    console.log(`    [${rect ? `${rect.x.toFixed(0)},${rect.y.toFixed(0)}` : 'hidden'}] title="${title}" class="${classes?.slice(0, 60)}"`);
  }

  // Check if buttons are clickable (not disabled, not pointer-events:none)
  const allButtons = await page.locator('div[class*="flex"] button').all();
  console.log(`  All buttons in voice area: ${allButtons.length}`);
  for (const btn of allButtons.slice(0, 10)) {
    const text = await btn.innerText().catch(() => '?');
    const disabled = await btn.isDisabled().catch(() => false);
    const pointerEvents = await btn.evaluate((el) => window.getComputedStyle(el).pointerEvents).catch(() => 'N/A');
    const rect = await btn.boundingBox().catch(() => null);
    if (rect) {
      console.log(`    [${rect.x.toFixed(0)},${rect.y.toFixed(0)} ${rect.width.toFixed(0)}x${rect.height.toFixed(0)}] "${text}" disabled=${disabled} pointer-events=${pointerEvents}`);
    }
  }

  // ─── CHECKPOINT 3: Click mic button and check state change ───────────────
  console.log('\n[CHECK 3] Click mic button');

  // Find the mic button in VoiceControlBar (the one with 🎤/🎙️ that has toggleMic behavior)
  const micBtn = page.locator('button[title*="mic" i], button[aria-label*="mic" i], button[title*="Bật mic" i], button[title*="Tắt mic" i]').first();
  const micBtnCount = await micBtn.count();
  console.log(`  Mic button count: ${micBtnCount}`);

  if (micBtnCount > 0) {
    const beforeHTML = await micBtn.innerHTML().catch(() => 'N/A');
    const beforeDisabled = await micBtn.isDisabled().catch(() => false);
    const beforeTitle = await micBtn.getAttribute('title').catch(() => 'N/A');
    console.log(`  Before click: title="${beforeTitle}" disabled=${beforeDisabled} html="${beforeHTML}"`);

    await micBtn.click();
    console.log('  Clicked!');
    await page.waitForTimeout(1000);

    const afterHTML = await micBtn.innerHTML().catch(() => 'N/A');
    const afterTitle = await micBtn.getAttribute('title').catch(() => 'N/A');
    const afterDisabled = await micBtn.isDisabled().catch(() => false);
    console.log(`  After click: title="${afterTitle}" disabled=${afterDisabled} html="${afterHTML}"`);

    const changed = beforeTitle !== afterTitle || beforeHTML !== afterHTML;
    console.log(`  State changed: ${changed ? '✓ YES' : '✗ NO'}`);

    // Click again to toggle back
    await micBtn.click();
    await page.waitForTimeout(500);
    const backHTML = await micBtn.innerHTML().catch(() => 'N/A');
    console.log(`  After 2nd click (toggle back): html="${backHTML}"`);
  }

  // ─── CHECKPOINT 4: Check LiveKit room state ─────────────────────────────
  console.log('\n[CHECK 4] LiveKit room state via page evaluate');

  const roomState = await page.evaluate(() => {
    // Try to access the LiveKit room instance
    // The room is typically stored on the LiveKitRoom component
    const root = document.getElementById('root');
    const reactKey = Object.keys(root || {}).find((k) => k.startsWith('__react'));
    if (!reactKey) return { error: 'no react fiber' };

    // Walk the fiber tree looking for LiveKitRoom
    function findRoom(fiber) {
      if (!fiber) return null;
      if (fiber.memoizedProps?.room) return fiber.memoizedProps.room;
      if (fiber.memoizedProps?.children?.type?.name === 'LiveKitRoom') return fiber.memoizedProps.children?.props?.room;
      for (const child of fiber.child?.child ? [fiber.child, fiber.child.child].filter(Boolean) : []) {
        const found = findRoom(child);
        if (found) return found;
      }
      return findRoom(fiber.child);
    }

    const room = findRoom(root[reactKey]);
    if (!room) return { error: 'room not found in fiber tree' };

    return {
      state: room.state,
      localParticipant: {
        identity: room.localParticipant?.identity,
        isMicrophoneEnabled: room.localParticipant?.isMicrophoneEnabled,
        isCameraEnabled: room.localParticipant?.isCameraEnabled,
        isScreenShareEnabled: room.localParticipant?.isScreenShareEnabled,
        audioTracks: room.localParticipant?.audioTracks?.size,
        videoTracks: room.localParticipant?.videoTracks?.size,
      },
      remoteParticipants: room.remoteParticipants?.size,
    };
  }).catch((e) => ({ error: e.message }));
  console.log('  LiveKit room state:', JSON.stringify(roomState, null, 2));

  // ─── CHECKPOINT 5: Check network for audio track publish ─────────────────
  console.log('\n[CHECK 5] Network requests (livekit/wss)');
  const livekitLogs = allLogs.filter((l) => l.text.includes('livekit') || l.text.includes('wss') || l.text.includes('NET'));
  livekitLogs.slice(0, 20).forEach((l) => console.log(`  ${l.type}: ${l.text.slice(0, 200)}`));

  // ─── CHECKPOINT 6: All console logs ─────────────────────────────────────
  console.log('\n[CHECK 6] All console logs (errors/warnings only)');
  const errs = allLogs.filter((l) => l.type === 'error' || l.type === 'warning');
  errs.slice(0, 20).forEach((l) => console.log(`  [${l.type}] ${l.text.slice(0, 200)}`));

  // Screenshot
  await page.screenshot({ path: path.join(OUT_DIR, 'vc-controls-debug.png') });
  console.log('\n📸 vc-controls-debug.png');

  await browser.close();
}

run().catch((e) => { console.error('Test crashed:', e.message, e.stack); process.exit(2); });
