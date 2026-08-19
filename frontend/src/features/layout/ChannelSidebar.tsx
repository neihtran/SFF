import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Hash, Volume2, Plus, Settings, Users } from 'lucide-react';
import { toast } from 'sonner';
import { channelsApi, type Channel } from '@/features/channels/api/channels';
import { serversApi } from '@/features/servers/api/servers';

interface ChannelSidebarProps {
  serverId: string;
  selectedChannelId?: string;
  onSelectChannel: (channel: Channel) => void;
  onSelectVoice: (channel: Channel) => void;
  onOpenMembers: () => void;
  onOpenSettings: () => void;
  onCreateChannel: () => void;
  isModerator: boolean;
}

export function ChannelSidebar({
  serverId,
  selectedChannelId,
  onSelectChannel,
  onSelectVoice,
  onOpenMembers,
  onOpenSettings,
  onCreateChannel,
  isModerator,
}: ChannelSidebarProps): React.ReactElement {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [serverName, setServerName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([channelsApi.list(serverId), serversApi.getOne(serverId)])
      .then(([chs, srv]) => {
        if (cancelled) return;
        setChannels(chs);
        setServerName(srv.name);
      })
      .catch((err) => {
        if (cancelled) return;
        const status = err?.response?.status;
        const msg =
          status === 403
            ? 'Bạn không có quyền truy cập server này'
            : status === 404
              ? 'Server không tồn tại'
              : 'Không thể tải danh sách channel';
        toast.error(msg);
        setChannels([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [serverId]);

  const textChannels = channels.filter((c) => c.type === 'TEXT');
  const voiceChannels = channels.filter((c) => c.type === 'VOICE');

  if (loading) {
    return (
      <aside className="flex h-full w-60 flex-col bg-sidebar">
        <div className="flex h-12 items-center gap-2 border-b border-border px-3">
          <div className="h-4 w-24 animate-pulse rounded bg-muted" />
        </div>
        {[...Array(6)].map((_, i) => (
          <div key={i} className="mx-2 mt-2 h-8 animate-pulse rounded bg-muted" />
        ))}
      </aside>
    );
  }

  return (
    <aside className="flex h-full w-60 flex-col bg-sidebar">
      {/* Server header */}
      <div className="flex h-12 items-center justify-between border-b border-border px-3">
        <h2 className="truncate text-sm font-semibold">{serverName}</h2>
        <div className="flex items-center gap-1">
          <button
            onClick={onOpenMembers}
            className="flex size-7 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Thành viên"
          >
            <Users size={14} />
          </button>
          <button
            onClick={onOpenSettings}
            className="flex size-7 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Cài đặt"
          >
            <Settings size={14} />
          </button>
        </div>
      </div>

      {/* Channel list */}
      <div className="flex-1 overflow-y-auto py-2">
        {textChannels.length > 0 && (
          <section className="mb-4">
            <div className="mb-1 flex items-center justify-between px-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Text Channels</span>
              {isModerator && (
                <button
                  onClick={onCreateChannel}
                  className="flex size-5 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted"
                  title="Tạo channel"
                >
                  <Plus size={12} />
                </button>
              )}
            </div>
            <motion.div
              initial="hidden"
              animate="visible"
              variants={{
                hidden: {},
                visible: { transition: { staggerChildren: 0.04 } },
              }}
            >
              {textChannels.map((ch) => (
                <motion.button
                  key={ch.id}
                  variants={{
                    hidden: { opacity: 0, x: -8 },
                    visible: { opacity: 1, x: 0 },
                  }}
                  onClick={() => onSelectChannel(ch)}
                  className={`flex w-full items-center gap-2 px-2 py-1.5 text-sm transition-colors ${
                    ch.id === selectedChannelId
                      ? 'bg-primary/20 text-primary font-medium'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <Hash size={16} className="shrink-0" />
                  <span className="truncate">{ch.name}</span>
                </motion.button>
              ))}
            </motion.div>
          </section>
        )}

        {voiceChannels.length > 0 && (
          <section className="mb-4">
            <div className="mb-1 flex items-center justify-between px-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Voice Channels</span>
              {isModerator && (
                <button
                  onClick={onCreateChannel}
                  className="flex size-5 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted"
                  title="Tạo channel"
                >
                  <Plus size={12} />
                </button>
              )}
            </div>
            {voiceChannels.map((ch) => (
              <button
                key={ch.id}
                onClick={() => onSelectVoice(ch)}
                className={`flex w-full items-center gap-2 px-2 py-1.5 text-sm transition-colors ${
                  ch.id === selectedChannelId
                    ? 'bg-primary/20 text-primary font-medium'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <Volume2 size={16} className="shrink-0" />
                <span className="truncate">{ch.name}</span>
              </button>
            ))}
          </section>
        )}

        {channels.length === 0 && (
          <p className="px-3 text-sm text-muted-foreground">
            Chưa có channel nào.
          </p>
        )}
      </div>
    </aside>
  );
}
