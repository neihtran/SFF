// ============================================================
// SFF — Hằng số nghiệp vụ dùng chung
// Tập trung để dễ chỉnh (ngưỡng similarity, top-k RAG, chunk size, JWT TTL...)
// KHÔNG hardcode giá trị này rải rác trong service — luôn import từ đây.
// ============================================================

// ----------- JWT -----------
export const JWT_ACCESS_TTL = '15m';
export const JWT_REFRESH_TTL = '7d';

// ----------- Bcrypt -----------
export const BCRYPT_SALT_ROUNDS = 10;

// ----------- Pagination -----------
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// ----------- AI / RAG -----------
export const GEMINI_EMBEDDING_MODEL = 'gemini-embedding-001';
export const GEMINI_CHAT_MODEL = 'gemini-2.0-flash';
export const EMBEDDING_DIMENSION = 768;

export const RAG_TOP_K = 5;
export const RAG_SIMILARITY_THRESHOLD = 0.7;
export const RAG_CHUNK_SIZE = 800;
export const RAG_CHUNK_OVERLAP = 100;

// ----------- Realtime / Socket -----------
export const SOCKET_TYPING_TTL_MS = 5000;

// ----------- Upload -----------
export const MAX_AVATAR_SIZE_BYTES = 2 * 1024 * 1024;
export const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024;

// ----------- Voice / LiveKit -----------
export const LIVEKIT_TOKEN_TTL_SECONDS = 60 * 60;
