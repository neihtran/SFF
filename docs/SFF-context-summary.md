# SFF (Say For Fun) — Tóm tắt ngữ cảnh dự án để tiếp tục phiên làm việc

> Dán toàn bộ nội dung file này vào tin nhắn đầu tiên của cuộc trò chuyện mới để
> Claude nắm đủ ngữ cảnh, không cần giải thích lại từ đầu.

---

## 1. TỔNG QUAN ĐỀ TÀI

**Tên**: SFF (Say For Fun) — Nền tảng cộng đồng thời gian thực tích hợp AI Native
**Loại**: Đồ án tốt nghiệp VTC Academy, thời hạn 6 tuần
**Bản chất**: Discord thu gọn (server/channel/chat/voice) + 4 tính năng AI đặc sắc + Voice/Video/Screen Share qua LiveKit

**Lịch sử**: Đây là đề tài THỨ 2. Đề tài đầu (SmartFind — nền tảng tìm đồ thất lạc AI) đã bỏ giữa chừng sau khi hoàn thành backend+frontend cơ bản, do người dùng muốn đổi sang đề tài rộng/đặc sắc hơn. Toàn bộ kỹ thuật nền (NestJS+Prisma+Supabase+Gemini+pgvector) được tái sử dụng.

**Phạm vi CHỐT — không mở rộng thêm nếu không có lý do rõ ràng**:
- ✅ Trong phạm vi: Server/Channel/Member (3 role: OWNER/MODERATOR/MEMBER), Chat realtime + DM, 4 tính năng AI Native, Voice/Video/Screen Share (LiveKit, 720p/30fps mặc định), Web (React+Vite+shadcn/ui), Mobile (React Native+Expo+React Native Reusables)
- ❌ NGOÀI phạm vi 6 tuần (đã cắt có chủ đích): Desktop app (Tauri), hệ thống VIP/thanh toán, chất lượng livestream 1080p/60fps

**4 tính năng AI Native (điểm nhấn chính)**:
1. AI Persona theo server (RAG) — Owner nạp tài liệu, @AI trong chat để hỏi, AI trả lời dựa trên tài liệu đã nạp (đã xác nhận: nếu chưa có tài liệu, AI trả lời trung thực "không có tài liệu" thay vì bịa — đúng thiết kế)
2. Tìm kiếm ngữ nghĩa (semantic search qua pgvector)
3. Tóm tắt "bỏ lỡ gì" (catch-up summary)
4. Dịch thuật thời gian thực (cache vào message_translations)

---

## 2. STACK KỸ THUẬT ĐÃ CHỐT (không tự ý đổi)

| Thành phần | Công nghệ |
|---|---|
| Backend | NestJS + Prisma **6.19.3** (TUYỆT ĐỐI không dùng Prisma 7 — đã gặp lỗi nghiêm trọng, xem mục 4) |
| Database | PostgreSQL (Supabase) + pgvector, region **Singapore** |
| AI Vision/Chat | Model **`gemini-3.6-flash`** (đã xác nhận qua test thật — KHÔNG dùng gemini-2.5-flash [bị khoá với API key mới], KHÔNG dùng gemini-3.5-flash-lite [nhận diện sai vật thể khi test]) |
| AI Embedding | Model **`gemini-embedding-001`**, outputDimensionality=768, BẮT BUỘC L2-normalize thủ công sau khi nhận kết quả |
| Web Frontend | React + Vite + TypeScript + **shadcn/ui** (Radix + Tailwind, style "new-york") |
| Mobile | React Native + Expo + Expo Router + **React Native Reusables** (NativeWind) |
| Voice/Video | **LiveKit Cloud** (free tier, region Singapore) — dùng `livekit-server-sdk` (backend cấp token) + `@livekit/components-react` (frontend UI) |
| Realtime chat | Socket.io |
| State management | Zustand + TanStack Query |
| Animation | Motion (web) / Moti (mobile) |
| Auth | JWT access token **15 phút** + refresh token **7 ngày**, có cơ chế auto-refresh + Socket.io auto-reconnect khi token hết hạn (đã implement) |
| Icon | lucide-react (web) / lucide-react-native (mobile) |

---

## 3. TÀI LIỆU ĐÃ TẠO SẴN (đã có trong project)

Đặt tại `.cursor/rules/` (9 file `.mdc`): `00-general`, `01-structure`, `02-backend`, `03-frontend`, `04-design-system`, `05-code-quality-git`, `06-restrictions`, `07-git-mandatory`, `08-mobile`.

Tài liệu dự án (thư mục `docs/`): `SFF-DeCuong.docx` (đề cương đầy đủ 15 mục), `schema.prisma` (ERD 14 bảng), `roadmap-30-ngay.md` (lộ trình chi tiết từng ngày, 6 tuần).

**ERD 14 bảng**: users, refresh_tokens, servers, server_members, channels (TEXT/VOICE/DM), channel_members, messages, message_attachments, message_reactions, message_embeddings, message_translations, ai_documents, document_embeddings, notifications.

**Bảng màu design system** (HSL, đồng bộ web+mobile): primary (violet #250 84% 60%), accent-ai (purple, phân biệt tin AI), online/offline, voice-active, mention, destructive/success/warning theo chuẩn shadcn. Dark mode làm mặc định (đúng UX app chat).

---

## 4. CÁC LỖI ĐÃ GẶP VÀ BÀI HỌC KỸ THUẬT QUAN TRỌNG (tránh lặp lại)

1. **Prisma 7 KHÔNG dùng được** — model bị khoá quyền, đổi hoàn toàn cách cấu hình (bỏ url/directUrl khỏi schema, cần driver adapter). Luôn pin cứng `prisma@6 @prisma/client@6 --save-exact`, không để `npx` tự tải bản mới nhất.
2. **pgvector + Prisma**: KHÔNG dùng `previewFeatures = ["postgresqlExtensions"]` + `extensions = [vector]` trong schema — gây lỗi "drift" vì Supabase tự cài sẵn nhiều extension khác (pgcrypto, uuid-ossp...). Bật `vector` extension thủ công qua SQL Editor, để Prisma không quản lý extension.
3. **Raw SQL với cột vector**: khi viết `$executeRaw`/`$queryRaw` ép kiểu `::vector(768)`, con số chiều (768) PHẢI viết CỨNG trong câu SQL, KHÔNG được truyền qua tham số bind ($1) — lỗi "type modifiers must be simple constants or identifiers" nếu làm sai.
4. **Connection string password có ký tự đặc biệt** (`@`, `#`...) PHẢI URL-encode (`@` → `%40`) trước khi đưa vào `DATABASE_URL`/`DIRECT_URL`.
5. **Supabase Storage key mới** (`sb_secret_...`) KHÔNG tương thích với `@supabase/supabase-js` Storage SDK — phải dùng **Legacy service_role key** (dạng JWT, bắt đầu `eyJ...`), lấy từ Project Settings → API Keys → tab Legacy API keys.
6. **DATABASE_URL cần `connection_limit`** (VD `&connection_limit=10`) để tránh lỗi P1001 khi nhiều kết nối đồng thời (REST + Socket.io).
7. **Lỗi P1001 "Can't reach database"** đôi khi chỉ là **DNS chập chờn tạm thời** từ mạng/router, không phải lỗi cấu hình — kiểm tra bằng `Test-NetConnection -ComputerName <host> -Port <port>` trước khi sửa code.
8. **JWT access token ngắn hạn (15m)** cần cơ chế auto-refresh cho CẢ axios lẫn Socket.io (không chỉ axios) — nếu không, chat sẽ tự ngắt kết nối ngầm sau 15 phút mà không rõ lý do.
9. **Luôn git commit + push sau mỗi task lớn** — dự án ĐÃ TỪNG mất trắng dữ liệu 1 lần do thiếu bước này (lý do đề tài SmartFind phải bỏ, chuyển sang SFF).

---

## 5. TIẾN ĐỘ HIỆN TẠI (theo roadmap 6 tuần)

| Tuần | Nội dung | Trạng thái |
|---|---|---|
| 1-2 | Setup, Git, Supabase, Auth, Server/Channel/Member (phân quyền 3 cấp), Messages CRUD, Socket.io realtime, DM | ✅ Hoàn thành, đã test kỹ |
| 3 | AI Native: RAG Persona, Tìm kiếm ngữ nghĩa, Tóm tắt, Dịch thuật | ✅ Hoàn thành, đã test qua Swagger + UI thật |
| 4 | LiveKit Voice/Video/Screen Share | ✅ Hoàn thành, đã test 2 chiều (2 trình duyệt) + chia sẻ màn hình thành công |
| 5 | Hoàn thiện Web Frontend | 🔶 **ĐANG LÀM DỞ** — xem mục 6 |
| 6 | Mobile + Deploy + Báo cáo | ⏭ Chưa bắt đầu |

**Backend đã xác nhận ổn định** (chạy liên tục 16+ phút không lỗi, đủ 12 module + WebSocket gateway) sau khi xử lý xong 1 đợt lỗi hàng loạt (SQL vector, DB connection, LiveKit token trùng, dịch thuật 400, storage key, model Gemini bị lùi về bản retired) — TẤT CẢ đã fix và verify bằng log thật.

---

## 6. VIỆC ĐANG DANG DỞ — CẦN LÀM TIẾP NGAY

Đang ở giữa Tuần 5 (hoàn thiện Web Frontend). Đã có: layout sidebar server/channel, chat cơ bản với AI badge phân biệt đúng (màu accent-ai + badge "AI"), voice call UI cơ bản.

**Lỗi UI vừa phát hiện, đã gửi prompt sửa cho Cursor, CHƯA XÁC NHẬN kết quả**:
1. Panel "Thành viên" và "Cài đặt Server" đang xếp chồng dọc trong layout thay vì hiện overlay đúng chuẩn (cần đổi sang shadcn Sheet cho Thành viên, Dialog cho Cài đặt Server).
2. 4 nút điều khiển voice call (mic/cam/chia sẻ màn hình/rời phòng) đang cùng màu đỏ, cần phân biệt: trung tính khi tắt, đỏ chỉ cho hành động rời/tắt, xanh/primary khi đang bật.
3. Cần xác nhận đã có đủ: SemanticSearchDialog, CatchUpButton, nút Dịch trên MessageBubble, animation Motion (tin nhắn slide-up+fade, AI typing dots, stagger list), dark mode mặc định + toggle.

**Việc tiếp theo sau khi xong Tuần 5**: chuyển sang Tuần 6 — Mobile App (Expo, Auth + Chat + Voice call cơ bản, KHÔNG bắt buộc đủ AI feature như Web nếu thiếu thời gian) → Deploy production (Render/Vercel/Supabase/LiveKit/Expo) → Viết báo cáo + slide + video demo.

---

## 7. TÀI KHOẢN TEST CÓ SẴN

- `userA` — Owner của server "test", có sẵn 1 channel TEXT ("text") và 1 channel VOICE ("voice")
- `userB` — Member của server "test"
- (Từ đề tài SmartFind cũ, có thể không còn dùng): `admin@example.com` / `admin12345`, `user.b@example.com`, `user.c@example.com` — KHÔNG áp dụng cho SFF vì database đã tạo lại từ đầu.

---

## 8. QUY TẮC LÀM VIỆC ĐÃ THIẾT LẬP TRONG PHIÊN NÀY

- Mọi prompt gửi cho Cursor đều yêu cầu **tự verify bằng log/test thật** trước khi báo "xong", không chỉ dựa vào build pass.
- Khi debug, ưu tiên **tìm nguyên nhân gốc** thay vì sửa từng triệu chứng riêng lẻ — nhiều lỗi UI/logic thường bắt nguồn từ 1-2 lỗi backend gốc.
- Trước khi thêm phạm vi mới, luôn đánh giá thẳng thắn độ khả thi trong quỹ thời gian còn lại, đề xuất phương án cắt giảm nếu cần.
- File rác/debug tạm (`diag-*.js`, `*.log` không phải log runtime chính thức) cần dọn sau mỗi đợt debug lớn, giữ lại các test thật (`test-realtime.ts`, `test-e2e-final.ts`).
