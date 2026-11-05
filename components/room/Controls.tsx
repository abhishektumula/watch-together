'use client';

import { useEffect, useState } from 'react';
import { CopyButton } from '@/components/CopyButton';
import { Icon } from '@/components/Icon';

const REACTIONS = ['❤️', '😂', '😮', '😢', '😱', '🔥', '👏', '🍿'];

export type StatusKind = 'good' | 'bad' | 'pending' | '';

type Props = {
  roomId: string;
  status: string;
  statusKind: StatusKind;
  micOn: boolean;
  camOn: boolean;
  sharing: boolean;
  shareBlockedBy: string | null;
  fullscreen: boolean;
  chatOpen: boolean;
  unread: number;
  onMic: () => void;
  onCam: () => void;
  onShare: () => void;
  onReaction: (emoji: string) => void;
  onInvite: () => void;
  onChat: () => void;
  onFullscreen: () => void;
  onLeave: () => void;
  onPopoverChange: (open: boolean) => void;
};

export function Controls(p: Props) {
  const [reactOpen, setReactOpen] = useState(false);

  useEffect(() => {
    p.onPopoverChange(reactOpen);
  }, [reactOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!reactOpen) return;
    const close = (e: PointerEvent) => {
      if (!(e.target as HTMLElement).closest('.popover-wrap')) setReactOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setReactOpen(false);
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [reactOpen]);

  const shareTitle = p.shareBlockedBy ? `${p.shareBlockedBy} is sharing` : p.sharing ? 'Stop sharing (S)' : 'Share screen (S)';

  return (
    <footer className="bar">
      <div className="bar-left">
        <CopyButton text={p.roomId} className="chip" title="Copy room ID" id="roomCode" copiedContent={<><Icon name="check" size={14} /> Copied</>}>
          {p.roomId} <Icon name="copy" size={14} />
        </CopyButton>
        <span className="status" id="statusPill">
          <i className={`dot ${p.statusKind}`} />
          {p.status}
        </span>
      </div>

      <div className="bar-center">
        <button id="micBtn" className={`icon-btn${p.micOn ? '' : ' off'}`} onClick={p.onMic} title={p.micOn ? 'Mute (M)' : 'Unmute (M)'}>
          <Icon name={p.micOn ? 'mic' : 'micOff'} />
        </button>
        <button id="camBtn" className={`icon-btn${p.camOn ? '' : ' off'}`} onClick={p.onCam} title={p.camOn ? 'Turn off camera (V)' : 'Turn on camera (V)'}>
          <Icon name={p.camOn ? 'video' : 'videoOff'} />
        </button>
        <button id="shareBtn" className={`icon-btn${p.sharing ? ' active' : ''}`} onClick={p.onShare} disabled={!!p.shareBlockedBy} title={shareTitle}>
          <Icon name={p.sharing ? 'shareStop' : 'share'} />
        </button>
        <div className="popover-wrap">
          <button id="reactBtn" className={`icon-btn${reactOpen ? ' active' : ''}`} onClick={() => setReactOpen((o) => !o)} title="Send a reaction">
            <Icon name="smile" />
          </button>
          {reactOpen && (
            <div className="popover" role="menu">
              {REACTIONS.map((r) => (
                <button key={r} onClick={() => p.onReaction(r)} aria-label={`React ${r}`}>
                  {r}
                </button>
              ))}
            </div>
          )}
        </div>
        <button id="leaveBtn" className="icon-btn leave" onClick={p.onLeave} title="Leave call">
          <Icon name="phoneOff" />
        </button>
      </div>

      <div className="bar-right">
        <button id="inviteBtn" className="icon-btn plain" onClick={p.onInvite} title="Invite">
          <Icon name="userPlus" />
        </button>
        <button id="chatBtn" className={`icon-btn plain${p.chatOpen ? ' active' : ''}`} onClick={p.onChat} title="Chat (C)">
          <Icon name="chat" />
          {p.unread > 0 && <span className="badge">{p.unread}</span>}
        </button>
        <button id="fsBtn" className="icon-btn plain fs-btn" onClick={p.onFullscreen} title={p.fullscreen ? 'Exit fullscreen (F)' : 'Fullscreen (F)'}>
          <Icon name={p.fullscreen ? 'minimize' : 'maximize'} />
        </button>
      </div>
    </footer>
  );
}
