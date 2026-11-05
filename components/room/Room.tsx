'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { CallClient, INITIAL_STATE, type CallState, type Connection } from '@/lib/call-client';
import { toast } from '@/lib/toast';
import { CopyButton } from '@/components/CopyButton';
import { NAME_KEY } from '@/components/HomeForms';
import { ChatPanel } from './ChatPanel';
import { Controls } from './Controls';
import { copyText } from './copy';
import { InviteDialog } from './InviteDialog';
import { Lobby } from './Lobby';
import { LAYOUTS, usePersistent, type FloatPositions, type Layout } from './prefs';
import { Stage } from './Stage';

type Props = { roomId: string; roomExists: boolean; iceServers: RTCIceServer[] };

const noopSubscribe = () => () => {};
const getInitial = () => INITIAL_STATE;

function statusText(c: Connection, peerName?: string): [string, string] {
  switch (c) {
    case 'connected':
      return [`Connected with ${peerName}`, 'good'];
    case 'connecting':
      return ['Connecting…', ''];
    case 'trouble':
      return ['Connection trouble…', 'bad'];
    case 'reconnecting':
      return ['Reconnecting…', 'bad'];
    default:
      return ['Waiting for them', ''];
  }
}

export function Room({ roomId, roomExists, iceServers }: Props) {
  const [client, setClient] = useState<CallClient | null>(null);
  const state: CallState = useSyncExternalStore(client?.subscribe ?? noopSubscribe, client?.getSnapshot ?? getInitial, getInitial);

  // Media + socket live for as long as this page is open.
  useEffect(() => {
    const c = new CallClient(roomId, iceServers);
    setClient(c);
    void c.initMedia();
    return () => c.destroy();
  }, [roomId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Name and password: the invite link carries the password in the #fragment; keep it for refreshes, then hide it.
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [created, setCreated] = useState(false);
  const [origin, setOrigin] = useState('');
  useEffect(() => {
    setOrigin(location.origin);
    setCreated(sessionStorage.getItem(`wt:created:${roomId}`) === '1');
    const pwKey = `wt:pw:${roomId}`;
    const hashPw = new URLSearchParams(location.hash.slice(1)).get('pw');
    if (hashPw !== null) {
      sessionStorage.setItem(pwKey, hashPw);
      // Deferred so it runs after the Next.js router has synced its own history entry.
      setTimeout(() => history.replaceState(history.state, '', location.pathname + location.search), 0);
    }
    setPassword(sessionStorage.getItem(pwKey) ?? '');
    setName(localStorage.getItem(NAME_KEY) ?? '');
  }, [roomId]);

  // Per-person UI preferences.
  const [layout, setLayout] = usePersistent<Layout>('wt:layout', 'cinema');
  const [floatPos, setFloatPos] = usePersistent<FloatPositions>('wt:float', {});
  const [movieVolume, setMovieVolume] = usePersistent('wt:movieVol', 1);
  const [voiceVolume, setVoiceVolume] = usePersistent('wt:voiceVol', 1);

  const [chatOpen, setChatOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [soundBlocked, setSoundBlocked] = useState(false);

  useEffect(() => {
    client?.setChatOpen(chatOpen);
  }, [client, chatOpen]);

  const inviteLink = `${origin}/room/${encodeURIComponent(roomId)}#pw=${encodeURIComponent(password)}`;

  // ───────────── fullscreen + auto-hiding chrome ─────────────
  const callRef = useRef<HTMLElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [uiVisible, setUiVisible] = useState(true);
  const idleTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const popoverOpen = useRef(false);

  const poke = useCallback(() => {
    setUiVisible(true);
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      if (!popoverOpen.current) setUiVisible(false);
    }, 3000);
  }, []);

  useEffect(() => {
    const onChange = () => {
      setFullscreen(!!document.fullscreenElement);
      poke();
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, [poke]);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else callRef.current?.requestFullscreen?.().catch(() => toast('Fullscreen is not available.'));
  }, []);

  // ───────────── actions ─────────────
  const remoteSharing = !!(state.peer && state.remoteMeta.screen);
  const hasScreen = remoteSharing || !!state.localScreen;

  const toggleShare = useCallback(() => {
    if (!client) return;
    if (state.localScreen) client.stopShare();
    else if (!remoteSharing) void client.startShare();
  }, [client, state.localScreen, remoteSharing]);

  const leave = () => {
    client?.leave();
    if (document.fullscreenElement) void document.exitFullscreen();
  };

  // Keyboard shortcuts.
  const keyHandler = useRef<(e: KeyboardEvent) => void>(() => {});
  keyHandler.current = (e) => {
    if (state.phase !== 'call' || !client || e.metaKey || e.ctrlKey || e.altKey) return;
    if ((e.target as HTMLElement).closest('input, textarea, dialog')) return;
    const k = e.key.toLowerCase();
    if (k === 'm') void client.setMic(!state.micOn);
    else if (k === 'v') void client.setCam(!state.camOn);
    else if (k === 's') toggleShare();
    else if (k === 'f') toggleFullscreen();
    else if (k === 'c') setChatOpen((o) => !o);
    else if (k === 'l') setLayout(LAYOUTS[(LAYOUTS.indexOf(layout) + 1) % LAYOUTS.length]);
    else return;
    e.preventDefault();
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keyHandler.current(e);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // ───────────── render ─────────────
  if (state.phase === 'left') {
    return (
      <section className="left-screen">
        <div className="card">
          <h2>You left the room</h2>
          <p className="muted">See you next movie night 🍿</p>
          <div className="row">
            <button className="btn primary" id="rejoinBtn" onClick={() => location.reload()}>
              Rejoin
            </button>
            <Link className="btn" href="/">
              Home
            </Link>
          </div>
        </div>
      </section>
    );
  }

  if (state.phase === 'lobby') {
    return (
      <Lobby
        state={state}
        roomId={roomId}
        roomExists={roomExists}
        created={created}
        link={inviteLink}
        name={name}
        password={password}
        onName={setName}
        onPassword={setPassword}
        onMic={() => client?.setMic(!state.micOn)}
        onCam={() => client?.setCam(!state.camOn)}
        onJoin={async () => {
          if (!client) return 'Still starting up, try again in a second.';
          const n = name.trim() || 'Guest';
          const pw = password.trim();
          localStorage.setItem(NAME_KEY, n);
          setName(n);
          const err = await client.join(n, pw);
          if (!err) sessionStorage.setItem(`wt:pw:${roomId}`, pw);
          return err;
        }}
      />
    );
  }

  const [status, statusKind] = statusText(state.connection, state.peer?.name);
  const callClass = ['call', fullscreen && 'fullscreen', uiVisible && 'ui-visible'].filter(Boolean).join(' ');

  return (
    <section ref={callRef} className={callClass} onPointerMove={poke}>
      <header className="topbar">
        <div className="topbar-left">
          <span className="logo-sm">🍿</span>
          <CopyButton text={roomId} className="room-code" title="Copy room ID" id="roomCode">
            <code>{roomId}</code> 📋
          </CopyButton>
          <span className={`pill ${statusKind}`} id="statusPill">
            {status}
          </span>
        </div>
        <div className="topbar-right">
          <button className="btn ghost small" onClick={() => setInviteOpen(true)} id="inviteBtn">
            🔗 Invite
          </button>
          <button className="btn ghost small" onClick={() => setChatOpen((o) => !o)} id="chatBtn">
            💬 Chat {state.unread > 0 && <span className="badge">{state.unread}</span>}
          </button>
        </div>
      </header>

      <div className="main">
        <Stage
          state={state}
          name={name}
          layout={layout}
          floatPos={floatPos}
          setFloatPos={setFloatPos}
          movieVolume={movieVolume}
          voiceVolume={voiceVolume}
          onBlocked={() => setSoundBlocked(true)}
          onInvite={() => copyText(inviteLink)}
        />
        {soundBlocked && (
          <button
            className="btn primary unmute-overlay"
            onClick={() => {
              setSoundBlocked(false);
              document.querySelectorAll<HTMLVideoElement>('.stage video').forEach((v) => v.srcObject && v.play().catch(() => {}));
            }}
          >
            🔊 Click to turn on sound
          </button>
        )}
        {chatOpen && <ChatPanel messages={state.chat} onSend={(t) => client?.sendChat(t)} onClose={() => setChatOpen(false)} />}
      </div>

      <Controls
        micOn={state.micOn}
        camOn={state.camOn}
        sharing={!!state.localScreen}
        shareBlockedBy={remoteSharing ? (state.peer?.name ?? 'They') : null}
        hasScreen={hasScreen}
        layout={layout}
        movieVolume={movieVolume}
        voiceVolume={voiceVolume}
        peerName={state.peer?.name ?? null}
        onMic={() => client?.setMic(!state.micOn)}
        onCam={() => client?.setCam(!state.camOn)}
        onShare={toggleShare}
        onLayout={setLayout}
        onReaction={(e) => client?.sendReaction(e)}
        onMovieVolume={setMovieVolume}
        onVoiceVolume={setVoiceVolume}
        onFullscreen={toggleFullscreen}
        onLeave={leave}
        onPopoverChange={(open) => {
          popoverOpen.current = open;
        }}
      />

      <InviteDialog open={inviteOpen} link={inviteLink} roomId={roomId} password={password} onClose={() => setInviteOpen(false)} />
    </section>
  );
}
