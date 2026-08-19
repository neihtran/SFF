import type { Channel } from '@/features/channels/api/channels';
import { MessageList } from '@/features/messages/components/MessageList';
import { useAuthStore } from '@/store/authStore';
import { getSocket } from '@/lib/socketClient';

export function MainContent({ channel }: { channel: Channel }): React.ReactElement {
  const user = useAuthStore((s) => s.user);
  const socket = getSocket();

  if (!user) return <div className="flex flex-1 items-center justify-center">Đang tải…</div>;

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-background">
      <MessageList channelId={channel.id} currentUserId={user.id} socket={socket} />
    </div>
  );
}
