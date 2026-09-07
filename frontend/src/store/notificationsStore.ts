// ============================================================
// SFF — Notifications Store
// Lưu danh sách notifications + unread count.
// Fetch lần đầu qua TanStack Query, các thao tác (mark read) gọi qua
// notificationsApi rồi cập nhật local state.
// ============================================================

import { create } from 'zustand';
import {
  notificationsApi,
  type NotificationItem,
} from '@/features/notifications/api/notifications';

interface NotificationsState {
  items: NotificationItem[];
  unreadCount: number;
  loading: boolean;
  error: string | null;

  /** Set lại toàn bộ (dùng cho polling/refetch) */
  setAll: (items: NotificationItem[]) => void;
  setUnreadCount: (n: number) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  /** Mark 1 cái đã đọc (optimistic update) */
  markOneRead: (id: string) => Promise<void>;
  /** Mark tất cả đã đọc */
  markAllRead: () => Promise<void>;
  /** Reset khi logout */
  reset: () => void;
}

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  items: [],
  unreadCount: 0,
  loading: false,
  error: null,

  setAll: (items) => set({ items }),
  setUnreadCount: (n) => set({ unreadCount: n }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),

  markOneRead: async (id: string) => {
    const before = get().items;
    // Optimistic update: đánh dấu đã đọc ngay trong UI
    set({
      items: before.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
      unreadCount: Math.max(
        0,
        get().unreadCount - (before.find((n) => n.id === id && !n.isRead) ? 1 : 0),
      ),
    });
    try {
      await notificationsApi.markRead(id);
    } catch {
      // rollback nếu fail
      set({ items: before, unreadCount: get().unreadCount });
    }
  },

  markAllRead: async () => {
    const before = get().items;
    set({
      items: before.map((n) => ({ ...n, isRead: true })),
      unreadCount: 0,
    });
    try {
      await notificationsApi.markAllRead();
    } catch {
      // rollback nếu fail
      set({
        items: before,
        unreadCount: before.filter((n) => !n.isRead).length,
      });
    }
  },

  reset: () => set({ items: [], unreadCount: 0, error: null, loading: false }),
}));
