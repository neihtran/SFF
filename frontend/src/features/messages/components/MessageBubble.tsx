import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import type { Message } from '../api/messages';

const AI_AVATAR_FALLBACK = '🤖';

interface MessageBubbleProps {
  message: Message;
  currentUserId?: string;
  isLast: boolean;
  onEdit?: (messageId: string, content: string) => void;
  onDelete?: (messageId: string) => void;
  onReaction?: (messageId: string, emoji: string) => void;
  onRemoveReaction?: (messageId: string, reactionId: string) => void;
  onTranslate?: (messageId: string) => void;
  translatedContent?: string;
}

export function MessageBubble({
  message,
  currentUserId,
  translatedContent,
  onEdit,
  onDelete,
  onReaction,
  onRemoveReaction,
  onTranslate,
}: MessageBubbleProps): React.ReactElement {
  const isOwn = currentUserId != null && message.senderId === currentUserId;
  const isAi = message.isAiReply;
  const [showTranslations, setShowTranslations] = useState<Record<string, string>>({});
  const [translating, setTranslating] = useState<Record<string, boolean>>({});
  const [showActions, setShowActions] = useState(false);

  const senderName = isAi ? (message.aiServerName ?? 'AI Assistant') : (message.sender?.name ?? 'Unknown');
  const avatarFallback = isAi ? AI_AVATAR_FALLBACK : (senderName.slice(0, 2).toUpperCase());

  async function handleTranslate() {
    if (!onTranslate) return;
    if (showTranslations[message.id]) {
      setShowTranslations((prev) => ({ ...prev, [message.id]: '' }));
      return;
    }
    setTranslating((prev) => ({ ...prev, [message.id]: true }));
    try {
      onTranslate(message.id);
    } finally {
      setTranslating((prev) => ({ ...prev, [message.id]: false }));
    }
  }

  return (
    <div
      className={cn(
        'group relative flex gap-3 py-1',
        isAi && 'rounded-lg border border-accent-ai/40 bg-accent-ai/5 px-3 py-2',
      )}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Avatar */}
      <div className="shrink-0">
        <Avatar className="size-9">
          <AvatarFallback className={cn(isAi ? 'bg-accent-ai/20 text-accent-ai' : 'bg-muted')}>
            {avatarFallback}
          </AvatarFallback>
        </Avatar>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Header row */}
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className={cn('text-sm font-semibold', isAi && 'text-accent-ai')}>
            {senderName}
          </span>
          {isAi && (
            <span className="rounded bg-accent-ai px-1.5 py-0.5 text-[10px] font-bold text-white">
              AI
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            {new Date(message.createdAt).toLocaleString('vi-VN', {
              day: '2-digit',
              month: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
          {message.editedAt && (
            <span className="text-xs text-muted-foreground">(đã sửa)</span>
          )}
        </div>

        {/* Main text */}
        <p className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-relaxed">
          {message.content}
        </p>

        {/* Inline translation */}
        {translatedContent && (
          <p className="mt-1 rounded border border-muted bg-muted/30 px-2 py-1 text-xs italic text-muted-foreground">
            🌐 {translatedContent}
          </p>
        )}

        {/* Inline translation */}
        {showTranslations[message.id] && (
          <p className="mt-1 rounded border border-muted bg-muted/30 px-2 py-1 text-xs italic text-muted-foreground">
            {showTranslations[message.id]}
          </p>
        )}

        {/* Attachments */}
        {message.attachments.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-2">
            {message.attachments.map((att) =>
              att.fileType === 'image' ? (
                <img
                  key={att.id}
                  src={att.fileUrl}
                  alt={att.fileName}
                  className="max-h-64 max-w-sm cursor-pointer rounded-md object-contain hover:opacity-90"
                  onClick={() => window.open(att.fileUrl, '_blank')}
                />
              ) : (
                <a
                  key={att.id}
                  href={att.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 rounded border border-border bg-muted px-2 py-1 text-xs text-primary hover:bg-muted/80"
                >
                  📎 {att.fileName}
                </a>
              ),
            )}
          </div>
        )}

        {/* Reactions */}
        {message.reactions.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {message.reactions.map((r) => {
              const isSelf = currentUserId != null && r.user.id === currentUserId;
              return (
                <button
                  key={r.id}
                  onClick={() => {
                    if (isSelf && onRemoveReaction) {
                      onRemoveReaction(message.id, r.id);
                    }
                  }}
                  className={cn(
                    'flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors',
                    isSelf
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-muted hover:bg-muted/80',
                  )}
                  title={`${r.user.name}`}
                >
                  {r.emoji}
                  <span className="font-medium">{r.user.name}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Hover action menu */}
        {(showActions || false) && (
          <div className="absolute -top-3 right-2 flex items-center gap-0.5 rounded-md border border-border bg-card p-0.5 shadow-sm">
            {onReaction && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="size-7 text-muted-foreground">
                    😀
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-2">
                  <EmojiPicker
                    onSelect={(emoji) => {
                      onReaction(message.id, emoji);
                    }}
                  />
                </PopoverContent>
              </Popover>
            )}
            {onTranslate && (
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground"
                onClick={handleTranslate}
                disabled={translating[message.id]}
                title="Dịch"
              >
                🌐
              </Button>
            )}
            {isOwn && onEdit && (
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground"
                onClick={() => onEdit(message.id, message.content)}
                title="Sửa"
              >
                ✏️
              </Button>
            )}
            {isOwn && onDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-destructive"
                onClick={() => onDelete(message.id)}
                title="Xoá"
              >
                🗑️
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '✅', '🎉', '👀', '💯', '🤔'];

function EmojiPicker({ onSelect }: { onSelect: (emoji: string) => void }): React.ReactElement {
  return (
    <div className="grid grid-cols-6 gap-1">
      {QUICK_EMOJIS.map((emoji) => (
        <button
          key={emoji}
          onClick={() => onSelect(emoji)}
          className="flex size-8 items-center justify-center rounded text-lg hover:bg-muted"
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
