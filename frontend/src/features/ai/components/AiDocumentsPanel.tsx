import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { FileText, Plus, Trash2, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { aiApi, type AiDocument } from '@/features/ai/api/ai';

interface AiDocumentsPanelProps {
  open: boolean;
  onClose: () => void;
  serverId: string;
}

export function AiDocumentsPanel({ open, onClose, serverId }: AiDocumentsPanelProps): React.ReactElement {
  const [documents, setDocuments] = useState<AiDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    aiApi.listDocuments(serverId)
      .then(setDocuments)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [open, serverId]);

  async function handleUpload() {
    if (!title.trim() || !content.trim()) return;
    setUploading(true);
    try {
      const doc = await aiApi.uploadDocument(serverId, title.trim(), content.trim());
      setDocuments((prev) => [doc, ...prev]);
      setTitle('');
      setContent('');
      setShowUpload(false);
      toast.success('Đang xử lý tài liệu…');
    } catch {
      toast.error('Không thể nạp tài liệu');
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(docId: string) {
    if (!window.confirm('Xoá tài liệu này?')) return;
    try {
      await aiApi.deleteDocument(serverId, docId);
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
      toast.success('Đã xoá tài liệu');
    } catch {
      toast.error('Không thể xoá tài liệu');
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText size={18} /> Tài liệu AI
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setShowUpload(true)}>
              <Plus size={14} className="mr-1" /> Thêm tài liệu
            </Button>
          </div>

          {showUpload && (
            <div className="space-y-2 rounded-lg border border-border p-3">
              <Input
                placeholder="Tiêu đề tài liệu"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <Textarea
                placeholder="Nội dung tài liệu…"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={5}
                className="resize-none"
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowUpload(false)}>Huỷ</Button>
                <Button size="sm" onClick={handleUpload} disabled={uploading || !title.trim() || !content.trim()}>
                  {uploading ? <Loader2 size={14} className="animate-spin" /> : 'Nạp'}
                </Button>
              </div>
            </div>
          )}

          {loading ? (
            [...Array(2)].map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-md" />)
          ) : documents.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Chưa có tài liệu nào. Nạp tài liệu để AI có thể trả lời dựa trên nội dung.
            </p>
          ) : (
            documents.map((doc) => (
              <div key={doc.id} className="flex items-center gap-3 rounded-md border border-border p-3">
                <FileText size={16} className="shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{doc.title}</span>
                    {doc.status === 'PROCESSING' && (
                      <Badge variant="outline" className="text-xs">
                        <Loader2 size={10} className="animate-spin mr-1" /> Đang xử lý
                      </Badge>
                    )}
                    {doc.status === 'READY' && (
                      <Badge variant="secondary" className="text-xs">{doc.chunkCount} chunks</Badge>
                    )}
                    {doc.status === 'FAILED' && (
                      <Badge variant="destructive" className="text-xs">Lỗi</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(doc.createdAt).toLocaleString('vi-VN')}
                  </p>
                </div>
                <Button variant="ghost" size="icon" className="size-7 text-destructive" onClick={() => handleDelete(doc.id)}>
                  <Trash2 size={14} />
                </Button>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
