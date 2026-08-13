// ============================================================
// SFF — Axios Client (single instance, JWT + auto-refresh)
// Theo quy tắc 03-frontend.mdc: chỉ dùng 1 instance axios duy nhất
// tại lib/axiosClient.ts, KHÔNG gọi axios trực tiếp trong component.
// ============================================================

import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';

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

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

axiosClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (accessToken && config.headers) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// Auto refresh token khi 401 — chi tiết sẽ hoàn thiện ở Tuần 3 (Auth module).
axiosClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    // TODO (Tuần 3): gọi /auth/refresh, retry request gốc với token mới.
    return Promise.reject(error);
  },
);
