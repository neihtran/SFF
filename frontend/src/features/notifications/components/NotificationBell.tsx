import { useState } from 'react';
import { Bell, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useNotifications } from '../hooks/useNotifications';
import { NotificationItemRow } from './NotificationItemRow';

/**
 * Icon chuông + badge số unread (góc trên phải) + dropdown khi click.
 * - Polling mỗi 30s + refetch khi mở dropdown.
 * - "Đánh dấu tất cả đã đọc" ở footer dropdown.
 */
export function NotificationBell(): React.ReactElement {
  const { items, unreadCount, isLoading, markOneRead, markAllRead, refetch } =
    useNotifications();
  const [open, setOpen] = useState(false);

  // Refetch mỗi lần mở dropdown
  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) refetch();
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          className="relative flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label={`Thông báo${unreadCount > 0 ? ` (${unreadCount} chưa đọc)` : ''}`}
        >
          <Bell size={16} />
          {unreadCount > 0 && (
            <span
              className="absolute -right-0.5 -top-0.5 flex min-w-[18px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground"
              data-testid="notification-badge"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <h3 className="text-sm font-semibold">Thông báo</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-xs"
              onClick={() => void markAllRead()}
            >
              <Check size={12} /> Đánh dấu tất cả đã đọc
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-96">
          {isLoading && items.length === 0 ? (
            <div className="space-y-2 p-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-md" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Bell size={24} className="opacity-40" />
              <p>Chưa có thông báo nào</p>
            </div>
          ) : (
            <div className="space-y-1 p-1">
              {items.map((n) => (
                <NotificationItemRow
                  key={n.id}
                  notification={n}
                  onMarkRead={(id) => void markOneRead(id)}
                />
              ))}
            </div>
          )}
        </ScrollArea>
        {isLoading && items.length > 0 && (
          <div className="flex items-center justify-center border-t border-border py-1 text-xs text-muted-foreground">
            <Loader2 size={12} className="mr-1 animate-spin" /> Đang cập nhật…
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
