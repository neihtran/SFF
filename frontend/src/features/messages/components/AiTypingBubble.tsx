import { motion } from 'motion/react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { TypingDots } from '@/components/TypingDots';

/**
 * Placeholder bubble hiển thị khi user vừa gửi @AI và đang chờ AI reply.
 * - Style giống MessageBubble của AI (border accent-ai, badge AI).
 * - Thay vì content có typing dots nhỏ "AI đang suy nghĩ...".
 * - Tự xoá khi MessageList nhận message:new có isAiReply=true qua socket.
 */
export function AiTypingBubble(): React.ReactElement {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      data-testid="ai-typing-bubble"
      className="group relative flex gap-3 rounded-lg border border-accent-ai/40 bg-accent-ai/5 px-3 py-2"
    >
      <div className="shrink-0">
        <Avatar className="size-9">
          <AvatarFallback className="bg-accent-ai/20 text-accent-ai">🤖</AvatarFallback>
        </Avatar>
      </div>
      <div className="flex flex-1 items-baseline gap-2 min-w-0 flex-wrap">
        <span className="text-sm font-semibold text-accent-ai">AI Assistant</span>
        <span className="rounded bg-accent-ai px-1.5 py-0.5 text-[10px] font-bold text-white">
          AI
        </span>
        <div className="flex items-center gap-1 text-xs italic text-muted-foreground">
          <TypingDots className="text-accent-ai" />
          <span>AI đang suy nghĩ…</span>
        </div>
      </div>
    </motion.div>
  );
}
