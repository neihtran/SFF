// ============================================================
// SFF — Axios Client (single instance, JWT + auto-refresh)
// Theo quy tắc 03-frontend.mdc: chỉ dùng 1 instance axios duy nhất
// tại lib/axiosClient.ts, KHÔNG gọi axios trực tiếp trong component.
// ============================================================

import axios, { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';

const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export const axiosClient = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: false,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15_000,
});

// Token lưu tạm trong memory; lớp authStore (Zustand persist) sẽ là nguồn chính.
let accessToken: string | null = null;
let refreshToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function setRefreshToken(token: string | null): void {
  refreshToken = token;
}

export function getRefreshToken(): string | null {
  return refreshToken;
}

axiosClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (accessToken && config.headers) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// ============================================================
// Auto refresh token khi 401
// - Single-flight: nhiều request 401 đồng thời chỉ gọi /auth/refresh 1 lần
// - Sau khi refresh OK: retry request gốc với access token mới
// - Nếu refresh thất bại (refresh token hết hạn): gọi onSessionExpired()
//   để logout + redirect về login. Cả các request đang chờ sẽ reject.
// ============================================================

type SessionExpiredHandler = () => void;
let onSessionExpired: SessionExpiredHandler | null = null;

/** Đăng ký handler khi cả refresh token cũng hết hạn (hiếm, 7 ngày). */
export function setSessionExpiredHandler(handler: SessionExpiredHandler | null): void {
  onSessionExpired = handler;
}

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean; _isRefreshCall?: boolean };

/** Promise cache để các request 401 song song share cùng 1 lần refresh. */
let inFlightRefresh: Promise<string> | null = null;

interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}

/** Refresh access token dùng refresh token hiện có. Trả accessToken mới.
 *  Throw nếu refresh token không có hoặc backend từ chối.
 *  Được socketClient dùng lại để tránh viết trùng logic.
 *
 *  Gọi thẳng axios.post thay vì qua axiosClient.post (và đánh dấu
 *  _isRefreshCall) để tránh loop qua interceptor response.
 */
export async function refreshAccessToken(): Promise<string> {
  if (inFlightRefresh) return inFlightRefresh;

  if (!refreshToken) {
    throw new Error('No refresh token available');
  }

  inFlightRefresh = (async () => {
    try {
      const res = await axios.post<RefreshResponse>(
        `${apiBaseUrl}/auth/refresh`,
        { refreshToken },
        { headers: { 'Content-Type': 'application/json' }, timeout: 15_000 },
      );

      const newAccess = res.data.accessToken;
      const newRefresh = res.data.refreshToken;

      setAccessToken(newAccess);
      setRefreshToken(newRefresh);

      // Persist vào store (lazy import tránh circular dep khi store
      // chưa init hoặc refresh chạy từ socket trước khi user đăng nhập).
      try {
        const { useAuthStore } = await import('@/store/authStore');
        const state = useAuthStore.getState();
        if (state.user) {
          state.setAuth({ user: state.user, accessToken: newAccess, refreshToken: newRefresh });
        }
      } catch {
        // store không sẵn sàng — bỏ qua
      }

      return newAccess;
    } catch (err) {
      // Refresh fail → báo session expired cho app xử lý (logout + toast)
      if (onSessionExpired) {
        try { onSessionExpired(); } catch { /* ignore */ }
      }
      throw err;
    } finally {
      inFlightRefresh = null;
    }
  })();

  return inFlightRefresh;
}

axiosClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    const original = error.config as RetriableConfig | undefined;
    const status = error.response?.status;

    // Không retry cho request đã retry rồi
    if (!original || original._retry) {
      return Promise.reject(error);
    }

    if (status !== 401) {
      return Promise.reject(error);
    }

    try {
      const newAccess = await refreshAccessToken();
      original._retry = true;
      if (original.headers) {
        original.headers.Authorization = `Bearer ${newAccess}`;
      }
      return axiosClient(original);
    } catch {
      // Refresh fail — không retry, để component xử lý (toast/lỗi)
      return Promise.reject(error);
    }
  },
);