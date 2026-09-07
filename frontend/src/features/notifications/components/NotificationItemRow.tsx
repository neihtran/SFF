import { AtSign, MessageCircle, UserPlus, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import type { NotificationItem, NotificationType } from '../api/notifications';

interface NotificationItemRowProps {
  notification: NotificationItem;
  onMarkRead: (id: string) => void;
}

const ICONS: Record<NotificationType, React.ComponentType<{ size?: number }>> = {
  MENTION: AtSign,
  DIRECT_MESSAGE: MessageCircle,
  SERVER_INVITE: UserPlus,
  AI_REPLY: Sparkles,
};

const TYPE_LABEL: Record<NotificationType, string> = {
  MENTION: 'Được nhắc đến',
  DIRECT_MESSAGE: 'Tin nhắn mới',
  SERVER_INVITE: 'Lời mời server',
  AI_REPLY: 'AI trả lời',
};

/**
 * 1 dòng notification trong dropdown.
 * - Click → đánh dấu đã đọc (optimistic).
 * - Unread: có chấm xanh bên trái + bg-card/50.
 */
export function NotificationItemRow({
  notification,
  onMarkRead,
}: NotificationItemRowProps): React.ReactElement {
  const Icon = ICONS[notification.type];
  const isUnread = !notification.isRead;

  function handleClick() {
    if (isUnread) onMarkRead(notification.id);
  }

  return (
    <motion.button
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={handleClick}
      className={`flex w-full items-start gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-muted ${
        isUnread ? 'bg-primary/5' : ''
      }`}
    >
      <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <Icon size={14} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xs font-semibold text-muted-foreground">
            {TYPE_LABEL[notification.type]}
          </span>
          <span className="shrink-0 text-[10px] text-muted-foreground">
            {formatTime(notification.createdAt)}
          </span>
        </div>
        <p
          className={`mt-0.5 line-clamp-2 text-sm leading-relaxed ${
            isUnread ? 'font-medium text-foreground' : 'text-foreground/80'
          }`}
        >
          {notification.content}
        </p>
      </div>
      {isUnread && (
        <span
          className="mt-1.5 size-2 shrink-0 rounded-full bg-primary"
          aria-label="Chưa đọc"
        />
      )}
    </motion.button>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'vừa xong';
  if (diffMin < 60) return `${diffMin} phút`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH} giờ`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD} ngày`;
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
}
