import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { Sparkles } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { aiApi } from '@/features/ai/api/ai';
import { TypingDots } from '@/components/TypingDots';

interface CatchUpDialogProps {
  open: boolean;
  onClose: () => void;
  channelId: string;
  channelName: string;
}

export function CatchUpDialog({ open, onClose, channelId, channelName }: CatchUpDialogProps): React.ReactElement {
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  async function loadCatchUp() {
    if (fetched && summary) return;
    setLoading(true);
    try {
      const { summary: s } = await aiApi.catchUp(channelId);
      setSummary(s);
      setFetched(true);
    } catch {
      toast.error('Không thể tải tóm tắt');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles size={18} className="text-accent-ai" />
            Tóm tắt #{channelName}
          </DialogTitle>
        </DialogHeader>

        <AnimatePresence mode="wait">
          {loading && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 py-8 text-muted-foreground"
            >
              <TypingDots />
              <span className="text-sm italic">AI đang tóm tắt các tin nhắn gần đây…</span>
            </motion.div>
          )}

          {!loading && summary && (
            <motion.div
              key="summary"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="rounded-lg border border-accent-ai/30 bg-accent-ai/5 p-4"
            >
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{summary}</p>
            </motion.div>
          )}

          {!loading && !summary && (
            <motion.p
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="py-6 text-center text-sm text-muted-foreground"
            >
              Chưa có tóm tắt nào. Nhấn nút bên dưới để AI tóm tắt các tin nhắn gần đây.
            </motion.p>
          )}
        </AnimatePresence>

        <div className="flex justify-end">
          {!summary && (
            <Button onClick={loadCatchUp} disabled={loading}>
              {loading ? 'Đang tóm tắt…' : 'Tóm tắt'}
            </Button>
          )}
          {summary && (
            <Button variant="outline" onClick={loadCatchUp} disabled={loading}>
              Tóm tắt lại
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
