import { motion } from 'motion/react';

/**
 * 3 chấm bounce nhỏ — dùng cho AI loading / typing indicators.
 * Chuẩn hóa cách hiển thị "AI đang suy nghĩ…" trong cả CatchUp và AskAi.
 */
export function TypingDots({ className = '' }: { className?: string }): React.ReactElement {
  const dotTransition = {
    duration: 1.2,
    repeat: Infinity,
    ease: 'easeInOut' as const,
  };

  return (
    <span className={`inline-flex items-center gap-1 ${className}`} aria-label="AI đang trả lời">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="inline-block size-1.5 rounded-full bg-current"
          animate={{ y: [0, -3, 0], opacity: [0.4, 1, 0.4] }}
          transition={{ ...dotTransition, delay: i * 0.15 }}
        />
      ))}
    </span>
  );
}