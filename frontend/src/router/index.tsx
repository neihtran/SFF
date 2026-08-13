// ============================================================
// SFF — Router (React Router v7)
// Cấu trúc route dự kiến: /auth/*, /app/:serverId/:channelId, ...
// Sẽ mở rộng ở Tuần 3 trở đi.
// ============================================================

import { createBrowserRouter, RouterProvider } from 'react-router-dom';

import { HomePage } from '@/pages/HomePage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <HomePage />,
  },
  // TODO (Tuần 3): /auth/login, /auth/register, /app/:serverId/:channelId
]);

export function AppRouter(): React.ReactElement {
  return <RouterProvider router={router} />;
}
