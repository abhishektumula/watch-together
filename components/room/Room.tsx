'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { CallClient, INITIAL_STATE, type CallState, type Connection } from '@/lib/call-client';
import { toast } from '@/lib/toast';
import { Icon } from '@/components/Icon';
import { NAME_KEY } from '@/components/HomeForms';
import { ChatPanel } from './ChatPanel';
import { Controls, type StatusKind } from './Controls';
import { InviteDialog } from './InviteDialog';
import { Lobby } from './Lobby';
import { LAYOUTS, usePersistent, type FloatPositions, type Layout } from './prefs';
import { ScreenMenu } from './ScreenMenu';
import { Stage } from './Stage';

type Props = { roomId: string; roomExists: boolean; iceServers: RTCIceServer[] };

const noopSubscribe = () => () => {};
const getInitial = () => INITIAL_STATE;

function statusText(c: Connection, peerName?: string): [string, StatusKind] {
  switch (c) {
    case 'connected':
      return [`Connected with ${peerName}`, 'good'];
    case 'connecting':
      return ['Connecting…', 'pending'];
    case 'trouble':
      return ['Connection unstable', 'bad'];
    case 'reconnecting':
      return ['Reconnecting…', 'bad'];
    default:
      return ['Waiting for the other person', ''];
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
  const [facesHidden, setFacesHidden] = usePersistent('wt:facesHidden', false);

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
  // Keep the chrome visible while any menu is open.
  const openMenus = useRef({ reactions: false, screen: false });
  const menuOpen = () => openMenus.current.reactions || openMenus.current.screen;

  const poke = useCallback(() => {
    setUiVisible(true);
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      if (!menuOpen()) setUiVisible(false);
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
    if (e.key === 'Escape') return;
    if ((e.target as HTMLElement).closest('input, textarea, dialog')) return;
    const k = e.key.toLowerCase();
    if (k === 'm') void client.setMic(!state.micOn);
    else if (k === 'v') void client.setCam(!state.camOn);
    else if (k === 's') toggleShare();
    else if (k === 'f') toggleFullscreen();
    else if (k === 'c') setChatOpen((o) => !o);
    else if (k === 'l') setLayout(LAYOUTS[(LAYOUTS.indexOf(layout) + 1) % LAYOUTS.length]);
    else if (k === 'h' && hasScreen) setFacesHidden((h) => !h);
    else return;
    e.preventDefault();
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keyHandler.current(e);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const resetFloat = () =>
    setFloatPos((prev) => {
      const next = { ...prev };
      delete next[layout];
      return next;
    });

  // ───────────── render ─────────────
  if (state.phase === 'left') {
    return (
      <section className="left-screen">
        <div className="stack">
          <h1>You left the call</h1>
          <p className="muted">The room stays open, so you can rejoin any time.</p>
          <div className="row">
            <button className="btn btn-primary" id="rejoinBtn" onClick={() => location.reload()}>
              Rejoin
            </button>
            <Link className="btn" href="/">
              Back to home
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
  const floatingLayout = layout === 'cinema' || layout === 'faces';

  return (
    <section ref={callRef} className={callClass} onPointerMove={poke}>
      <div className="main">
        <div className="stage-wrap">
          <Stage
            state={state}
            name={name}
            layout={layout}
            facesHidden={facesHidden}
            floatPos={floatPos}
            setFloatPos={setFloatPos}
            movieVolume={movieVolume}
            voiceVolume={voiceVolume}
            onBlocked={() => setSoundBlocked(true)}
            inviteLink={inviteLink}
          />
          {hasScreen && (
            <ScreenMenu
              layout={layout}
              onLayout={setLayout}
              facesHidden={facesHidden}
              onToggleFaces={() => setFacesHidden((h) => !h)}
              canResetPosition={floatingLayout && !facesHidden && !!floatPos[layout]}
              onResetPosition={resetFloat}
              fullscreen={fullscreen}
              onFullscreen={toggleFullscreen}
              remoteSharing={remoteSharing}
              localSharing={!!state.localScreen}
              movieVolume={movieVolume}
              onMovieVolume={setMovieVolume}
              voiceVolume={voiceVolume}
              onVoiceVolume={setVoiceVolume}
              peerName={state.peer?.name ?? 'Their'}
              onStopShare={() => client?.stopShare()}
              onOpenChange={(open) => {
                openMenus.current.screen = open;
                if (open) poke();
              }}
            />
          )}
          {soundBlocked && (
            <button
              className="btn btn-primary unmute-overlay"
              onClick={() => {
                setSoundBlocked(false);
                document.querySelectorAll<HTMLVideoElement>('.stage video').forEach((v) => v.srcObject && v.play().catch(() => {}));
              }}
            >
              <Icon name="volume" size={18} /> Turn on sound
            </button>
          )}
        </div>
        {chatOpen && <ChatPanel messages={state.chat} onSend={(t) => client?.sendChat(t)} onClose={() => setChatOpen(false)} />}
      </div>

      <Controls
        roomId={roomId}
        status={status}
        statusKind={statusKind}
        micOn={state.micOn}
        camOn={state.camOn}
        sharing={!!state.localScreen}
        shareBlockedBy={remoteSharing ? (state.peer?.name ?? 'They') : null}
        fullscreen={fullscreen}
        chatOpen={chatOpen}
        unread={state.unread}
        onMic={() => client?.setMic(!state.micOn)}
        onCam={() => client?.setCam(!state.camOn)}
        onShare={toggleShare}
        onReaction={(e) => client?.sendReaction(e)}
        onInvite={() => setInviteOpen(true)}
        onChat={() => setChatOpen((o) => !o)}
        onFullscreen={toggleFullscreen}
        onLeave={leave}
        onPopoverChange={(open) => {
          openMenus.current.reactions = open;
        }}
      />

      <InviteDialog open={inviteOpen} link={inviteLink} roomId={roomId} password={password} onClose={() => setInviteOpen(false)} />
    </section>
  );
}
