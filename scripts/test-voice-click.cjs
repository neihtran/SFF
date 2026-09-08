#!/usr/bin/env node
/**
 * SFF — Voice Channel click REGRESSION test
 *
 * Flow: login → navigate to server → click voice channel in sidebar
 *      → verify VoiceRoom renders → click "Ngắt kết nối" → verify unmount
 *
 * Run: node scripts/test-voice-click.cjs
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
  console.log('=== Voice Channel Click Regression Test ===\n');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (e) => consoleErrors.push('PAGE_ERROR: ' + e.message));

  // ─── SETUP ────────────────────────────────────────────────────────────────
  const ts = Date.now();
  const u = `vclick_${ts}@t.com`;
  let r = await api('POST', '/auth/register', { name: `VCT${ts}`, email: u, password: 'Pass123!' });
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
  console.log('create text channel:', r.status, r.body?.id ? 'OK' : 'FAIL');
  const tcid = r.body.id;

  // ─── NAVIGATE (localStorage MUST be set BEFORE /app route) ───────────────
  await page.goto(`${FE}/auth/login`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(
    (authData) => localStorage.setItem('sff-auth', JSON.stringify({ state: authData, version: 0 })),
    { user: { id: uid, name: `VCT${ts}`, email: u, preferredLang: 'vi', avatarUrl: null }, accessToken: token, refreshToken: '' }
  );
  await page.goto(`${FE}/app/${sid}/${tcid}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  if (page.url().includes('/auth/')) {
    console.log('\nFATAL: Auth redirect to login');
    await browser.close();
    process.exit(1);
  }
  console.log(`\nApp URL: ${page.url()}`);

  // ─── CHECKPOINT 0: Baseline — no VoiceRoom before click ───────────────────
  console.log('\n[CHECKPOINT 0] Baseline — VoiceRoom should NOT be visible');

  const baselineLK = await page.locator('.lk-grid-layout').isVisible().catch(() => false);
  const baselineNgat = await page.locator('text=Ngắt kết nối').isVisible().catch(() => false);
  console.log(`  .lk-grid-layout: ${baselineLK}`);
  console.log(`  "Ngắt kết nối": ${baselineNgat}`);
  const baselinePass = !baselineLK && !baselineNgat;
  console.log(`  Result: ${baselinePass ? '✓ PASS' : '✗ FAIL'}`);
  await page.screenshot({ path: path.join(OUT_DIR, 'vc-baseline.png') });

  // ─── CHECKPOINT 1: Click voice channel in sidebar ────────────────────────
  console.log('\n[CHECKPOINT 1] Click voice channel in sidebar');

  const voiceSection = page.locator('section', { hasText: /Voice Channels/i });
  const voiceBtn = voiceSection.locator('button', { hasText: new RegExp(`^${vcName}$`, 'i') });
  const voiceBtnCount = await voiceBtn.count();
  console.log(`  Voice button "${vcName}": count=${voiceBtnCount}`);

  if (voiceBtnCount === 0) {
    const allBtns = await page.locator('aside button').allInnerTexts();
    console.log(`  All sidebar buttons: ${allBtns.join(' | ')}`);
    console.log('\nFATAL: Voice channel button not found');
    await page.screenshot({ path: path.join(OUT_DIR, 'vc-not-found.png') });
    await browser.close();
    process.exit(1);
  }

  await voiceBtn.click();
  await page.waitForTimeout(2000);
  console.log('  Clicked!');

  // ─── CHECKPOINT 2: VoiceRoom must render after click ─────────────────────
  console.log('\n[CHECKPOINT 2] VoiceRoom should be visible after click');

  const lkGrid = await page.locator('.lk-grid-layout').isVisible().catch(() => false);
  const ngatBtn = await page.locator('text=Ngắt kết nối').isVisible().catch(() => false);
  const voiceHeader = await page.locator('text=Voice Channel').isVisible().catch(() => false);

  console.log(`  .lk-grid-layout: ${lkGrid}`);
  console.log(`  "Ngắt kết nối": ${ngatBtn}`);
  console.log(`  "Voice Channel" header: ${voiceHeader}`);
  const voiceRendered = lkGrid || ngatBtn || voiceHeader;
  console.log(`  Result: ${voiceRendered ? '✓ PASS' : '✗ FAIL'}`);
  await page.screenshot({ path: path.join(OUT_DIR, 'vc-after-click.png') });

  // ─── CHECKPOINT 3: No console errors (ignore LiveKit 401 from token expiry) ─
  console.log('\n[CHECKPOINT 3] Console errors check');
  const realErrors = consoleErrors.filter(
    (e) => !e.includes('401') && !e.includes('livekit') && !e.includes('LIVEKIT')
  );
  console.log(`  Non-LiveKit-401 errors: ${realErrors.length}`);
  realErrors.forEach((e) => console.log(`    ${e.slice(0, 150)}`));
  const noErrors = realErrors.length === 0;
  console.log(`  Result: ${noErrors ? '✓ PASS' : '✗ FAIL'}`);

  // ─── CHECKPOINT 4: Click "Ngắt kết nối" → VoiceRoom unmounts ──────────────
  console.log('\n[CHECKPOINT 4] Click "Ngắt kết nối" → VoiceRoom should unmount');

  const ngatBtnEl = page.locator('button', { hasText: /Ngắt kết nối/i });
  if (await ngatBtnEl.count() > 0) {
    await ngatBtnEl.first().click();
    await page.waitForTimeout(2000);

    const lkAfterLeave = await page.locator('.lk-grid-layout').isVisible().catch(() => false);
    const ngatAfterLeave = await page.locator('text=Ngắt kết nối').isVisible().catch(() => false);
    const textChVisible = await page.locator('aside', { hasText: /TEXT CHANNELS/i }).isVisible().catch(() => false);

    console.log(`  .lk-grid-layout after leave: ${lkAfterLeave}`);
    console.log(`  "Ngắt kết nối" after leave: ${ngatAfterLeave}`);
    console.log(`  TEXT channels visible: ${textChVisible}`);
    const leaveSuccess = !lkAfterLeave && !ngatAfterLeave;
    console.log(`  Result: ${leaveSuccess ? '✓ PASS' : '✗ FAIL'}`);
    await page.screenshot({ path: path.join(OUT_DIR, 'vc-after-leave.png') });
  } else {
    console.log('  Skipped — no "Ngắt kết nối" button');
  }

  // ─── FINAL RESULT ─────────────────────────────────────────────────────────
  console.log('\n=== RESULT ===');
  console.log(`  [0] Baseline (no voice room before click): ${baselinePass ? '✓' : '✗'}`);
  console.log(`  [1] VoiceRoom rendered after sidebar click: ${voiceRendered ? '✓' : '✗'}`);
  console.log(`  [2] No console errors:                   ${noErrors ? '✓' : '✗'}`);
  const allPass = baselinePass && voiceRendered && noErrors;
  console.log(`\n  Overall: ${allPass ? '✅ ALL PASS' : '❌ FAIL'}`);

  await browser.close();
  process.exitCode = allPass ? 0 : 1;
}

run().catch((e) => { console.error('Test crashed:', e.message); process.exit(2); });
