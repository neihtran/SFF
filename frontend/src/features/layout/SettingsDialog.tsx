import { useState } from 'react';
import { motion } from 'motion/react';
import { Moon, Sun, User, Bell, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useUiStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';
import { disconnectSocket } from '@/lib/socketClient';
import { setAccessToken, setRefreshToken } from '@/lib/axiosClient';
import { axiosClient } from '@/lib/axiosClient';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps): React.ReactElement {
  const { theme, toggleTheme } = useUiStore();
  const { user, clearAuth } = useAuthStore();
  const [displayName, setDisplayName] = useState(user?.name ?? '');

  function handleLogout() {
    clearAuth();
    setAccessToken(null);
    setRefreshToken(null);
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cài đặt</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Profile */}
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="space-y-3"
          >
            <h3 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <User size={14} /> Hồ sơ
            </h3>
            <div className="space-y-2">
              <div>
                <label className="text-sm font-medium">Tên hiển thị</label>
                <div className="mt-1 flex gap-2">
                  <Input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="flex-1"
                  />
                  <Button size="sm" onClick={handleUpdateName}>Lưu</Button>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Email</label>
                <p className="mt-1 text-sm text-muted-foreground">{user?.email}</p>
              </div>
            </div>
          </motion.section>

          {/* Appearance */}
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="space-y-3"
          >
            <h3 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              {theme === 'dark' ? <Moon size={14} /> : <Sun size={14} />} Giao diện
            </h3>
            <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
              <div>
                <p className="text-sm font-medium">Chế độ tối</p>
                <p className="text-xs text-muted-foreground">
                  {theme === 'dark' ? 'Đang bật — giảm mỏi mắt' : 'Đang tắt'}
                </p>
              </div>
              <button
                onClick={toggleTheme}
                aria-label="Toggle theme"
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  theme === 'dark' ? 'bg-primary' : 'bg-muted'
                }`}
              >
                <span
                  className={`inline-block size-4 rounded-full bg-white transition-transform ${
                    theme === 'dark' ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </motion.section>

          {/* Notifications */}
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="space-y-3"
          >
            <h3 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <Bell size={14} /> Thông báo
            </h3>
            <p className="text-xs text-muted-foreground">
              Tuỳ chọn thông báo sẽ có ở bản sau.
            </p>
          </motion.section>

          {/* Danger zone */}
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-3"
          >
            <Button variant="destructive" onClick={handleLogout} className="w-full gap-2">
              <LogOut size={14} /> Đăng xuất
            </Button>
          </motion.section>
        </div>
      </DialogContent>
    </Dialog>
  );
}