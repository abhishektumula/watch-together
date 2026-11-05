'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CopyButton } from '@/components/CopyButton';
import { Icon } from '@/components/Icon';
import type { CallState } from '@/lib/call-client';
import { ShareDetails } from './ShareDetails';
import { VideoView } from './VideoView';

type Props = {
  state: CallState;
  roomId: string;
  roomExists: boolean;
  /** True right after this person created the room: show the share details first. */
  created: boolean;
  link: string;
  name: string;
  password: string;
  onName: (v: string) => void;
  onPassword: (v: string) => void;
  onMic: () => void;
  onCam: () => void;
  onJoin: () => Promise<string | null>;
};

export function Lobby({ state, roomId, roomExists, created, link, name, password, onName, onPassword, onMic, onCam, onJoin }: Props) {
  const [error, setError] = useState(
    roomExists ? '' : 'This room no longer exists. It may have expired or the server restarted. Create a new one from the home page.',
  );
  const [joining, setJoining] = useState(false);
  const [insecure, setInsecure] = useState(false);
  useEffect(() => {
    setInsecure(!window.isSecureContext);
  }, []);

  return (
    <section className="lobby">
      <header>
        <Link href="/" className="brand">
          <span className="brand-mark">
            <Icon name="logo" size={18} />
          </span>
          Watch Together
        </Link>
      </header>

      <div className="lobby-body">
        <div className="preview">
          <div className={`tile self${state.camOn ? '' : ' cam-off'}`}>
            <VideoView stream={state.localCam} version={state.localVersion} muted />
            <div className="avatar">
              <span>{(name || '?').charAt(0).toUpperCase()}</span>
            </div>
            <div className="preview-controls">
              <button className={`icon-btn${state.micOn ? '' : ' off'}`} onClick={onMic} title={state.micOn ? 'Turn off microphone' : 'Turn on microphone'} id="preMic">
                <Icon name={state.micOn ? 'mic' : 'micOff'} />
              </button>
              <button className={`icon-btn${state.camOn ? '' : ' off'}`} onClick={onCam} title={state.camOn ? 'Turn off camera' : 'Turn on camera'} id="preCam">
                <Icon name={state.camOn ? 'video' : 'videoOff'} />
              </button>
            </div>
          </div>
          <p className="preview-note">{state.deviceMessage}</p>
        </div>

        <form
          className="panel"
          onSubmit={async (e) => {
            e.preventDefault();
            setError('');
            setJoining(true);
            const err = await onJoin();
            setJoining(false);
            if (err) setError(err);
          }}
        >
          {created ? (
            <>
              <div className="panel-head">
                <h1>Room created</h1>
                <p className="muted">Share these details, then join whenever you&apos;re ready.</p>
              </div>
              <ShareDetails roomId={roomId} password={password} link={link} />
              <hr className="divider" />
            </>
          ) : (
            <div className="panel-head">
              <h1>Ready to join?</h1>
              <div>
                <CopyButton text={roomId} className="chip" title="Copy room ID" copiedContent={<><Icon name="check" size={14} /> Copied</>} id="roomIdLabel">
                  {roomId} <Icon name="copy" size={14} />
                </CopyButton>
              </div>
            </div>
          )}

          <label className="field">
            Your name
            <input id="nameInput" value={name} onChange={(e) => onName(e.target.value)} maxLength={32} placeholder="Enter your name" autoComplete="nickname" />
          </label>
          {!created && (
            <label className="field">
              Room password
              <input id="passwordInput" value={password} onChange={(e) => onPassword(e.target.value)} placeholder="Password" autoComplete="off" />
            </label>
          )}
          <button className="btn btn-primary btn-lg btn-block" type="submit" id="joinBtn" disabled={joining || !roomExists}>
            {joining ? 'Joining…' : 'Join now'}
          </button>
          {error && (
            <p className="error" id="joinError">
              {error}
            </p>
          )}
          {insecure && <p className="warn">Camera and screen sharing only work over https:// or on localhost.</p>}
        </form>
      </div>
    </section>
  );
}
