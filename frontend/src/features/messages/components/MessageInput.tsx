import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface MessageInputProps {
  channelId: string;
  socket: import('socket.io-client').Socket;
  onSend: (content: string) => Promise<void>;
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
    setSending(true);
    const content = text.trim();
    setText('');
    emitTyping(false);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    try {
      await onSend(content);
    } catch {
      setText(content);
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
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
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2 rounded-lg border border-input bg-muted/40">
        <label className="flex size-9 cursor-pointer items-center justify-center text-muted-foreground hover:text-foreground" title="Đính kèm file">
          <input type="file" multiple className="hidden" onChange={handleFileChange} accept="image/*,.pdf,.doc,.docx,.txt" />
          📎
        </label>

        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => handleInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled || sending}
          placeholder={`Nhắn tin… (gõ @AI để hỏi AI)`}
          rows={1}
          className={cn(
            'flex-1 resize-none bg-transparent px-1 py-2 outline-none placeholder:text-muted-foreground disabled:opacity-50',
          )}
          style={{ maxHeight: '200px' }}
        />

        <Popover open={showEmoji} onOpenChange={setShowEmoji}>
          <PopoverTrigger asChild>
            <button className="flex size-9 items-center justify-center text-muted-foreground hover:text-foreground" title="Biểu tượng cảm xúc">😀</button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-auto p-2">
            <div className="grid grid-cols-6 gap-1">
              {QUICK_EMOJIS.map((emoji) => (
                <button key={emoji} onClick={() => handleEmoji(emoji)} className="flex size-8 items-center justify-center rounded text-lg hover:bg-muted">
                  {emoji}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <button
          onClick={handleSend}
          disabled={!text.trim() || sending}
          className="flex size-9 items-center justify-center text-primary hover:text-primary/80 disabled:opacity-30"
          title="Gửi"
        >
          ➤
        </button>
      </div>
    </div>
  );
}
