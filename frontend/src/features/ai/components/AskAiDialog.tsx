import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { Send, BotMessageSquare } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { aiApi } from '@/features/ai/api/ai';
import { TypingDots } from '@/components/TypingDots';

interface AskAiDialogProps {
  open: boolean;
  onClose: () => void;
  channelId: string;
}

interface ChatMessage {
  role: 'user' | 'ai';
  content: string;
  timestamp: string;
}

export function AskAiDialog({ open, onClose, channelId }: AskAiDialogProps): React.ReactElement {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function handleSend() {
    if (!input.trim() || loading) return;
    const userMsg: ChatMessage = { role: 'user', content: input.trim(), timestamp: new Date().toISOString() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    try {
      const { answer } = await aiApi.askAi(channelId, userMsg.content);
      setMessages((prev) => [
        ...prev,
        { role: 'ai', content: answer, timestamp: new Date().toISOString() },
      ]);
    } catch {
      toast.error('AI không trả lời được');
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onClose(); setMessages([]); } }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BotMessageSquare size={18} className="text-accent-ai" />
            AI Assistant
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-80 min-h-40">
          <div className="space-y-3 p-1">
            {messages.length === 0 && !loading && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Gửi câu hỏi cho AI Assistant của server này. AI sẽ tìm kiếm trong tài liệu đã nạp và tin nhắn gần đây.
              </p>
            )}

            <AnimatePresence initial={false}>
              {messages.map((msg, i) => (
                <motion.div
                  key={`${msg.timestamp}-${i}`}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  className={`flex gap-2 ${msg.role === 'ai' ? 'rounded-lg border border-accent-ai/40 bg-accent-ai/5 p-3' : ''}`}
                >
                  {msg.role === 'ai' && (
                    <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-ai text-xs font-bold text-white">
                      AI
                    </div>
                  )}
                  <div className="flex-1">
                    {msg.role === 'user' && (
                      <div className="mb-1 text-xs font-semibold text-muted-foreground">Bạn</div>
                    )}
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
                  </div>
                </motion.div>
              ))}

              {loading && (
                <motion.div
                  key="typing"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2 rounded-lg border border-accent-ai/40 bg-accent-ai/5 p-3 text-muted-foreground"
                >
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-ai text-xs font-bold text-white">
                    AI
                  </div>
                  <div className="flex items-center gap-2 text-sm italic">
                    <TypingDots className="text-accent-ai" />
                    <span>AI đang suy nghĩ…</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div ref={bottomRef} />
        </ScrollArea>

        <div className="flex gap-2 pt-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Hỏi AI…"
            rows={1}
            className="min-h-0 flex-1 resize-none"
          />
          <Button onClick={handleSend} disabled={loading || !input.trim()} className="shrink-0 gap-1">
            <Send size={14} /> Gửi
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
