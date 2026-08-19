import { useState } from 'react';
import { Moon, Sun, User, Bell, Trash2, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { useUiStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';
import { disconnectSocket } from '@/lib/socketClient';
import { setAccessToken } from '@/lib/axiosClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { axiosClient } from '@/lib/axiosClient';

interface SettingsPanelProps {
  onClose: () => void;
}

export function SettingsPanel({ onClose }: SettingsPanelProps): React.ReactElement {
  const { theme, toggleTheme } = useUiStore();
  const { user, clearAuth } = useAuthStore();
  const [displayName, setDisplayName] = useState(user?.name ?? '');

  function handleLogout() {
    clearAuth();
    setAccessToken(null);
    disconnectSocket();
    window.location.href = '/auth/login';
  }

  async function handleUpdateName() {
    if (!displayName.trim() || !user) return;
    try {
      const { data } = await axiosClient.patch('/users/me', { name: displayName.trim() });
      useAuthStore.setState({ user: { ...user, name: data.name } });
      toast.success('Đã cập nhật tên');
    } catch {
      toast.error('Không thể cập nhật tên');
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="font-semibold">Cài đặt</h2>
        <Button variant="ghost" size="sm" onClick={onClose}>×</Button>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto p-4">
        {/* Profile */}
        <section className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <User size={14} /> Hồ sơ
          </h3>
          <div className="space-y-2">
            <div>
              <label className="text-sm font-medium">Tên hiển thị</label>
              <div className="mt-1 flex gap-2">
                <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="flex-1" />
                <Button size="sm" onClick={handleUpdateName}>Lưu</Button>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Email</label>
              <p className="mt-1 text-sm text-muted-foreground">{user?.email}</p>
            </div>
          </div>
        </section>

        {/* Appearance */}
        <section className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            {theme === 'dark' ? <Moon size={14} /> : <Sun size={14} />} Giao diện
          </h3>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Chế độ tối</p>
              <p className="text-xs text-muted-foreground">{theme === 'dark' ? 'Đang bật — giảm mỏi mắt' : 'Đang tắt'}</p>
            </div>
            <button
              onClick={toggleTheme}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${theme === 'dark' ? 'bg-primary' : 'bg-muted'}`}
            >
              <span
                className={`inline-block size-4 rounded-full bg-white transition-transform ${theme === 'dark' ? 'translate-x-6' : 'translate-x-1'}`}
              />
            </button>
          </div>
        </section>

        {/* Notifications */}
        <section className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <Bell size={14} /> Thông báo
          </h3>
          <p className="text-xs text-muted-foreground">Tuỳ chọn thông báo sẽ có ở bản sau.</p>
        </section>

        {/* Danger zone */}
        <section className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-destructive">
            <Trash2 size={14} /> Vùng nguy hiểm
          </h3>
          <Button variant="destructive" onClick={handleLogout} className="w-full gap-2">
            <LogOut size={14} /> Đăng xuất
          </Button>
        </section>
      </div>
    </div>
  );
}
