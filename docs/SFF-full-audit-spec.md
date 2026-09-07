# SFF (Say For Fun) — TÀI LIỆU TỔNG HỢP ĐẦY ĐỦ (dùng để audit lại toàn bộ codebase)

> Đưa file này cho Cursor đọc, yêu cầu: rà soát toàn bộ code hiện có so với đặc
> tả dưới đây, báo cáo phần nào đã đúng/đủ, phần nào thiếu/sai, phần nào cần
> sửa hay viết lại. KHÔNG đụng vào cấu hình Supabase và LiveKit hiện tại (đang
> chạy ổn định) — chỉ audit và sửa code ứng dụng.

---

## PHẦN A — TỔNG QUAN & PHẠM VI

**Tên đề tài**: SFF (Say For Fun) — Nền tảng cộng đồng thời gian thực tích hợp AI Native
**Bản chất**: Discord thu gọn (server/channel/chat/voice, phân quyền 3 cấp) + 4 tính năng AI đặc sắc + Voice/Video/Screen Share qua LiveKit
**Thời hạn**: 6 tuần (đồ án tốt nghiệp)

### Phạm vi TRONG dự án (bắt buộc phải có)
- Auth (JWT access 15 phút + refresh 7 ngày, có auto-refresh)
- Server: tạo, tham gia qua mã mời, rời, đổi tên/icon, xoá
- Server Member: 3 role OWNER/MODERATOR/MEMBER, đổi role, kick, ban/unban
- Channel: TEXT, VOICE, DM — tạo/xoá (Moderator+)
- Message: gửi/sửa/xoá, đính kèm ảnh/file, reaction, phân trang cursor
- Chat realtime qua Socket.io: tin nhắn mới, typing indicator, online/offline status
- Direct Message (DM) giữa 2 người dùng
- Notification: mention, DM mới, mời server, AI reply
- **4 tính năng AI Native** (chi tiết Phần E):
  1. AI Persona theo server (RAG)
  2. Tìm kiếm ngữ nghĩa (semantic search)
  3. Tóm tắt bỏ lỡ (catch-up)
  4. Dịch thuật thời gian thực
- **Voice/Video/Screen Share** qua LiveKit (chi tiết Phần F)
- Web (React + Vite + shadcn/ui)
- Mobile (React Native + Expo + React Native Reusables)

### Phạm vi NGOÀI dự án (đã quyết định cắt, KHÔNG tự ý thêm lại)
- Desktop app (Tauri)
- Hệ thống VIP/thanh toán
- Chất lượng livestream 1080p/60fps (mặc định cố định 720p/30fps cho mọi user)
- Kiểm duyệt nội dung bằng luật ngôn ngữ tự nhiên, trust score nâng cao

---

## PHẦN B — STACK KỸ THUẬT (CHÍNH XÁC, KHÔNG ĐƯỢC ĐỔI)

| Thành phần | Công nghệ / phiên bản | Ghi chú bắt buộc |
|---|---|---|
| Backend | NestJS + TypeScript | |
| ORM | **Prisma 6.19.3** (`prisma@6 @prisma/client@6 --save-exact`) | TUYỆT ĐỐI KHÔNG Prisma 7 — gây lỗi nghiêm trọng (xem Phần G.1) |
| Database | PostgreSQL (Supabase) + pgvector | **GIỮ NGUYÊN cấu hình hiện tại, không đổi project** |
| AI Vision/Chat | model **`gemini-3.6-flash`** | Đã test xác nhận đúng — KHÔNG dùng `gemini-2.5-flash` (bị khoá với API key mới) hoặc `gemini-3.5-flash-lite` (nhận diện sai khi test) hoặc bất kỳ bản `gemini-2.0-*` (đã bị Google retired) |
| AI Embedding | model **`gemini-embedding-001`**, `outputDimensionality=768` | BẮT BUỘC tự L2-normalize vector sau khi nhận kết quả (Google yêu cầu khi dùng outputDimensionality khác mặc định 3072) |
| Voice/Video | **LiveKit Cloud** (region Singapore) | **GIỮ NGUYÊN project LiveKit hiện tại, không tạo lại** — dùng `livekit-server-sdk` (backend cấp token) + `@livekit/components-react` (frontend) |
| Web Frontend | React + Vite + TypeScript + **shadcn/ui** (Radix + Tailwind, style "new-york") | |
| Mobile | React Native + Expo + Expo Router + **React Native Reusables** (NativeWind) | |
| Realtime | Socket.io, xác thực qua JWT trong handshake | |
| State management | Zustand (global) + TanStack Query (server state) | |
| Animation | Motion (web) / Moti (mobile) | |
| Storage | Supabase Storage — **dùng Legacy `service_role` key dạng JWT (`eyJ...`)**, KHÔNG dùng key mới `sb_secret_...` (không tương thích SDK Storage) |
| Icon | lucide-react (web) / lucide-react-native (mobile) |

---

## PHẦN C — ERD ĐẦY ĐỦ (14 bảng — đối chiếu đúng schema.prisma đang có)

**Nhóm 1 — Người dùng & bảo mật**
- `users`: id (PK), name, email (unique), password_hash, avatar_url, preferred_lang (default 'vi'), created_at
- `refresh_tokens`: id (PK), user_id (FK), token_hash, expires_at, revoked, created_at

**Nhóm 2 — Server & thành viên**
- `servers`: id (PK), name, icon_url, owner_id (FK users), invite_code (unique), created_at
- `server_members`: id (PK), server_id (FK), user_id (FK), role (ENUM OWNER/MODERATOR/MEMBER), status (ENUM ACTIVE/BANNED), joined_at — unique(server_id, user_id)

**Nhóm 3 — Channel & tin nhắn**
- `channels`: id (PK), server_id (FK, nullable — null nếu DM), name (nullable), type (ENUM TEXT/VOICE/DM), created_at
- `channel_members`: id (PK), channel_id (FK), user_id (FK) — chỉ dùng cho DM, unique(channel_id, user_id)
- `messages`: id (PK), channel_id (FK), sender_id (FK, nullable — null nếu AI trả lời), content, is_ai_reply (boolean), edited_at (nullable), created_at
- `message_attachments`: id (PK), message_id (FK), file_url, file_type, created_at
- `message_reactions`: id (PK), message_id (FK), user_id (FK), emoji, created_at — unique(message_id, user_id, emoji)
- `message_embeddings`: id (PK), message_id (FK, unique), embedding (vector(768)), created_at
- `message_translations`: id (PK), message_id (FK), target_lang, translated_text, created_at — unique(message_id, target_lang)

**Nhóm 4 — AI Persona / RAG**
- `ai_documents`: id (PK), server_id (FK), uploaded_by_id (FK users), title, content_raw, created_at
- `document_embeddings`: id (PK), document_id (FK), chunk_text, embedding (vector(768)), created_at

**Nhóm 5 — Hỗ trợ**
- `notifications`: id (PK), user_id (FK), type (ENUM MENTION/DIRECT_MESSAGE/SERVER_INVITE/AI_REPLY), content, is_read, created_at

**Lưu ý raw SQL với cột `embedding`**: khi viết `$executeRaw`/`$queryRaw` ép kiểu `::vector(768)`, con số chiều (768) PHẢI viết CỨNG trong câu SQL, KHÔNG được truyền qua tham số bind — lỗi cú pháp "type modifiers must be simple constants" nếu làm sai (đã từng gặp, xem Phần G.3).

---

## PHẦN D — DANH SÁCH API ENDPOINTS ĐẦY ĐỦ

| Module | Endpoint | Method | Quyền |
|---|---|---|---|
| Auth | /auth/register, /auth/login, /auth/refresh | POST | Public |
| Auth | /auth/me | GET | JWT |
| Users | /users/me | PUT | JWT |
| Users | /users/me/avatar | POST (multipart) | JWT |
| Servers | /servers | POST | JWT |
| Servers | /servers/mine | GET | JWT |
| Servers | /servers/:id | GET | JWT (member) |
| Servers | /servers/join | POST | JWT |
| Servers | /servers/:id/leave | DELETE | JWT |
| Servers | /servers/:id/invite-code/regenerate | POST | OWNER |
| Server Members | /servers/:id/members | GET | JWT (member) |
| Server Members | /servers/:id/members/:userId/role | PUT | OWNER |
| Server Members | /servers/:id/members/:userId/kick | POST | MODERATOR+ |
| Server Members | /servers/:id/members/:userId/ban, /unban | POST | MODERATOR+ |
| Channels | /servers/:id/channels | POST, GET | MODERATOR+ (POST), member (GET) |
| Channels | /channels/:id | DELETE | MODERATOR+ |
| Messages | /channels/:id/messages | POST (multipart), GET (cursor) | Member của channel |
| Messages | /messages/:id | PUT, DELETE | Người gửi hoặc MODERATOR+ |
| Messages | /messages/:id/reactions | POST, DELETE | Member |
| DM | /dm/:userId | POST (tạo/lấy kênh) | JWT |
| DM | /dm | GET (danh sách) | JWT |
| AI | /servers/:id/ai-documents | POST, GET | OWNER (POST), member (GET) |
| AI | /servers/:id/ai-documents/:documentId | DELETE | OWNER |
| AI | /search/semantic | GET | JWT |
| AI | /channels/:id/catch-up | GET | Member của channel |
| AI | /messages/:id/translate | POST | JWT |
| Voice | /channels/:id/voice-token | POST | Member của channel VOICE |
| Voice | /channels/:id/voice-participants | GET | Member |
| Notifications | /notifications | GET | JWT |
| Notifications | /notifications/:id/read | PUT | JWT |
| Notifications | /notifications/read-all | PUT | JWT |

---

## PHẦN E — 4 TÍNH NĂNG AI NATIVE (QUY TRÌNH CHI TIẾT)

### E.1. AI Persona theo server (RAG)
1. OWNER nạp tài liệu qua `POST /servers/:id/ai-documents` (title + content_raw)
2. Backend chia nhỏ (chunk) văn bản ~500-800 ký tự, ưu tiên cắt theo ranh giới đoạn văn, overlap ~50-100 ký tự giữa các chunk
3. Sinh embedding cho từng chunk (gemini-embedding-001, 768 dim, normalize), lưu `document_embeddings`
4. Khi user gõ `@AI <câu hỏi>` trong channel: sinh embedding câu hỏi → pgvector tìm top-5 chunk liên quan nhất TRONG PHẠM VI server đó → ghép ngữ cảnh → gọi `gemini-3.6-flash` với system prompt: "CHỈ trả lời dựa trên ngữ cảnh được cung cấp, nếu không tìm thấy thông tin liên quan hãy nói rõ không biết thay vì bịa đặt" → lưu câu trả lời thành Message mới (sender_id=null, is_ai_reply=true) → emit qua Socket.io như tin nhắn thường
5. **Đã xác nhận qua test thật**: khi server chưa có tài liệu, AI trả lời trung thực "không có tài liệu nào được nạp" thay vì bịa — đây là hành vi ĐÚNG, cần giữ nguyên khi audit

### E.2. Tìm kiếm ngữ nghĩa
1. MỌI tin nhắn mới đều tự động sinh embedding chạy NỀN (fire-and-forget, không chặn response gửi tin, lỗi chỉ log không làm fail request)
2. `GET /search/semantic?query=&serverId=&channelId=`: sinh embedding câu query, pgvector cosine distance tìm message_embeddings gần nhất, JOIN lấy nội dung, lọc theo quyền xem của user, top 10-20 kết quả

### E.3. Tóm tắt bỏ lỡ
`GET /channels/:id/catch-up?since=<ISO timestamp>`: lấy tin nhắn có createdAt > since (tối đa 200 tin gần nhất), gộp nội dung kèm tên người gửi, gửi Gemini tóm tắt 3-5 dòng theo chủ đề chính

### E.4. Dịch thuật thời gian thực
`POST /messages/:id/translate?targetLang=`: kiểm tra cache `message_translations` trước, nếu chưa có thì gọi Gemini dịch rồi lưu cache

---

## PHẦN F — VOICE/VIDEO/SCREEN SHARE (LIVEKIT)

1. Client vào channel VOICE → gọi `POST /channels/:id/voice-token`
2. Backend kiểm tra user là member của server chứa channel đó → dùng `livekit-server-sdk` tạo AccessToken: `identity=userId`, `room=channelId`, grant `canPublish/canSubscribe/canPublishData=true`
3. Client dùng token kết nối trực tiếp LiveKit server (KHÔNG qua Backend NestJS cho luồng media)
4. Chia sẻ màn hình: constraint cố định 720p/30fps ở phía client (`getDisplayMedia` với `width:1280,height:720,frameRate:30`)
5. UI dùng component có sẵn của `@livekit/components-react` (GridLayout, ParticipantTile, ControlBar) — KHÔNG tự vẽ lại từ đầu
6. **Đã xác nhận qua test thật**: 2 chiều (2 trình duyệt) nghe/nhìn thấy nhau + chia sẻ màn hình hoạt động ổn định

---

## PHẦN G — LỖI ĐÃ GẶP VÀ CÁCH FIX (AUDIT LẠI XEM CÒN TỒN TẠI KHÔNG)

1. **Prisma 7 không dùng được** — nếu thấy `package.json` ghi version 7.x, phải hạ về 6.19.3, xoá `prisma.config.ts` nếu có, khôi phục `schema.prisma` datasource dạng `url` + `directUrl` truyền thống.
2. **pgvector + Prisma "drift"** — schema.prisma KHÔNG được có `previewFeatures = ["postgresqlExtensions"]` và `extensions = [vector]`. Nếu thấy 2 dòng này, xoá đi (extension `vector` đã bật tay qua SQL Editor, không cần Prisma quản lý).
3. **Raw SQL vector type modifier** — kiểm tra mọi chỗ dùng `$executeRaw`/`$queryRaw` liên quan cột `embedding`: số `768` phải viết cứng trong SQL, không qua bind parameter `$1`.
4. **Password có ký tự đặc biệt trong connection string** — nếu password chứa `@`, `#`... phải URL-encode. (Hiện tại password đã đổi sang dạng không có ký tự đặc biệt, không cần lo nếu Supabase giữ nguyên.)
5. **Supabase Storage key** — kiểm tra `SUPABASE_SERVICE_KEY` trong `.env` phải là Legacy service_role key dạng JWT (`eyJ...`), KHÔNG phải `sb_secret_...`.
6. **connection_limit** — `DATABASE_URL` nên có `&connection_limit=10` để tránh P1001 khi nhiều kết nối đồng thời (REST + Socket.io).
7. **JWT auto-refresh cho Socket.io** — kiểm tra `lib/socketClient.ts` (frontend): khi socket disconnect do "jwt expired", PHẢI tự động gọi refresh token rồi reconnect lại, KHÔNG bắt người dùng F5 thủ công. Đã implement, cần xác nhận còn hoạt động đúng.
8. **Model Gemini bị lùi bản retired** — kiểm tra `config/constants.ts`: `GEMINI_CHAT_MODEL` phải là `'gemini-3.6-flash'`, không phải `gemini-2.0-flash` hay bất kỳ bản đã retired. Mọi nơi gọi model AI phải import từ constants, KHÔNG hardcode rải rác (lỗi này từng lọt qua vì hardcode ở nhiều chỗ).
9. **LiveKit token cấp trùng 2 lần** — kiểm tra component vào Voice Channel ở frontend: hàm lấy token không được gọi 2 lần liên tiếp cho cùng 1 user (do useEffect chạy trùng) — gây lỗi 401 và duplicate participant tile.

---

## PHẦN H — VẤN ĐỀ UI ĐANG CHỜ XÁC NHẬN ĐÃ SỬA HAY CHƯA

1. **Panel "Thành viên" và "Cài đặt Server" xếp chồng dọc** thay vì hiện overlay đúng chuẩn — phải sửa dùng shadcn `Sheet` (Thành viên, trượt từ phải) và `Dialog` (Cài đặt Server, modal giữa màn hình). Chỉ 1 panel hiện tại 1 thời điểm.
2. **4 nút điều khiển voice call** (mic/cam/chia sẻ màn hình/rời phòng) đang cùng màu đỏ — cần phân biệt: trung tính khi tắt, đỏ chỉ cho "rời phòng"/tắt mic-cam, xanh/primary khi đang bật.
3. Cần xác nhận đã có đủ: `SemanticSearchDialog` (icon kính lúp trên TopBar), `CatchUpButton` (nút trên đầu mỗi channel), nút "Dịch" trên mỗi MessageBubble, animation Motion (tin nhắn slide-up+fade, AI typing dots trước khi hiện nội dung, stagger list khi load), dark mode mặc định + toggle light mode trong Settings.

---

## PHẦN I — DESIGN SYSTEM (bảng màu HSL, đồng bộ web+mobile)

```css
:root {
  --background: 240 10% 98%;
  --foreground: 240 10% 12%;
  --card: 0 0% 100%;
  --sidebar: 240 8% 96%;
  --primary: 250 84% 60%;
  --primary-foreground: 0 0% 100%;
  --muted-foreground: 240 5% 45%;
  --accent-ai: 262 83% 58%;        /* highlight tin nhắn AI, PHẢI phân biệt rõ */
  --online: 142 71% 45%;
  --offline: 240 5% 65%;
  --voice-active: 142 71% 45%;     /* ring quanh avatar đang nói */
  --mention: 38 92% 50%;
  --destructive: 347 77% 50%;
  --success: 160 84% 39%;
  --warning: 38 92% 50%;
  --border: 240 6% 90%;
  --radius: 0.75rem;
}
.dark {
  --background: 240 10% 8%;
  --foreground: 240 5% 96%;
  --sidebar: 240 10% 6%;
  --primary: 250 84% 68%;
  /* accent-ai, online, offline, destructive, success, warning: tăng nhẹ lightness +5-8% */
}
```

Dark mode làm MẶC ĐỊNH (đúng UX chuẩn app chat/cộng đồng). Component UI dùng shadcn/ui (web) và React Native Reusables (mobile) — KHÔNG tự viết lại Button/Input/Card/Dialog từ đầu.

---

## PHẦN J — CẤU TRÚC THƯ MỤC CHUẨN

```
sff/
├── backend/src/
│   ├── config/ (env.validation.ts, constants.ts)
│   ├── common/ (decorators, guards — đặc biệt ServerRoleGuard + @RequireServerRole, filters, interceptors)
│   ├── modules/ (auth, users, servers, server-members, channels, messages,
│   │             chat-gateway, ai, voice, notifications)
│   └── storage/
├── frontend/src/
│   ├── components/ui/ (shadcn CLI sinh ra)
│   ├── components/layout/
│   ├── features/ (auth, servers, channels, messages, ai, voice, notifications)
│   ├── pages/, lib/, store/, types/
├── mobile/ (Expo Router, cấu trúc features/ đối xứng với frontend/)
└── docs/
```

---

## PHẦN K — YÊU CẦU CHO CURSOR KHI AUDIT

1. Đọc toàn bộ code hiện có trong `backend/`, `frontend/`, `mobile/`.
2. Đối chiếu TỪNG mục ở Phần C (ERD), D (API), E (AI), F (Voice), G (lỗi đã fix), H (UI), I (design system), J (cấu trúc) — báo cáo dạng bảng: **Đã đúng / Thiếu / Sai / Cần sửa**, kèm dẫn chứng file cụ thể.
3. KHÔNG đổi bất kỳ thông tin kết nối Supabase (DATABASE_URL, DIRECT_URL, SUPABASE_URL, SUPABASE_SERVICE_KEY) và LiveKit (LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET) hiện có trong `.env` — các dịch vụ này đang chạy ổn định, chỉ audit code ứng dụng.
4. Sau khi audit xong, đề xuất 1 trong 2 hướng: (a) sửa từng phần còn thiếu/sai tại chỗ, hoặc (b) nếu phát hiện quá nhiều sai lệch nghiêm trọng ở kiến trúc lõi, đề xuất viết lại từ đầu theo đúng tài liệu này (giữ nguyên `.env` Supabase/LiveKit, migrate lại schema nếu cần).
5. Trước khi kết luận bất kỳ mục nào là "đã đúng", PHẢI verify bằng cách chạy thử/đọc log thật, không suy đoán chỉ từ việc code compile được.
