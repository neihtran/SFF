import { useEffect, useRef, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { MessageBubble } from './MessageBubble';
import { MessageInput } from './MessageInput';
import { TypingIndicator } from './TypingIndicator';
import { AiTypingBubble } from './AiTypingBubble';
import type { Message } from '../api/messages';
import type { Socket } from 'socket.io-client';
import { messagesApi } from '../api/messages';
import { useAuthStore } from '@/store/authStore';
import { trackChannel } from '@/lib/socketClient';

interface MessageListProps {
  channelId: string;
  currentUserId: string;
  socket: Socket;
}

export function MessageList({ channelId, currentUserId, socket }: MessageListProps): React.ReactElement {
  const user = useAuthStore((s) => s.user);
  const preferredLang = user?.preferredLang ?? 'vi';
  const [messages, setMessages] = useState<Message[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [translating, setTranslating] = useState<Record<string, boolean>>({});
  const [aiThinking, setAiThinking] = useState(false);

  const topRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollDivRef = useRef<HTMLDivElement>(null);
  const isInitialLoad = useRef(true);

  // Load initial messages
  useEffect(() => {
    isInitialLoad.current = true;
    setMessages([]);
    setCursor(null);
    setHasMore(true);
    setTypingUsers([]);
    setAiThinking(false);

    messagesApi.list(channelId).then((res) => {
      setMessages(res.items);
      setCursor(res.nextCursor);
      setHasMore(res.hasMore);
      isInitialLoad.current = false;
    }).catch(() => {
      toast.error('Không tải được tin nhắn');
      isInitialLoad.current = false;
    });
  }, [channelId]);

  // Socket listeners
  useEffect(() => {
    socket.emit('channel:join', { channelId });
    trackChannel(channelId, true);

    function onMessage(msg: Message) {
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      if (msg.isAiReply) setAiThinking(false);
    }
    function onEdited(msg: Message) {
      setMessages((prev) => prev.map((m) => m.id === msg.id ? msg : m));
    }
    function onDeleted(payload: { id: string }) {
      setMessages((prev) => prev.filter((m) => m.id !== payload.id));
    }
    function onReaction(payload: { messageId: string; reactions: Message['reactions'] }) {
      setMessages((prev) =>
        prev.map((m) => m.id === payload.messageId ? { ...m, reactions: payload.reactions } : m),
      );
    }
    function onTypingUpdate(payload: { channelId: string; userId: string; name: string; typing: boolean }) {
      if (payload.channelId !== channelId || payload.userId === currentUserId) return;
      setTypingUsers((prev) => {
        if (payload.typing) return prev.includes(payload.name) ? prev : [...prev, payload.name];
        return prev.filter((n) => n !== payload.name);
      });
    }

    socket.on('message:new', onMessage);
    socket.on('message:edited', onEdited);
    socket.on('message:deleted', onDeleted);
    socket.on('reaction:updated', onReaction);
    socket.on('typing:update', onTypingUpdate);

    return () => {
      socket.emit('channel:leave', { channelId });
      trackChannel(channelId, false);
      socket.off('message:new', onMessage);
      socket.off('message:edited', onEdited);
      socket.off('message:deleted', onDeleted);
      socket.off('reaction:updated', onReaction);
      socket.off('typing:update', onTypingUpdate);
    };
  }, [channelId, socket, currentUserId]);

  // ============================================================
  // FIX scroll: dùng native overflow-y-auto thay vì Radix ScrollArea.
  //
  // Tại sao Radix ScrollArea không hoạt động?
  //  - Radix Root có `overflow: hidden` — ngăn browser layout engine tính flex
  //  - Viewport có `h-full` nhưng Root không có chiều cao giới hạn
  //  → flex-1 không co giãn → scroll không bao giờ trigger
  //
  // Giải pháp: dùng native flex layout + overflow-y-auto (pattern đã hoạt động
  // ở ChannelSidebar). Chain:
  //  AppLayout(h-full) > flex-col > flex-1 > min-h-0 > overflow-y-auto
  //
  // Auto-scroll logic:
  //  - isAtBottom = true khi scrollPercentage > 90%
  //  - Nếu đang ở đáy (isAtBottom=true) → auto-scroll xuống đáy
  //  - Nếu đang ở giữa (isAtBottom=false) → KHÔNG tự kéo xuống
  // ============================================================
  function onScroll() {
    const el = scrollDivRef.current;
    if (!el) return;
    const max = el.scrollHeight - el.clientHeight;
    setIsAtBottom(max > 0 ? (el.scrollTop / max) * 100 > 90 : true);
  }

  // Auto-scroll when new messages arrive + user is at bottom
  useEffect(() => {
    if (isAtBottom && messages.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: isInitialLoad.current ? 'instant' : 'smooth' });
    }
    isInitialLoad.current = false;
  }, [messages, isAtBottom]);

  // Auto-scroll khi AI bắt đầu typing
  useEffect(() => {
    if (aiThinking && isAtBottom) {
      const t = setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      return () => clearTimeout(t);
    }
  }, [aiThinking, isAtBottom]);

  // Timeout an toàn: nếu sau 30s AI không trả lời → ẩn placeholder
  useEffect(() => {
    if (!aiThinking) return;
    const t = setTimeout(() => setAiThinking(false), 30_000);
    return () => clearTimeout(t);
  }, [aiThinking]);

  async function loadMore() {
    if (!cursor || loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const res = await messagesApi.list(channelId, cursor);
      setMessages((prev) => [...res.items, ...prev]);
      setCursor(res.nextCursor);
      setHasMore(res.hasMore);
    } catch {
      toast.error('Không tải được tin nhắn cũ');
    } finally {
      setLoadingMore(false);
    }
  }

  async function handleSend(content: string, attachmentUrls?: string[]) {
    if (/^@AI(\s|$)/i.test(content)) setAiThinking(true);
    await messagesApi.create(channelId, content, attachmentUrls);
  }

  async function handleEdit(messageId: string, currentContent: string) {
    const newContent = window.prompt('Sửa tin nhắn:', currentContent);
    if (newContent === null || newContent.trim() === currentContent) return;
    try {
      await messagesApi.update(messageId, newContent.trim());
    } catch {
      toast.error('Không thể sửa tin nhắn');
    }
  }

  async function handleDelete(messageId: string) {
    if (!window.confirm('Xoá tin nhắn này?')) return;
    try {
      await messagesApi.delete(messageId);
    } catch {
      toast.error('Không thể xoá tin nhắn');
    }
  }

  async function handleReaction(messageId: string, emoji: string) {
    try {
      await messagesApi.addReaction(messageId, emoji);
    } catch {
      toast.error('Không thể thêm reaction');
    }
  }

  async function handleRemoveReaction(messageId: string, reactionId: string) {
    try {
      await messagesApi.removeReaction(messageId, reactionId);
    } catch {
      toast.error('Không thể xoá reaction');
    }
  }

  async function handleTranslate(messageId: string) {
    try {
      setTranslating((prev) => ({ ...prev, [messageId]: true }));
      const { translatedText } = await messagesApi.translate(messageId, preferredLang);
      setTranslations((prev) => ({ ...prev, [messageId]: translatedText }));
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? 'Không thể dịch tin nhắn');
    } finally {
      setTranslating((prev) => ({ ...prev, [messageId]: false }));
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* Native scroll container — dùng overflow-y-auto thay vì Radix ScrollArea */}
      <div
        ref={scrollDivRef}
        className="min-h-0 flex-1 overflow-y-auto"
        onScroll={onScroll}
      >
        {hasMore && (
          <div className="flex justify-center py-2" ref={topRef}>
            {loadingMore ? (
              <Skeleton className="h-6 w-32 rounded-full" />
            ) : (
              <button
                onClick={loadMore}
                className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:bg-muted"
              >
                Tải tin nhắn cũ hơn
              </button>
            )}
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              currentUserId={currentUserId}
              isLast={i === messages.length - 1}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onReaction={handleReaction}
              onRemoveReaction={handleRemoveReaction}
              onTranslate={handleTranslate}
              translatedContent={translations[msg.id]}
              isTranslating={!!translating[msg.id]}
            />
          ))}
          {aiThinking && <AiTypingBubble key="ai-thinking-placeholder" />}
        </AnimatePresence>

        <div ref={bottomRef} className="h-1" />
      </div>

      <TypingIndicator typingUsers={typingUsers} />
      <MessageInput channelId={channelId} socket={socket} onSend={handleSend} />
    </div>
  );
}
