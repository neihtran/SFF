import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Plus, Settings, Users, Hash } from 'lucide-react';
import { ServerSidebar } from './ServerSidebar';
import { ChannelSidebar } from './ChannelSidebar';
import { MainContent } from '@/features/layout/MainContent';
import { ServerSettingsPanel } from '@/features/servers/components/ServerSettingsPanel';
import { CreateServerModal } from '@/features/servers/components/CreateServerModal';
import { JoinServerModal } from '@/features/servers/components/JoinServerModal';
import { MemberList } from '@/features/servers/components/MemberList';
import { CreateChannelDialog } from '@/features/channels/components/CreateChannelDialog';
import { SemanticSearchDialog } from '@/features/ai/components/SemanticSearchDialog';
import { CatchUpDialog } from '@/features/ai/components/CatchUpDialog';
import { AskAiDialog } from '@/features/ai/components/AskAiDialog';
import { VoiceRoom } from '@/features/voice/VoiceRoom';
import { useAuthStore } from '@/store/authStore';
import { serversApi } from '@/features/servers/api/servers';
import { channelsApi } from '@/features/channels/api/channels';
import type { Server } from '@/features/servers/api/servers';
import type { Channel } from '@/features/channels/api/channels';
import { Button } from '@/components/ui/button';

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
  const [showMembers, setShowMembers] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    if (!user) return;
    serversApi.listMine().then(setServers).catch(console.error);
  }, [user]);

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
    setShowMembers(false);
    setShowSettings(false);
  }

  function handleSelectChannel(ch: Channel) {
    setSelectedChannel(ch);
    setVoiceChannel(null);
    setShowMembers(false);
    setShowSettings(false);
  }

  function handleSelectVoice(ch: Channel) {
    setVoiceChannel(ch);
    setSelectedChannel(null);
    setShowMembers(false);
    setShowSettings(false);
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

  async function handleJumpToMessage(channelId: string, _messageId: string) {
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
            onOpenMembers={() => setShowMembers(true)}
            onOpenSettings={() => setShowSettings(true)}
            onCreateChannel={() => setShowCreateChannel(true)}
            isModerator={isModerator}
          />
        </motion.div>
      )}

      {/* Right: content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Voice room */}
        <AnimatePresence>
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
                title="Tóm tắt bằng AI"
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
                <Button onClick={() => setShowMembers(true)} variant="outline" size="sm">
                  <Users size={14} className="mr-1" /> Thành viên
                </Button>
                <Button onClick={() => setShowSettings(true)} variant="outline" size="sm">
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

        {/* Members panel */}
        <AnimatePresence>
          {showMembers && selectedServer && (
            <motion.div
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16 }}
              className="flex flex-1 flex-col overflow-hidden bg-card"
            >
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <h2 className="font-semibold">Thành viên</h2>
                <Button variant="ghost" size="sm" onClick={() => setShowMembers(false)}>×</Button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <MemberList server={selectedServer} currentUserId={user.id} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Settings panel */}
        <AnimatePresence>
          {showSettings && selectedServer && (
            <motion.div
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16 }}
              className="flex flex-1 flex-col overflow-hidden"
            >
              <ServerSettingsPanel
                server={selectedServer}
                onClose={() => setShowSettings(false)}
                onServerUpdate={handleServerUpdate}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Modals */}
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
