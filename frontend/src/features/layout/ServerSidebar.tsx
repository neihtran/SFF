import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import { serversApi, type Server } from '@/features/servers/api/servers';
import { motion } from 'motion/react';

interface ServerSidebarProps {
  onSelectServer: (server: Server) => void;
  selectedServerId?: string;
}

export function ServerSidebar({
  onSelectServer,
  selectedServerId,
}: ServerSidebarProps): React.ReactElement {
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const navigate = useNavigate();
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    serversApi.listMine().then(setServers).catch(console.error).finally(() => setLoading(false));
  }, []);

  async function handleCreateServer() {
    const name = window.prompt('Tên server mới:');
    if (!name) return;
    const srv = await serversApi.create(name);
    setServers((prev) => [srv, ...prev]);
    onSelectServer(srv);
  }

  async function handleJoinServer() {
    const code = window.prompt('Mã invite:');
    if (!code) return;
    try {
      await serversApi.join(code);
      const updated = await serversApi.listMine();
      setServers(updated);
      toast.success('Đã tham gia server!');
    } catch {
      toast.error('Mã không hợp lệ');
    }
  }

  function handleLogout() {
    clearAuth();
    navigate('/auth/login');
  }

  if (loading) {
    return (
      <aside className="flex h-full w-16 flex-col items-center gap-2 bg-sidebar py-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="size-10 animate-pulse rounded-full bg-muted" />
        ))}
      </aside>
    );
  }

  return (
    <aside className="flex h-full w-16 flex-col items-center gap-2 bg-sidebar py-3">
      {/* Home */}
      <button
        onClick={() => navigate('/app')}
        className="group flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:rounded-2xl hover:bg-primary hover:text-primary-foreground"
        title="Trang chủ"
      >
        <span className="text-lg font-bold">SFF</span>
      </button>

      <div className="mx-2 h-px w-8 bg-border" />

      {/* Server list with stagger animation */}
      <motion.div
        initial="hidden"
        animate="visible"
        variants={{
          hidden: {},
          visible: { transition: { staggerChildren: 0.05 } },
        }}
        className="flex flex-col items-center gap-2"
      >
        {servers.map((srv) => (
          <motion.button
            key={srv.id}
            variants={{
              hidden: { opacity: 0, scale: 0.8 },
              visible: { opacity: 1, scale: 1 },
            }}
            onClick={() => onSelectServer(srv)}
            className={`group relative flex size-10 items-center justify-center rounded-[16px] text-sm font-bold transition-all duration-150 ${
              srv.id === selectedServerId
                ? 'rounded-2xl bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:rounded-2xl hover:bg-primary hover:text-primary-foreground'
            }`}
            title={srv.name}
          >
            {srv.iconUrl ? (
              <img src={srv.iconUrl} alt={srv.name} className="size-9 rounded-[14px] object-cover" />
            ) : (
              <span>{srv.name.slice(0, 2).toUpperCase()}</span>
            )}
          </motion.button>
        ))}
      </motion.div>

      {/* Create server */}
      <button
        onClick={handleCreateServer}
        className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground transition-all hover:rounded-2xl hover:bg-green-600 hover:text-white"
        title="Tạo server mới"
      >
        <Plus size={20} />
      </button>

      {/* Join server */}
      <button
        onClick={handleJoinServer}
        className="mt-auto flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-blue-600 hover:text-white"
        title="Tham gia server"
      >
        <span className="text-xs">↗</span>
      </button>

      {/* Logout */}
      {user && (
        <button
          onClick={handleLogout}
          className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-destructive hover:text-white"
          title="Đăng xuất"
        >
          <span className="text-xs">↩</span>
        </button>
      )}
    </aside>
  );
}
