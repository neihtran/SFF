import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { aiApi } from '@/features/ai/api/ai';

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
    <Dialog open={open} onOpenChange={(o) => { if (o) loadCatchUp(); onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Tóm tắt #{channelName}</DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center gap-2 py-8">
            <Loader2 size={20} className="animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">AI đang tóm tắt…</span>
          </div>
        )}

        {!loading && summary && (
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{summary}</p>
          </div>
        )}

        {!loading && !summary && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Chưa có tóm tắt nào. Nhấn nút bên dưới để AI tóm tắt các tin nhắn gần đây.
          </p>
        )}

        <div className="flex justify-end">
          {!summary && (
            <Button onClick={loadCatchUp} disabled={loading}>
              {loading ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
              Tóm tắt
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
