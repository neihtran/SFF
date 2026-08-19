import { useState } from 'react';
import { toast } from 'sonner';
import { Check, RefreshCw, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { axiosClient } from '@/lib/axiosClient';
import type { Server } from '@/features/servers/api/servers';

interface ServerSettingsPanelProps {
  server: Server;
  onClose: () => void;
  onServerUpdate: (server: Server) => void;
}

export function ServerSettingsPanel({ server, onClose, onServerUpdate }: ServerSettingsPanelProps): React.ReactElement {
  const [copied, setCopied] = useState(false);

  async function copyInviteCode() {
    await navigator.clipboard.writeText(server.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function regenerateInvite() {
    try {
      const { data } = await axiosClient.post<{ inviteCode: string }>(`/servers/${server.id}/invite-code`);
      onServerUpdate({ ...server, inviteCode: data.inviteCode });
      toast.success('Đã tạo mã mời mới');
    } catch {
      toast.error('Không thể tạo mã mời');
    }
  }

  return (
    <div className="flex h-full flex-col bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="font-semibold">Cài đặt Server</h2>
        <Button variant="ghost" size="sm" onClick={onClose}>×</Button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground">Mời thành viên</h3>
          <div className="flex items-center gap-2">
            <Input value={server.inviteCode} readOnly className="font-mono text-xs" />
            <Button size="sm" variant="outline" onClick={copyInviteCode} title="Sao chép">
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </Button>
            <Button size="sm" variant="outline" onClick={regenerateInvite} title="Tạo mã mới">
              <RefreshCw size={14} />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Chia sẻ mã này để mời người khác tham gia server.</p>
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground">Đổi tên server</h3>
          <ServerRenameForm server={server} onServerUpdate={onServerUpdate} />
        </section>
      </div>
    </div>
  );
}

function ServerRenameForm({ server, onServerUpdate }: { server: Server; onServerUpdate: (s: Server) => void }): React.ReactElement {
  const [name, setName] = useState(server.name);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim() || name === server.name) return;
    setSaving(true);
    try {
      const { data } = await axiosClient.patch<Server>(`/servers/${server.id}`, { name: name.trim() });
      onServerUpdate(data);
      toast.success('Đã đổi tên server');
    } catch {
      toast.error('Không thể đổi tên');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Input value={name} onChange={(e) => setName(e.target.value)} className="flex-1" />
      <Button size="sm" onClick={handleSave} disabled={saving || name === server.name}>
        {saving ? '…' : 'Lưu'}
      </Button>
    </div>
  );
}
