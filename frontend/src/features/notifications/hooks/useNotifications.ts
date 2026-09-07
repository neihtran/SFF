import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { notificationsApi } from '@/features/notifications/api/notifications';
import { useNotificationsStore } from '@/store/notificationsStore';

const POLL_INTERVAL_MS = 30_000;

/**
 * Hook quản lý notifications:
 * - Fetch lần đầu + polling mỗi 30s
 * - Sync dữ liệu vào notificationsStore
 * - Refetch khi tab focus lại (TanStack Query mặc định)
 *
 * Trả về các action cần thiết cho UI (markRead, markAllRead, refetch).
 */
export function useNotifications() {
  const setAll = useNotificationsStore((s) => s.setAll);
  const setUnreadCount = useNotificationsStore((s) => s.setUnreadCount);
  const setError = useNotificationsStore((s) => s.setError);
  const markOneRead = useNotificationsStore((s) => s.markOneRead);
  const markAllRead = useNotificationsStore((s) => s.markAllRead);
  const reset = useNotificationsStore((s) => s.reset);

  const listQuery = useQuery({
    queryKey: ['notifications', 'list'],
    queryFn: () => notificationsApi.list(false),
    refetchInterval: POLL_INTERVAL_MS,
    refetchOnWindowFocus: true,
    staleTime: 10_000,
  });

  const unreadQuery = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => notificationsApi.unreadCount(),
    refetchInterval: POLL_INTERVAL_MS,
    refetchOnWindowFocus: true,
    staleTime: 10_000,
  });

  // Sync TanStack Query → Zustand store
  useEffect(() => {
    if (listQuery.data) setAll(listQuery.data);
    if (listQuery.error) setError((listQuery.error as Error).message);
  }, [listQuery.data, listQuery.error, setAll, setError]);

  useEffect(() => {
    if (unreadQuery.data) setUnreadCount(unreadQuery.data.count);
  }, [unreadQuery.data, setUnreadCount]);

  // Reset store khi unmount (vd logout)
  useEffect(() => {
    return () => reset();
  }, [reset]);

  return {
    items: listQuery.data ?? [],
    unreadCount: unreadQuery.data?.count ?? 0,
    isLoading: listQuery.isLoading,
    error: listQuery.error,
    markOneRead,
    markAllRead,
    refetch: () => {
      void listQuery.refetch();
      void unreadQuery.refetch();
    },
  };
}
