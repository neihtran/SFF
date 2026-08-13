// ============================================================
// SFF — Auth Store (Zustand + persist)
// Lưu user hiện tại + accessToken/refreshToken.
// KHÔNG lưu token vào localStorage ở production — sẽ chuyển sang
// httpOnly cookie khi backend hỗ trợ (Tuần 3).
// ============================================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  preferredLang: string;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  setAuth: (payload: { user: AuthUser; accessToken: string; refreshToken: string }) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      setAuth: ({ user, accessToken, refreshToken }) =>
        set({ user, accessToken, refreshToken }),
      clearAuth: () => set({ user: null, accessToken: null, refreshToken: null }),
    }),
    {
      name: 'sff-auth',
      // Mobile dùng expo-secure-store — xem 08-mobile.mdc
    },
  ),
);
