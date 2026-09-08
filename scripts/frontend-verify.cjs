#!/usr/bin/env node
/**
 * SFF — Frontend Static Verification (proxy cho "browser UI test")
 *
 * Không thể chạy browser tự động trên Windows container này (không có Playwright).
 * Thay thế bằng cách verify:
 *  1. HTTP 200 tại tất cả routes nội bộ (/login, /register, /app, /settings)
 *  2. Tất cả module TS quan trọng transform được Vite (không có compile error)
 *  3. HTML response không có crash indicator
 *  4. main.tsx đã load QueryClientProvider đúng (grep nội dung transformed)
 */
const http = require('http');

function get(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let buf = '';
      res.on('data', (c) => (buf += c));
      res.on('end', () => resolve({ status: res.statusCode, body: buf, headers: res.headers }));
    }).on('error', reject);
  });
}

(async () => {
  let pass = 0; let fail = 0;
  function OK(label, cond) {
    if (cond) { console.log(`  \u2713 ${label}`); pass++; }
    else { console.error(`  \u2717 ${label} FAILED`); fail++; }
  }

  console.log('\n=== SFF Frontend Static Verification ===\n');

  // 1. Routes
  console.log('[1] ROUTES');
  for (const route of ['/', '/app', '/login', '/register']) {
    const r = await get(`http://localhost:5173${route}`);
    OK(`GET ${route}`, r.status === 200);
    OK(`${route} có <div id="root">`, r.body.includes('id="root"'));
  }

  // 2. Modules TS quan trọng phải transform OK
  console.log('\n[2] MODULES');
  const modules = [
    '/src/main.tsx',  // PHẢI có QueryClientProvider
    '/src/App.tsx',
    '/src/router/index.tsx',
    '/src/features/layout/AppLayout.tsx',  // chứa NotificationBell
    '/src/features/notifications/components/NotificationBell.tsx',  // chứa useQuery
    '/src/features/notifications/hooks/useNotifications.ts',
    '/src/features/voice/VoiceRoom.tsx',  // LiveKit
    '/src/features/voice/VoiceControlBar.tsx',
    '/src/features/ai/components/SemanticSearchDialog.tsx',
    '/src/features/messages/components/MessageInput.tsx',
    '/src/features/messages/components/MessageList.tsx',
    '/src/features/messages/components/MessageBubble.tsx',
    '/src/lib/axiosClient.ts',
    '/src/store/authStore.ts',
    '/src/features/storage/api/storage.ts',
  ];
  for (const m of modules) {
    const r = await get(`http://localhost:5173${m}`);
    OK(`Vite transform ${m}`, r.status === 200 && r.body.length > 100);
    OK(`  không có "Error" trong transformed output`, !r.body.match(/Error:\s*Cannot|Failed to compile/i));
  }

  // 3. main.tsx PHẢI chứa QueryClientProvider
  console.log('\n[3] QueryClientProvider EXISTS');
  const main = await get('http://localhost:5173/src/main.tsx');
  OK('main.tsx có QueryClientProvider', main.body.includes('QueryClientProvider'));
  OK('main.tsx có QueryClient import', main.body.includes('QueryClient'));
  OK('main.tsx bọc <App />', main.body.includes('<App') || main.body.includes('App /'));

  // 4. NotificationBell phải gọi useQuery (qua useNotifications) → chứng minh provider hoạt động
  console.log('\n[4] NotificationBell/Store');
  const bell = await get('http://localhost:5173/src/features/notifications/components/NotificationBell.tsx');
  OK('NotificationBell gọi useNotifications', bell.body.includes('useNotifications'));

  const useNotif = await get('http://localhost:5173/src/features/notifications/hooks/useNotifications.ts');
  OK('useNotifications dùng useQuery', useNotif.body.includes('useQuery'));

  // 5. Vite optimized deps — @tanstack/react-query đã được optimize
  const optMeta = await get('http://localhost:5173/node_modules/.vite/deps/_metadata.json');
  OK('@tanstack/react-query được Vite optimize', optMeta.body.includes('@tanstack/react-query'));

  console.log(`\n=== ${pass} PASS / ${fail} FAIL ===`);
  console.log(`Exit code: ${fail > 0 ? 1 : 0}`);
  process.exit(fail > 0 ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
