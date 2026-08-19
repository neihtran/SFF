import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Plus, Settings, Users, Hash } from 'lucide-react';
import { ServerSidebar } from './ServerSidebar';
import { ChannelSidebar } from './ChannelSidebar';
import { MainContent } from '@/features/layout/MainContent';
import { ServerSettingsPanel } from '@/features/servers/components/ServerSettingsPanel';
import { MembersPanel } from '@/features/servers/components/MembersPanel';
import { CreateServerModal } from '@/features/servers/components/CreateServerModal';
import { JoinServerModal } from '@/features/servers/components/JoinServerModal';
import { CreateChannelDialog } from '@/features/channels/components/CreateChannelDialog';
import { SemanticSearchDialog } from '@/features/ai/components/SemanticSearchDialog';
import { CatchUpDialog } from '@/features/ai/components/CatchUpDialog';
import { AskAiDialog } from '@/features/ai/components/AskAiDialog';
import { VoiceRoom } from '@/features/voice/VoiceRoom';
import { SettingsDialog } from '@/features/layout/SettingsDialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuthStore } from '@/store/authStore';
import { serversApi } from '@/features/servers/api/servers';
import { channelsApi } from '@/features/channels/api/channels';
import type { Server } from '@/features/servers/api/servers';
import type { Channel } from '@/features/channels/api/channels';
import { Button } from '@/components/ui/button';

/**
 * Trạng thái overlay/modal của app — CHỈ 1 panel mở tại 1 thời điểm.
 * Mở cái này sẽ tự đóng cái kia (vì là 1 state duy nhất).
 * - 'members': Sheet trượt từ phải — danh sách thành viên server
 * - 'server-settings': Dialog — cài đặt riêng của server (mời, đổi tên)
 * - 'app-settings': Dialog — cài đặt app-level (theme, profile, logout)
 */
type Overlay = 'members' | 'server-settings' | 'app-settings' | null;

export function AppLayout(): React.ReactElement {
  const user = useAuthStore((s) => s.user);

  const [servers, setServers] = useState<Server[]>([]);
  const [selectedServer, setSelectedServer] = useState<Server | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [voiceChannel, setVoiceChannel] = useState<Channel | null>(null);

  // Modal states
  const [showCreateServer, setShowCreateServer] = useState(false);
  const [showJoinServer, setShowJoinServer] = useState(false);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [showSemanticSearch, setShowSemanticSearch] = useState(false);
  const [showCatchUp, setShowCatchUp] = useState(false);
  const [showAskAi, setShowAskAi] = useState(false);

  // Panel trượt / modal (CHỈ 1 tại 1 thời điểm)
  const [activeOverlay, setActiveOverlay] = useState<Overlay>(null);

  useEffect(() => {
    if (!user) return;
    serversApi.listMine().then(setServers).catch(console.error);
  }, [user]);

  // Đóng panel khi đổi server — tránh sticky
  useEffect(() => {
    setActiveOverlay(null);
  }, [selectedServer?.id]);

  if (!user) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <div className="size-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  async function handleSelectServer(srv: Server) {
    setSelectedServer(srv);
    setSelectedChannel(null);
    setVoiceChannel(null);
  }

  function handleSelectChannel(ch: Channel) {
    setSelectedChannel(ch);
    setVoiceChannel(null);
  }

  function handleSelectVoice(ch: Channel) {
    setVoiceChannel(ch);
    setSelectedChannel(null);
  }

  async function handleServerCreated(srv: Server) {
    setServers((prev) => [srv, ...prev]);
    handleSelectServer(srv);
  }

  async function handleServerJoined() {
    const updated = await serversApi.listMine();
    setServers(updated);
  }

  async function handleChannelCreated(ch: Channel) {
    if (!selectedServer) return;
    const updated = await serversApi.getOne(selectedServer.id);
    setSelectedServer(updated);
    handleSelectChannel(ch);
  }

  async function handleJumpToMessage(channelId: string) {
    if (!selectedServer) return;
    const channels = await channelsApi.list(selectedServer.id);
    const found = channels.find((c) => c.id === channelId);
    if (found) {
      handleSelectChannel(found);
    }
  }

  function handleServerUpdate(srv: Server) {
    setSelectedServer(srv);
    setServers((prev) => prev.map((s) => (s.id === srv.id ? srv : s)));
    void servers; // intentional
  }

  // Role helpers
  const currentMemberRole = selectedServer?.members.find((m) => m.role !== undefined)?.role;
  const isModerator = currentMemberRole === 'OWNER' || currentMemberRole === 'MODERATOR';

  // ── Render ──────────────────────────────────────────────────────
  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: server icons */}
      <ServerSidebar onSelectServer={handleSelectServer} selectedServerId={selectedServer?.id} />

      {/* Middle: channel list */}
      {selectedServer && (
        <motion.div
          key={selectedServer.id}
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.15 }}
          className="flex"
        >
          <ChannelSidebar
            serverId={selectedServer.id}
            selectedChannelId={selectedChannel?.id}
            onSelectChannel={handleSelectChannel}
            onSelectVoice={handleSelectVoice}
            onOpenMembers={() => setActiveOverlay('members')}
            onOpenSettings={() => setActiveOverlay('server-settings')}
            onCreateChannel={() => setShowCreateChannel(true)}
            isModerator={isModerator}
          />
        </motion.div>
      )}

      {/* Right: content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Voice room */}
        <AnimatePresence mode="wait">
          {voiceChannel && (
            <motion.div
              key={voiceChannel.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-1 flex-col"
            >
              <VoiceRoom
                channel={voiceChannel}
                onLeave={() => setVoiceChannel(null)}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Messages */}
        {!voiceChannel && selectedChannel && (
          <motion.div
            key={selectedChannel.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.1 }}
            className="flex flex-1 flex-col"
          >
            {/* Channel header */}
            <div className="flex h-12 items-center gap-2 border-b border-border px-4">
              <Hash size={18} className="text-muted-foreground" />
              <span className="flex-1 truncate font-semibold">{selectedChannel.name}</span>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground"
                onClick={() => setShowCatchUp(true)}
                title="Tóm tắt b�ng AI"
              >
                📋
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground"
                onClick={() => setShowAskAi(true)}
                title="Hỏi AI"
              >
                🤖
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground"
                onClick={() => setShowSemanticSearch(true)}
                title="Tìm kiếm ngữ nghĩa"
              >
                <Search size={16} />
              </Button>
            </div>
            <MainContent channel={selectedChannel} />
          </motion.div>
        )}

        {/* Server detail (no channel selected) */}
        {!voiceChannel && !selectedChannel && selectedServer && (
          <motion.div
            key={selectedServer.id + '-detail'}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-1 flex-col items-center justify-center bg-background px-4"
          >
            <div className="max-w-md text-center">
              <h2 className="mb-2 text-xl font-bold">{selectedServer.name}</h2>
              <p className="mb-6 text-sm text-muted-foreground">
                Chọn một channel để bắt đầu trò chuyện
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <Button onClick={() => setShowSemanticSearch(true)} variant="outline" size="sm">
                  <Search size={14} className="mr-1" /> Tìm kiếm
                </Button>
                {isModerator && (
                  <Button onClick={() => setShowCreateChannel(true)} variant="outline" size="sm">
                    <Plus size={14} className="mr-1" /> Tạo channel
                  </Button>
                )}
                <Button onClick={() => setActiveOverlay('members')} variant="outline" size="sm">
                  <Users size={14} className="mr-1" /> Thành viên
                </Button>
                <Button onClick={() => setActiveOverlay('server-settings')} variant="outline" size="sm">
                  <Settings size={14} className="mr-1" /> Cài đặt
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Welcome screen */}
        {!selectedServer && (
          <motion.div
            key="welcome"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-1 flex-col items-center justify-center bg-background"
          >
            <div className="text-center">
              <h1 className="mb-2 text-2xl font-bold">Chào {user.name}!</h1>
              <p className="text-muted-foreground">Chọn một server để bắt đầu</p>
              <div className="mt-4 flex justify-center gap-2">
                <Button onClick={() => setShowCreateServer(true)}>
                  <Plus size={14} className="mr-1" /> Tạo server
                </Button>
                <Button onClick={() => setShowJoinServer(true)} variant="outline">
                  Tham gia server
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* ============================================================
       * Panel/Modal overlays — CHỈ 1 tại 1 thời điểm
       * ============================================================ */}

      {/* Members — slide từ phải (Sheet) */}
      {selectedServer && (
        <MembersPanel
          open={activeOverlay === 'members'}
          onOpenChange={(o) => setActiveOverlay(o ? 'members' : null)}
          server={selectedServer}
          currentUserId={user.id}
        />
      )}

      {/* Settings — modal giữa (Dialog) — cài đặt riêng của server */}
      <Dialog
        open={activeOverlay === 'server-settings'}
        onOpenChange={(o) => setActiveOverlay(o ? 'server-settings' : null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Cài đặt Server</DialogTitle>
          </DialogHeader>
          {selectedServer ? (
            <ServerSettingsPanel
              server={selectedServer}
              onClose={() => {}}
              onServerUpdate={handleServerUpdate}
            />
          ) : (
            <p className="text-sm text-muted-foreground">Chọn một server trước.</p>
          )}
        </DialogContent>
      </Dialog>

      {/* App-level SettingsDialog (theme toggle, profile, logout) — c�ng 1-trong-1 */}
      <SettingsDialog
        open={activeOverlay === 'app-settings'}
        onOpenChange={(o) => setActiveOverlay(o ? 'app-settings' : null)}
      />

      {/* Modals (independent dialogs) */}
      <CreateServerModal
        open={showCreateServer}
        onClose={() => setShowCreateServer(false)}
        onCreated={handleServerCreated}
      />
      <JoinServerModal
        open={showJoinServer}
        onClose={() => setShowJoinServer(false)}
        onJoined={handleServerJoined}
      />
      <CreateChannelDialog
        open={showCreateChannel}
        serverId={selectedServer?.id ?? ''}
        onClose={() => setShowCreateChannel(false)}
        onCreated={handleChannelCreated}
      />
      {selectedServer && (
        <>
          <SemanticSearchDialog
            open={showSemanticSearch}
            onClose={() => setShowSemanticSearch(false)}
            serverId={selectedServer.id}
            onJumpToMessage={handleJumpToMessage}
          />
          <CatchUpDialog
            open={showCatchUp}
            onClose={() => setShowCatchUp(false)}
            channelId={selectedChannel?.id ?? ''}
            channelName={selectedChannel?.name ?? ''}
          />
          <AskAiDialog
            open={showAskAi}
            onClose={() => setShowAskAi(false)}
            channelId={selectedChannel?.id ?? ''}
          />
        </>
      )}
    </div>
  );
}