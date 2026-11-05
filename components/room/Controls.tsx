'use client';

import { useEffect, useState } from 'react';
import { LAYOUTS, type Layout } from './prefs';

const LAYOUT_INFO: Record<Layout, { label: string; title: string }> = {
  cinema: { label: 'Cinema', title: 'Cinema: movie fills the screen, faces float on top' },
  sidebar: { label: 'Sidebar', title: 'Sidebar: movie left, faces right' },
  bottom: { label: 'Strip', title: 'Strip: movie on top, faces below' },
  faces: { label: 'Faces', title: 'Faces: you two big, movie small' },
};

const REACTIONS = ['❤️', '😂', '😮', '😢', '😱', '🔥', '👏', '🍿'];

type Props = {
  micOn: boolean;
  camOn: boolean;
  sharing: boolean;
  shareBlockedBy: string | null;
  hasScreen: boolean;
  layout: Layout;
  movieVolume: number;
  voiceVolume: number;
  peerName: string | null;
  onMic: () => void;
  onCam: () => void;
  onShare: () => void;
  onLayout: (l: Layout) => void;
  onReaction: (emoji: string) => void;
  onMovieVolume: (v: number) => void;
  onVoiceVolume: (v: number) => void;
  onFullscreen: () => void;
  onLeave: () => void;
  onPopoverChange: (open: boolean) => void;
};

export function Controls(p: Props) {
  const [popover, setPopover] = useState<'react' | 'volume' | null>(null);

  useEffect(() => {
    p.onPopoverChange(popover !== null);
  }, [popover]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!popover) return;
    const close = (e: PointerEvent) => {
      if (!(e.target as HTMLElement).closest('.popover-wrap')) setPopover(null);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [popover]);

  const toggle = (which: 'react' | 'volume') => setPopover((cur) => (cur === which ? null : which));

  return (
    <footer className="controls">
      <div className="controls-group">
        <button id="micBtn" className={`ctl${p.micOn ? '' : ' off'}`} onClick={p.onMic} title="Mute (M)">
          <span className="ico">🎙️</span>
          <span className="lbl">Mic</span>
        </button>
        <button id="camBtn" className={`ctl${p.camOn ? '' : ' off'}`} onClick={p.onCam} title="Camera (V)">
          <span className="ico">📷</span>
          <span className="lbl">Camera</span>
        </button>
        <button
          id="shareBtn"
          className={`ctl share${p.sharing ? ' active' : ''}`}
          onClick={p.onShare}
          disabled={!!p.shareBlockedBy}
          title={p.shareBlockedBy ? `${p.shareBlockedBy} is sharing` : 'Share screen (S)'}
        >
          <span className="ico">🖥️</span>
          <span className="lbl">{p.sharing ? 'Stop sharing' : 'Share movie'}</span>
        </button>
      </div>

      <div className={`controls-group layouts${p.hasScreen ? '' : ' dim'}`} title="Layout (L)">
        {LAYOUTS.map((l) => (
          <button key={l} data-layout={l} className={`ctl layout${p.layout === l ? ' active' : ''}`} onClick={() => p.onLayout(l)} title={LAYOUT_INFO[l].title}>
            <span className={`ico lay lay-${l}`}>
              <i />
              <b />
            </span>
            <span className="lbl">{LAYOUT_INFO[l].label}</span>
          </button>
        ))}
      </div>

      <div className="controls-group">
        <div className="popover-wrap">
          <button className="ctl" onClick={() => toggle('react')} title="Reactions">
            <span className="ico">❤️</span>
            <span className="lbl">React</span>
          </button>
          {popover === 'react' && (
            <div className="popover reactions">
              {REACTIONS.map((r) => (
                <button key={r} onClick={() => p.onReaction(r)}>
                  {r}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="popover-wrap">
          <button className="ctl" onClick={() => toggle('volume')} title="Volume">
            <span className="ico">🔊</span>
            <span className="lbl">Volume</span>
          </button>
          {popover === 'volume' && (
            <div className="popover volume">
              <label>
                Movie
                <input type="range" min={0} max={1} step={0.01} value={p.movieVolume} onChange={(e) => p.onMovieVolume(Number(e.target.value))} />
              </label>
              <label>
                {p.peerName ? `${p.peerName}'s voice` : 'Their voice'}
                <input type="range" min={0} max={1} step={0.01} value={p.voiceVolume} onChange={(e) => p.onVoiceVolume(Number(e.target.value))} />
              </label>
              <p className="muted small">Tip: wear headphones so the movie doesn&apos;t echo back through your mic.</p>
            </div>
          )}
        </div>
        <button id="fsBtn" className="ctl" onClick={p.onFullscreen} title="Fullscreen (F)">
          <span className="ico">⛶</span>
          <span className="lbl">Fullscreen</span>
        </button>
        <button id="leaveBtn" className="ctl danger" onClick={p.onLeave} title="Leave">
          <span className="ico">📞</span>
          <span className="lbl">Leave</span>
        </button>
      </div>
    </footer>
  );
}
