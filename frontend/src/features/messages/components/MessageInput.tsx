import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { storageApi } from '@/features/storage/api/storage';

interface MessageInputProps {
  channelId: string;
  socket: import('socket.io-client').Socket;
  /**
   * Callback khi gửi message.
   * - `attachmentUrls`: optional, mảng URL đã upload (qua storageApi.upload).
   *   Nếu truyền rỗng/undefined → message chỉ có text.
   */
  onSend: (content: string, attachmentUrls?: string[]) => Promise<void>;
  disabled?: boolean;
}

const QUICK_EMOJIS = ['😀', '😂', '❤️', '😮', '😢', '🙏', '🔥', '✅', '🎉', '👀', '💯', '🤔'];

export function MessageInput({ channelId, socket, onSend, disabled }: MessageInputProps): React.ReactElement {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [previews, setPreviews] = useState<File[]>([]);
  const [showEmoji, setShowEmoji] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const isTyping = useRef(false);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
  }, [text]);

  // Cleanup object URLs khi component unmount hoặc previews đổi
  useEffect(() => {
    const urls = previews.map((f) => URL.createObjectURL(f));
    return () => {
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [previews]);

  function emitTyping(active: boolean) {
    if (active && !isTyping.current) {
      socket.emit('typing:start', { channelId });
      isTyping.current = true;
    } else if (!active && isTyping.current) {
      socket.emit('typing:stop', { channelId });
      isTyping.current = false;
    }
  }

  function handleInput(value: string) {
    setText(value);
    emitTyping(true);
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => emitTyping(false), 1500);
  }

  async function handleSend() {
    if (!text.trim() || sending || disabled) return;

    // Validate: cần có text HOẶC có file đính kèm
    if (!text.trim() && previews.length === 0) return;

    setSending(true);
    const content = text.trim();
    const files = [...previews];
    setText('');
    setPreviews([]);
    emitTyping(false);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    try {
      // Upload files song song → lấy URLs
      let attachmentUrls: string[] = [];
      if (files.length > 0) {
        try {
          const results = await Promise.all(files.map((f) => storageApi.upload(f)));
          attachmentUrls = results.map((r) => r.url);
        } catch (uploadErr) {
          const msg =
            (uploadErr as { response?: { data?: { message?: string } } })?.response?.data?.message ??
            'Upload file thất bại';
          toast.error(msg);
          // Khôi phục text + files để user retry
          setText(content);
          setPreviews(files);
          return;
        }
      }

      await onSend(content, attachmentUrls.length > 0 ? attachmentUrls : undefined);
    } catch {
      // Gửi message fail (không phải upload fail)
      setText(content);
      setPreviews(files);
      toast.error('Không gửi được tin nhắn');
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  function handleEmoji(emoji: string) {
    setText((prev) => prev + emoji);
    textareaRef.current?.focus();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    setPreviews((prev) => [...prev, ...files]);
    e.target.value = '';
  }

  function removePreview(index: number) {
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  }

  const canSend = (text.trim().length > 0 || previews.length > 0) && !sending;

  return (
    <div className="border-t border-border bg-background px-4 py-3">
      {previews.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {previews.map((file, i) => (
            <div key={i} className="relative">
              {file.type.startsWith('image/') ? (
                <img src={URL.createObjectURL(file)} alt={file.name} className="size-16 rounded-md object-cover" />
              ) : (
                <div className="flex size-16 items-center justify-center rounded-md border border-border bg-muted text-xs">
                  📎 {file.name.slice(0, 8)}
                </div>
              )}
              <button
                onClick={() => removePreview(i)}
                className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-destructive text-white text-xs font-bold"
                aria-label="Xoá file"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2 rounded-lg border border-input bg-muted/40">
        <label
          className={cn(
            'flex size-9 shrink-0 cursor-pointer items-center justify-center text-muted-foreground hover:text-foreground',
            (sending || disabled) && 'pointer-events-none opacity-50',
          )}
          title="Đính kèm file"
        >
          <input
            type="file"
            multiple
            className="hidden"
            onChange={handleFileChange}
            accept="image/*,.pdf,.doc,.docx,.txt"
            disabled={sending || disabled}
          />
          📎
        </label>

        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => handleInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled || sending}
          placeholder={sending ? 'Đang upload + gửi…' : 'Nhắn tin… (gõ @AI để hỏi AI)'}
          rows={1}
          className={cn(
            'flex-1 resize-none bg-transparent px-1 py-2 outline-none placeholder:text-muted-foreground disabled:opacity-50',
          )}
          style={{ maxHeight: '200px' }}
        />

        <Popover open={showEmoji} onOpenChange={setShowEmoji}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex size-9 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground"
              title="Biểu tượng cảm xúc"
            >
              😀
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-auto p-2">
            <div className="grid grid-cols-6 gap-1">
              {QUICK_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handleEmoji(emoji)}
                  className="flex size-8 items-center justify-center rounded text-lg hover:bg-muted"
                  type="button"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <button
          onClick={() => void handleSend()}
          disabled={!canSend}
          className="flex size-9 shrink-0 items-center justify-center text-primary hover:text-primary/80 disabled:opacity-30"
          title={sending ? 'Đang gửi…' : 'Gửi'}
          type="button"
        >
          {sending ? <Loader2 size={14} className="animate-spin" /> : '➤'}
        </button>
      </div>
    </div>
  );
}
