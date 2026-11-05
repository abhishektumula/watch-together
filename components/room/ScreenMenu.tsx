'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon, type IconName } from '@/components/Icon';
import { LAYOUTS, type Layout } from './prefs';

const LAYOUT_INFO: Record<Layout, { label: string; icon: IconName; title: string }> = {
  cinema: { label: 'Cinema', icon: 'layoutCinema', title: 'Movie fills the screen, faces float on top' },
  sidebar: { label: 'Sidebar', icon: 'layoutSidebar', title: 'Movie left, faces on the right' },
  bottom: { label: 'Strip', icon: 'layoutStrip', title: 'Movie on top, faces underneath' },
  faces: { label: 'Faces', icon: 'layoutFaces', title: 'Faces big, movie small' },
};

type Props = {
  layout: Layout;
  onLayout: (l: Layout) => void;
  facesHidden: boolean;
  onToggleFaces: () => void;
  canResetPosition: boolean;
  onResetPosition: () => void;
  fullscreen: boolean;
  onFullscreen: () => void;
  remoteSharing: boolean;
  localSharing: boolean;
  movieVolume: number;
  onMovieVolume: (v: number) => void;
  voiceVolume: number;
  onVoiceVolume: (v: number) => void;
  peerName: string;
  onStopShare: () => void;
  onOpenChange: (open: boolean) => void;
};

/** Floating button on the shared screen that opens everything you can do with it. */
export function ScreenMenu(p: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    p.onOpenChange(open);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  const run = (fn: () => void) => () => {
    fn();
    setOpen(false);
  };

  return (
    <div ref={ref} className={`screen-menu${open ? ' open' : ''}`}>
      <button className="fab" id="screenMenuBtn" onClick={() => setOpen((o) => !o)} title="Screen options" aria-expanded={open} aria-haspopup="menu">
        <Icon name={open ? 'x' : 'sliders'} size={18} />
      </button>

      {open && (
        <div className="menu" role="menu" id="screenMenu">
          <div className="menu-label">Layout</div>
          <div className="seg">
            {LAYOUTS.map((l) => (
              <button
                key={l}
                data-layout={l}
                className={p.layout === l && !p.facesHidden ? 'active' : ''}
                title={LAYOUT_INFO[l].title}
                onClick={() => {
                  p.onLayout(l);
                  if (p.facesHidden) p.onToggleFaces();
                }}
              >
                <Icon name={LAYOUT_INFO[l].icon} size={20} strokeWidth={1.5} />
                {LAYOUT_INFO[l].label}
              </button>
            ))}
          </div>

          <div className="menu-sep" />
          <button className="menu-item" onClick={p.onToggleFaces} id="toggleFaces">
            <Icon name={p.facesHidden ? 'eye' : 'eyeOff'} size={18} />
            {p.facesHidden ? 'Show faces' : 'Hide faces'}
          </button>
          {p.canResetPosition && (
            <button className="menu-item" onClick={p.onResetPosition}>
              <Icon name="reset" size={18} />
              Reset position
            </button>
          )}
          <button className="menu-item" onClick={run(p.onFullscreen)}>
            <Icon name={p.fullscreen ? 'minimize' : 'maximize'} size={18} />
            {p.fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            <span className="kbd">F</span>
          </button>

          <div className="menu-sep" />
          {p.remoteSharing ? (
            <label className="menu-slider">
              <Icon name="volume" size={18} />
              Movie
              <input type="range" min={0} max={1} step={0.01} value={p.movieVolume} onChange={(e) => p.onMovieVolume(Number(e.target.value))} aria-label="Movie volume" />
            </label>
          ) : (
            <p className="menu-note">Movie sound plays from the tab you&apos;re sharing.</p>
          )}
          <label className="menu-slider">
            <Icon name="mic" size={18} />
            Voice
            <input type="range" min={0} max={1} step={0.01} value={p.voiceVolume} onChange={(e) => p.onVoiceVolume(Number(e.target.value))} aria-label={`${p.peerName}'s voice volume`} />
          </label>

          {p.localSharing && (
            <>
              <div className="menu-sep" />
              <button className="menu-item danger" onClick={run(p.onStopShare)}>
                <Icon name="shareStop" size={18} />
                Stop sharing
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
