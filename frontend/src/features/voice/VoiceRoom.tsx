import { useEffect, useRef, useState } from 'react';
import {
  LiveKitRoom,
  useTracks,
} from '@livekit/components-react';
import { GridLayout, ParticipantTile } from '@livekit/components-react';
import { Track } from 'livekit-client';
import '@livekit/components-styles';
import { voiceApi } from './api/voice';
import type { Channel } from '../channels/api/channels';
import { Button } from '@/components/ui/button';
import { VoiceControlBar } from './VoiceControlBar';

/**
 * VoiceRoom — Voice/Video/Screen Share qua LiveKit.
 *
 * F.5 (spec): UI dùng component có sẵn của `@livekit/components-react`
 *  - GridLayout + ParticipantTile cho danh sách người tham gia
 *  - TrackToggle (mic/cam/screen) + DisconnectButton cho control bar
 *  - Tự dựng SFF styling (màu nút: trung tính OFF-default, đỏ OFF-active, primary ON)
 *
 * F.4 (spec): screen share constraint 720p/30fps được áp ở VoiceControlBar qua
 * `captureOptionsBySource` của TrackToggle (xem VoiceControlBar.tsx).
 */
export function VoiceRoom({
  channel,
  onLeave,
}: {
  channel: Channel;
  onLeave: () => void;
}): React.ReactElement {
  const [token, setToken] = useState<string | null>(null);
  const [livekitUrl, setLivekitUrl] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // Chống double-fetch khi:
  //  - React.StrictMode chạy effect 2 lần trong dev
  //  - đổi channel liên tiếp (race với request cũ)
  const fetchedFor = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
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
        fetchedFor.current = null;
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
        <Button variant="outline" onClick={onLeave}>
          Quay lại
        </Button>
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
      // Tắt audio/video renderer mặc định của LiveKit — ParticipantTile tự lo.
      audio={false}
      video={false}
    >
      <RoomContent channel={channel} onLeave={onLeave} />
    </LiveKitRoom>
  );
}

/**
 * RoomContent — layout voice channel:
 *  - Header (tên channel + rời phòng)
 *  - GridLayout + ParticipantTile (camera & screen share)
 *  - VoiceControlBar (mic/cam/screen/leave) ở footer
 */
function RoomContent({
  channel,
  onLeave,
}: {
  channel: Channel;
  onLeave: () => void;
}): React.ReactElement {
  // Lấy TẤT CẢ tracks camera + screen share (của cả local lẫn remote).
  // Dùng {withPlaceholder: true} để hiển thị cả participant không bật camera
  // (đặc biệt quan trọng cho voice-only participants — vẫn thấy avatar + name).
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );

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
        <Button variant="ghost" size="sm" onClick={onLeave}>
          Ngắt kết nối
        </Button>
      </div>

      <div className="lk-theme-sff flex-1 overflow-hidden p-4">
        {tracks.length === 0 ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            Không có ai trong phòng
          </div>
        ) : (
          <GridLayout tracks={tracks}>
            <ParticipantTile />
          </GridLayout>
        )}
      </div>

      <div className="border-t border-border p-2">
        <VoiceControlBar />
      </div>
    </>
  );
}
