import { useCallback, useState } from 'react';
import { DisconnectButton, useLocalParticipant } from '@livekit/components-react';
import { cn } from '@/lib/utils';

/**
 * VoiceControlBar — control bar voice channel.
 *
 * Phân biệt màu nút theo state (H.2 spec):
 *  - OFF chưa từng tương tác: trung tính (muted)
 *  - OFF sau khi user đã tương tác: destructive (đỏ)
 *  - ON: primary (xanh)
 *  - Leave: luôn destructive (đỏ)
 *
 * Dùng button native với useLocalParticipant() thay vì <TrackToggle> để
 * kiểm soát hoàn toàn:
 *  - styling SFF (màu theo state)
 *  - capture options 720p/30fps cho screen share (F.4 spec)
 *
 * F.4 spec: getDisplayMedia constraint cứng 1280x720@30fps khi bật screen share.
 */
export function VoiceControlBar(): React.ReactElement {
  const {
    localParticipant,
    isMicrophoneEnabled: micEnabled,
    isCameraEnabled: camEnabled,
    isScreenShareEnabled: screenEnabled,
  } = useLocalParticipant();

  // Track lần đầu user toggle — trước đó dùng màu trung tính,
  // SAU KHI user chủ động bật/tắt thì mới dùng destructive cho "tắt".
  const [hasInteractedMic, setHasInteractedMic] = useState(false);
  const [hasInteractedCam, setHasInteractedCam] = useState(false);
  const [hasInteractedScreen, setHasInteractedScreen] = useState(false);

  const toggleMic = useCallback(() => {
    setHasInteractedMic(true);
    void localParticipant.setMicrophoneEnabled(!micEnabled);
  }, [localParticipant, micEnabled]);

  const toggleCam = useCallback(() => {
    setHasInteractedCam(true);
    void localParticipant.setCameraEnabled(!camEnabled);
  }, [localParticipant, camEnabled]);

  // F.4 spec: 720p/30fps constraint cho screen share
  // Dùng `as any` vì LiveKit type chỉ expose displaySurface,
  // nhưng implementation vẫn chấp nhận width/height/frameRate.
  const toggleScreen = useCallback(async () => {
    setHasInteractedScreen(true);
    if (screenEnabled) {
      await localParticipant.setScreenShareEnabled(false);
    } else {
      await localParticipant.setScreenShareEnabled(true, {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30, max: 30 },
        } as any,
      });
    }
  }, [localParticipant, screenEnabled]);

  // State -> màu
  type State = 'off-default' | 'off-active' | 'on';
  const micState: State = micEnabled
    ? 'on'
    : hasInteractedMic
      ? 'off-active'
      : 'off-default';
  const camState: State = camEnabled
    ? 'on'
    : hasInteractedCam
      ? 'off-active'
      : 'off-default';
  const screenState: State = screenEnabled
    ? 'on'
    : hasInteractedScreen
      ? 'off-active'
      : 'off-default';

  function btnClass(state: State): string {
    if (state === 'on') return 'bg-primary text-primary-foreground hover:bg-primary/90';
    if (state === 'off-active') return 'bg-destructive text-destructive-foreground hover:bg-destructive/90';
    return 'bg-muted text-muted-foreground hover:bg-muted/80';
  }

  return (
    <div className="flex items-center justify-center gap-2">
      <button
        onClick={toggleMic}
        className={cn(
          'flex size-10 items-center justify-center rounded-full transition-colors',
          btnClass(micState),
        )}
        title={micEnabled ? 'Tắt mic' : 'Bật mic'}
        aria-label={micEnabled ? 'Tắt mic' : 'Bật mic'}
        aria-pressed={micEnabled}
        type="button"
      >
        {micEnabled ? '🎙️' : '🎤'}
      </button>

      <button
        onClick={toggleCam}
        className={cn(
          'flex size-10 items-center justify-center rounded-full transition-colors',
          btnClass(camState),
        )}
        title={camEnabled ? 'Tắt camera' : 'Bật camera'}
        aria-label={camEnabled ? 'Tắt camera' : 'Bật camera'}
        aria-pressed={camEnabled}
        type="button"
      >
        {camEnabled ? '📸' : '📷'}
      </button>

      <button
        onClick={() => void toggleScreen()}
        className={cn(
          'flex size-10 items-center justify-center rounded-full transition-colors',
          btnClass(screenState),
        )}
        title={screenEnabled ? 'Ngừng chia sẻ màn hình' : 'Chia sẻ màn hình (720p)'}
        aria-label={screenEnabled ? 'Ngừng chia sẻ màn hình' : 'Chia sẻ màn hình (720p)'}
        aria-pressed={screenEnabled}
        type="button"
      >
        🖥️
      </button>

      {/* DisconnectButton từ @livekit/components-react — đã handle room.disconnect() */}
      <DisconnectButton className="flex size-10 items-center justify-center rounded-full bg-destructive text-destructive-foreground transition-colors hover:bg-destructive/90">
        📞
      </DisconnectButton>
    </div>
  );
}
