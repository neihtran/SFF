import { useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { serversApi } from '@/features/servers/api/servers';

interface JoinServerModalProps {
  open: boolean;
  onClose: () => void;
  onJoined: () => void;
}

export function JoinServerModal({ open, onClose, onJoined }: JoinServerModalProps): React.ReactElement {
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    try {
      await serversApi.join(code.trim());
      toast.success('Đã tham gia server!');
      onJoined();
      onClose();
      setCode('');
    } catch {
      toast.error('Mã không hợp lệ hoặc server không tồn tại');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Tham gia server</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Mã mời</label>
            <Input
              className="mt-1"
              placeholder="VD: abc123xyz"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Mã mời có dạng: <code className="rounded bg-muted px-1">abc123xyz</code>
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Huỷ</Button>
            <Button type="submit" disabled={loading || !code.trim()}>
              {loading ? 'Đang tham gia…' : 'Tham gia'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
