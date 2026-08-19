import { useCallback, useEffect, useRef, useState } from 'react';
import {
  LiveKitRoom,
  useLocalParticipant,
  useParticipants,
  DisconnectButton,
} from '@livekit/components-react';
import { Track, LocalParticipant, RemoteParticipant } from 'livekit-client';
import { Monitor } from 'lucide-react';
import '@livekit/components-styles';
import { voiceApi } from './api/voice';
import type { Channel } from '../channels/api/channels';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

export function VoiceRoom({ channel, onLeave }: { channel: Channel; onLeave: () => void }): React.ReactElement {
  const [token, setToken] = useState<string | null>(null);
  const [livekitUrl, setLivekitUrl] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // Chống double-fetch khi:
  //  - React.StrictMode chạy effect 2 lần trong dev
  //  - đổi channel liên tiếp (race với request cũ)
  //  - channel prop cùng id nhưng reference đổi
  const fetchedFor = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Nếu đã fetch cho đúng channel này rồi thì skip (StrictMode double-mount)
    if (fetchedFor.current === channel.id && token) {
      setConnecting(false);
      return;
    }
    fetchedFor.current = channel.id;
    setConnecting(true);
    setErr(null);
    voiceApi
      .getToken(channel.id)
      .then(({ token: t, livekitUrl: url }) => {
        if (cancelled) return;
        setToken(t);
        setLivekitUrl(url);
      })
      .catch((e) => {
        if (cancelled) return;
        fetchedFor.current = null; // cho phép retry khi fail
        setErr(e?.response?.data?.message ?? 'Không thể lấy voice token');
      })
      .finally(() => {
        if (!cancelled) setConnecting(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel.id]);

  if (connecting) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-background">
        <div className="size-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-muted-foreground">Đang kết nối voice channel…</p>
      </div>
    );
  }

  if (err || !token || !livekitUrl) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-background">
        <p className="text-destructive">{err ?? 'Không lấy được token'}</p>
        <Button variant="outline" onClick={onLeave}>Quay lại</Button>
      </div>
    );
  }

  return (
    <LiveKitRoom
      serverUrl={livekitUrl}
      token={token}
      connect
      connectOptions={{ autoSubscribe: true }}
      className="flex flex-1 flex-col"
    >
      <RoomContent channel={channel} onLeave={onLeave} />
    </LiveKitRoom>
  );
}

function RoomContent({ channel, onLeave }: { channel: Channel; onLeave: () => void }): React.ReactElement {
  const { localParticipant } = useLocalParticipant();
  // useParticipants() trả về TẤT CẢ participants (gồm cả local) — lọc bỏ local để tránh duplicate tile.
  const remoteParticipants = useParticipants();
  const all = [localParticipant, ...remoteParticipants.filter((p) => p.identity !== localParticipant.identity)];

  return (
    <>
      <div className="flex h-14 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-3">
          <div className="flex size-5 items-center justify-center rounded-full bg-green-500">
            <span className="text-[8px] font-bold text-white">VC</span>
          </div>
          <div>
            <h2 className="font-semibold">{channel.name}</h2>
            <p className="text-xs text-muted-foreground">Voice Channel</p>
          </div>
        </div>
        <DisconnectButton>
          <Button variant="ghost" size="sm" onClick={onLeave}>Ngắt kết nối</Button>
        </DisconnectButton>
      </div>

      <div className="flex-1 overflow-hidden p-4">
        {all.length === 0 ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            Không có ai trong phòng
          </div>
        ) : (
          <div className="grid h-full grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {all.map((p) => (
              <ParticipantTile
                key={p.identity}
                participant={p}
                isLocal={p.identity === localParticipant.identity}
              />
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-border p-2">
        <VoiceControlBar />
      </div>
    </>
  );
}

function ParticipantTile({
  participant,
  isLocal,
}: {
  participant: LocalParticipant | RemoteParticipant;
  isLocal: boolean;
}): React.ReactElement {
  const isSpeaking = participant.isSpeaking;

  const videoPubs = [...participant.trackPublications.values()].filter(
    (pub) => pub.track?.kind === Track.Kind.Video && !pub.track?.isMuted,
  );
  const screenPubs = [...participant.trackPublications.values()].filter(
    (pub) => pub.source === Track.Source.ScreenShare && !pub.track?.isMuted,
  );
  const activeTrack = screenPubs[0]?.track ?? videoPubs[0]?.track;
  const isMuted = !participant.isMicrophoneEnabled;

  return (
    <div
      className={`relative flex aspect-video flex-col items-center justify-center overflow-hidden rounded-xl border-2 transition-all ${
        isSpeaking ? 'border-green-500 shadow-[0_0_16px_rgba(34,197,94,0.35)]' : 'border-border'
      }`}
    >
      {isSpeaking && (
        <div className="pointer-events-none absolute inset-0 rounded-xl ring-2 ring-green-500 ring-offset-2 ring-offset-background" />
      )}

      {activeTrack ? (
        <VideoTile track={activeTrack} isLocal={isLocal} />
      ) : (
        <Avatar className="size-16">
          <AvatarFallback className="text-lg font-bold">
            {(participant.name ?? participant.identity).slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      )}

      <div className="absolute bottom-2 left-2 rounded-md bg-black/60 px-2 py-0.5 text-xs font-medium text-white backdrop-blur-sm">
        {participant.name ?? participant.identity}
        {isLocal && ' (bạn)'}
      </div>

      {isMuted && (
        <div className="absolute right-2 top-2 rounded-full bg-red-500 p-1">
          <span className="text-[8px] text-white">🎤</span>
        </div>
      )}
    </div>
  );
}

function VideoTile({ track, isLocal }: { track: Track; isLocal: boolean }): React.ReactElement {
  const ref = (el: HTMLVideoElement | null) => {
    if (el) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((track as any).attach as (el: HTMLVideoElement) => void)(el);
    }
  };
  return <video ref={ref} autoPlay playsInline muted={isLocal} className="size-full object-cover" />;
}

function VoiceControlBar(): React.ReactElement {
  const { localParticipant, isMicrophoneEnabled: micEnabled, isCameraEnabled, isScreenShareEnabled } = useLocalParticipant();

  const toggleMic = useCallback(() => {
    void localParticipant.setMicrophoneEnabled(!micEnabled);
  }, [localParticipant, micEnabled]);

  const toggleCam = useCallback(() => {
    void localParticipant.setCameraEnabled(!isCameraEnabled);
  }, [localParticipant, isCameraEnabled]);

  const toggleScreen = useCallback(async () => {
    if (isScreenShareEnabled) {
      await localParticipant.setScreenShareEnabled(false);
    } else {
      await localParticipant.setScreenShareEnabled(true);
    }
  }, [localParticipant, isScreenShareEnabled]);

  return (
    <div className="flex items-center justify-center gap-2">
      <button
        onClick={toggleMic}
        className={`flex size-10 items-center justify-center rounded-full transition-colors ${
          !micEnabled ? 'bg-red-500 text-white' : 'bg-muted hover:bg-muted/80'
        }`}
        title={!micEnabled ? 'Bật mic' : 'Tắt mic'}
      >
        <span>{!micEnabled ? '🎤' : '🎙️'}</span>
      </button>

      <button
        onClick={toggleCam}
        className={`flex size-10 items-center justify-center rounded-full transition-colors ${
          !isCameraEnabled ? 'bg-red-500 text-white' : 'bg-muted hover:bg-muted/80'
        }`}
        title={isCameraEnabled ? 'Tắt camera' : 'Bật camera'}
      >
        <span>{isCameraEnabled ? '📸' : '📷'}</span>
      </button>

      <button
        onClick={toggleScreen}
        className={`flex size-10 items-center justify-center rounded-full transition-colors ${
          isScreenShareEnabled ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'
        }`}
        title={isScreenShareEnabled ? 'Ngừng chia sẻ' : 'Chia sẻ màn hình'}
      >
        <Monitor size={18} />
      </button>

      <button
        className="flex size-10 items-center justify-center rounded-full bg-destructive text-white transition-colors hover:bg-destructive/80"
        title="Rời voice"
      >
        <span>📞</span>
      </button>
    </div>
  );
}
