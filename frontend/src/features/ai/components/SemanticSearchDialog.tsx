import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { aiApi, type SemanticResult } from '@/features/ai/api/ai';

interface SemanticSearchDialogProps {
  open: boolean;
  onClose: () => void;
  serverId: string;
  onJumpToMessage: (channelId: string, messageId: string) => void;
}

export function SemanticSearchDialog({ open, onClose, serverId, onJumpToMessage }: SemanticSearchDialogProps): React.ReactElement {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SemanticResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const res = await aiApi.semanticSearch(query, serverId);
      setResults(res);
    } catch {
      toast.error('Không thể tìm kiếm');
    } finally {
      setLoading(false);
    }
  }

  function handleResultClick(result: SemanticResult) {
    onJumpToMessage(result.channelId, result.messageId);
    onClose();
    setQuery('');
    setResults([]);
    setSearched(false);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search size={18} /> Tìm kiếm ngữ nghĩa
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSearch} className="flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="VD: hỏi về quy định server…"
            className="flex-1"
            autoFocus
          />
          <Button type="submit" disabled={loading || !query.trim()}>
            {loading ? '…' : 'Tìm'}
          </Button>
        </form>

        <div className="max-h-96 space-y-2 overflow-y-auto">
          {!searched && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nhập từ khoá để tìm tin nhắn liên quan
            </p>
          )}

          {searched && !loading && results.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Không tìm thấy kết quả phù hợp
            </p>
          )}

          {loading && (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-lg" />
              ))}
            </div>
          )}

          <AnimatePresence>
            {results.map((r, i) => (
              <motion.div
                key={r.messageId}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <button
                  onClick={() => handleResultClick(r)}
                  className="w-full rounded-lg border border-border p-3 text-left transition-colors hover:bg-muted"
                >
                  <div className="mb-1 flex items-center gap-2">
                    <span className="text-xs font-semibold text-primary">#{r.channelName}</span>
                    <span className="text-xs text-muted-foreground">{r.senderName}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {new Date(r.createdAt).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="line-clamp-2 text-sm">{r.content}</p>
                  <div className="mt-1 h-1 rounded-full bg-primary/20">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.round(r.similarity * 100)}%` }}
                    />
                  </div>
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}
