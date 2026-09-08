import { axiosClient } from '@/lib/axiosClient';

export type NotificationType =
  | 'MENTION'
  | 'DIRECT_MESSAGE'
  | 'SERVER_INVITE'
  | 'AI_REPLY';

export interface NotificationItem {
  id: string;
  type: NotificationType;
  content: string;
  isRead: boolean;
  createdAt: string;
}

export const notificationsApi = {
  /** List my notifications (mới nhất trước, tối đa 100) */
  list: async (unreadOnly = false): Promise<NotificationItem[]> => {
    const params = unreadOnly ? '?unreadOnly=true' : '';
    const { data } = await axiosClient.get<NotificationItem[]>(`/notifications${params}`);
    return data;
  },

  unreadCount: async (): Promise<number> => {
    // Backend trả về số nguyên trực tiếp (vd: 0), không phải object
    const { data } = await axiosClient.get<number>('/notifications/unread-count');
    return data;
  },

  markRead: async (id: string): Promise<NotificationItem> => {
    const { data } = await axiosClient.put<NotificationItem>(`/notifications/${id}/read`);
    return data;
  },

  markAllRead: async (): Promise<{ count: number }> => {
    const { data } = await axiosClient.put<{ count: number }>('/notifications/read-all');
    return data;
  },
};
