'use client';

import { useRef, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import type { CallState } from '@/lib/call-client';
import type { FloatPositions, Layout } from './prefs';
import { VideoView } from './VideoView';

type Props = {
  state: CallState;
  name: string;
  layout: Layout;
  floatPos: FloatPositions;
  setFloatPos: (update: (prev: FloatPositions) => FloatPositions) => void;
  movieVolume: number;
  voiceVolume: number;
  onBlocked: () => void;
  onInvite: () => void;
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const initial = (name?: string | null) => (name || '?').trim().charAt(0).toUpperCase() || '?';

export function Stage({ state, name, layout, floatPos, setFloatPos, movieVolume, voiceVolume, onBlocked, onInvite }: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const { peer, remoteMeta: m, remoteStreams, localScreen } = state;
  const peerName = peer?.name || 'Them';

  const remoteSharing = !!(peer && m.screen);
  const hasScreen = remoteSharing || !!localScreen;
  // Their screen if they're sharing, otherwise a local preview of yours.
  const screenStream = remoteSharing ? (remoteStreams[m.screen!] ?? null) : localScreen;

  let camStream: MediaStream | null = null;
  if (peer) {
    camStream = m.camera
      ? (remoteStreams[m.camera] ?? null)
      : (Object.values(remoteStreams).find((s) => s.id !== m.screen) ?? null);
  }
  const remoteCamVisible = !!camStream && m.camOn && camStream.getVideoTracks().length > 0;

  // In Cinema the faces float over the movie; in Faces the movie floats over the faces.
  const floating: 'faces' | 'screen' | null = !hasScreen ? null : layout === 'cinema' ? 'faces' : layout === 'faces' ? 'screen' : null;
  const pos = floating ? floatPos[layout] : undefined;
  const floatStyle: CSSProperties | undefined = pos
    ? { left: `${pos.left}%`, top: `${pos.top}%`, width: `${pos.width}%`, right: 'auto', bottom: 'auto' }
    : undefined;

  const startDrag = (which: 'faces' | 'screen') => (e: ReactPointerEvent<HTMLDivElement>) => {
    if (floating !== which || e.button !== 0) return;
    e.preventDefault();
    const el = e.currentTarget;
    const resizing = (e.target as HTMLElement).classList.contains('resize-grip');
    const s = stageRef.current!.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const aspect = r.height / r.width;
    const left0 = r.left - s.left;
    const top0 = r.top - s.top;
    const { clientX: startX, clientY: startY, pointerId } = e;
    el.setPointerCapture(pointerId);
    el.classList.add('dragging');

    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      let next;
      if (resizing) {
        const maxW = Math.min(s.width - left0, (s.height - top0) / aspect);
        const w = clamp(r.width + dx, 140, maxW);
        next = { left: (left0 / s.width) * 100, top: (top0 / s.height) * 100, width: (w / s.width) * 100 };
      } else {
        const left = clamp(left0 + dx, 0, s.width - r.width);
        const top = clamp(top0 + dy, 0, s.height - r.height);
        next = { left: (left / s.width) * 100, top: (top / s.height) * 100, width: (r.width / s.width) * 100 };
      }
      setFloatPos((prev) => ({ ...prev, [layout]: next }));
    };
    const up = () => {
      el.classList.remove('dragging');
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  };

  // Double-click puts the floating element back in its default corner.
  const resetFloat = (which: 'faces' | 'screen') => () => {
    if (floating !== which) return;
    setFloatPos((prev) => {
      const next = { ...prev };
      delete next[layout];
      return next;
    });
  };

  const stageClass = ['stage', `layout-${layout}`, hasScreen ? 'has-screen' : 'no-screen'].join(' ');

  return (
    <div ref={stageRef} className={stageClass}>
      <div
        className="tile screen"
        style={floating === 'screen' ? floatStyle : undefined}
        onPointerDown={startDrag('screen')}
        onDoubleClick={resetFloat('screen')}
      >
        <VideoView stream={screenStream} muted={!remoteSharing} volume={movieVolume} onBlocked={onBlocked} />
        <div className="screen-label">{remoteSharing ? `${peerName} is sharing` : localScreen ? 'You are sharing' : ''}</div>
        {hasScreen && !screenStream && <div className="screen-empty">Connecting to the shared screen…</div>}
      </div>

      <div
        className="faces"
        style={floating === 'faces' ? floatStyle : undefined}
        onPointerDown={startDrag('faces')}
        onDoubleClick={resetFloat('faces')}
      >
        <div className={`tile face remote${remoteCamVisible ? '' : ' cam-off'}${peer ? '' : ' empty'}`}>
          <VideoView stream={camStream} volume={voiceVolume} onBlocked={onBlocked} />
          <div className="avatar">
            <span>{initial(peer?.name)}</span>
          </div>
          {!peer && (
            <div className="waiting">
              <div className="pulse" />
              <p>Waiting for the other person…</p>
              <button className="btn small" onClick={onInvite} onPointerDown={(e) => e.stopPropagation()}>
                Copy invite link
              </button>
            </div>
          )}
          <div className="name-tag">
            {peer && !m.micOn && <span>🔇</span>}
            <span>{peer ? peerName : 'Waiting…'}</span>
          </div>
        </div>

        <div className={`tile face self${state.camOn ? '' : ' cam-off'}`}>
          <VideoView stream={state.localCam} version={state.localVersion} muted />
          <div className="avatar">
            <span>{initial(name)}</span>
          </div>
          <div className="name-tag">
            {!state.micOn && <span>🔇</span>}
            <span>You</span>
          </div>
        </div>
        <div className="resize-grip" title="Drag to resize" />
      </div>

      <div className="reactions-layer">
        {state.reactions.map((r) => (
          <span key={r.id} className="reaction" style={{ left: `${r.left}%`, ['--drift' as string]: `${r.drift}px` }}>
            {r.emoji}
          </span>
        ))}
      </div>
    </div>
  );
}
