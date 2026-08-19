import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import { useEffect } from 'react';
import { toast } from 'sonner';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { RegisterPage } from '@/features/auth/pages/RegisterPage';
import { AppLayout } from '@/features/layout/AppLayout';
import { useAuthStore } from '@/store/authStore';
import { setAccessToken, setRefreshToken, setSessionExpiredHandler } from '@/lib/axiosClient';
import { disconnectSocket, getSocket } from '@/lib/socketClient';

// ============================================================
// Đăng ký handler session expired CHỈ 1 LẦN khi module load.
// Khi cả refresh token cũng hết hạn (hiếm, 7 ngày):
//   - Hiện toast
//   - Clear auth + tokens
//   - Disconnect socket (sẽ được reconnect ở AuthGuard sau khi login lại)
//   - Redirect về /auth/login qua window.location để bypass router cache
// ============================================================
let handlerRegistered = false;
function registerSessionExpiredHandler(): void {
  if (handlerRegistered) return;
  handlerRegistered = true;
  setSessionExpiredHandler(() => {
    // Tránh gọi nhiều lần khi nhiều request 401 fail cùng lúc
    if (!useAuthStore.getState().user) return;
    const state = useAuthStore.getState();
    state.clearAuth();
    setAccessToken(null);
    setRefreshToken(null);
    disconnectSocket();
    toast.error('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại');
    // Dùng replace để user không back lại được trang cũ
    window.location.replace('/auth/login');
  });
}

function AuthGuard({ children }: { children: React.ReactNode }): React.ReactElement {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const refreshToken = useAuthStore((s) => s.refreshToken);

  useEffect(() => {
    registerSessionExpiredHandler();
    if (user && accessToken) {
      setAccessToken(accessToken);
      setRefreshToken(refreshToken);
      const socket = getSocket();
      if (!socket.connected) {
        socket.connect();
      }
    }
  }, [user, accessToken, refreshToken]);

  if (!user || !accessToken) {
    return <Navigate to="/auth/login" replace />;
  }

  return <>{children}</>;
}

export const router = createBrowserRouter([
  {
    path: '/auth/login',
    element: <LoginPage />,
  },
  {
    path: '/auth/register',
    element: <RegisterPage />,
  },
  {
    path: '/',
    element: <Navigate to="/app" replace />,
  },
  {
    path: '/app',
    element: (
      <AuthGuard>
        <AppLayout />
      </AuthGuard>
    ),
  },
  {
    path: '/app/:serverId/:channelId',
    element: (
      <AuthGuard>
        <AppLayout />
      </AuthGuard>
    ),
  },
]);

export function AppRouter(): React.ReactElement {
  return <RouterProvider router={router} />;
}