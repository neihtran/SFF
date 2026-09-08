import { useEffect, useRef, useState } from 'react';
import {
  LiveKitRoom,
  useTracks,
  ControlBar,
  TrackToggle,
} from '@livekit/components-react';
import { GridLayout, ParticipantTile } from '@livekit/components-react';
import { Track } from 'livekit-client';
import '@livekit/components-styles';
import { voiceApi } from './api/voice';
import type { Channel } from '../channels/api/channels';
import { Button } from '@/components/ui/button';

/**
 * VoiceRoom — Voice/Video/Screen Share qua LiveKit.
 *
 * F.5 (spec): UI dùng component có sẵn của `@livekit/components-react`:
 *  - GridLayout + ParticipantTile cho danh sách người tham gia
 *  - ControlBar prefab cho mic/cam/screen-share/leave (đã gắn đúng vào
 *    LiveKit Room object qua hook `useLocalParticipant` nội bộ — KHÔNG cần
 *    viết lại bằng tay)
 *
 * F.4 (spec): screen share 720p/30fps áp qua prop `captureOptions` của
 * TrackToggle override trong ControlBar (xem `<CustomScreenShareToggle />`).
 *
 * Vì sao dùng built-in ControlBar thay vì custom:
 *  - Đã handle MediaDeviceMenu, permission check, error recovery, browser compat
 *  - TrackToggle / DisconnectButton đã gắn đúng vào Room.localParticipant
 *  - Tránh bugs khi tự re-implement (no mic, no permission, iOS Safari quirks)
 *  - Style SFF override qua CSS class `lk-control-bar-sff` trong globals.css
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
      audio={false}
      video={false}
    >
      <RoomContent channel={channel} onLeave={onLeave} />
    </LiveKitRoom>
  );
}

/**
 * RoomContent — layout voice channel:
 *  - Header (tên channel + rời phòng — nút trên header chỉ navigate back,
 *    KHÔNG phải room disconnect vì LiveKit sẽ auto cleanup khi unmount)
 *  - GridLayout + ParticipantTile (camera & screen share)
 *  - Built-in LiveKit ControlBar ở footer — đã handle đúng:
 *      + mic: room.localParticipant.setMicrophoneEnabled(bool)
 *      + cam: room.localParticipant.setCameraEnabled(bool)
 *      + screen share: room.localParticipant.setScreenShareEnabled(bool, options)
 *      + leave: room.disconnect()
 */
function RoomContent({
  channel,
  onLeave,
}: {
  channel: Channel;
  onLeave: () => void;
}): React.ReactElement {
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

      {/* ControlBar built-in — Component tự gắn vào Room context */}
      <div className="lk-theme-sff border-t border-border p-2">
        <ControlBar
          variation="verbose"
          controls={{
            microphone: true,
            camera: true,
            screenShare: true,
            chat: false, // SFF có chat riêng, không dùng LiveKit ChatToggle
            leave: true,
            settings: false, // SFF không cần settings panel của LiveKit
          }}
          onDeviceError={(err) => console.error('[voice] device error:', err)}
        >
          {/* F.4: Override TrackToggle cho screen share — áp constraint 720p/30fps.
              Các TrackToggle khác (mic, cam) dùng mặc định — đã đúng chuẩn LiveKit. */}
          <CustomScreenShareToggle />
        </ControlBar>
      </div>
    </>
  );
}

/**
 * Custom TrackToggle cho screen share — F.4 spec: 720p / 30fps.
 * LiveKit ControlBar nhận children để thay thế TrackToggle mặc định.
 * Đây là cách LiveKit khuyến nghị để áp capture options riêng cho screen share.
 */
function CustomScreenShareToggle(): React.ReactElement {
  return (
    <TrackToggle
      source={Track.Source.ScreenShare}
      captureOptions={{
        // F.4 spec: 1280x720 @ 30fps
        resolution: { width: 1280, height: 720, frameRate: 30 },
        audio: true,
        selfBrowserSurface: 'include',
      }}
    />
  );
}
