'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { ROOM_ID_PATTERN } from '@/lib/protocol';

export const NAME_KEY = 'wt:name';

export function HomeForms() {
  const router = useRouter();
  const [createError, setCreateError] = useState('');
  const [joinError, setJoinError] = useState('');
  const [creating, startCreate] = useTransition();
  const [customPassword, setCustomPassword] = useState(false);

  const goToRoom = (roomId: string, password: string, created: boolean) => {
    // Hand the password to the room page without putting it in the URL.
    sessionStorage.setItem(`wt:pw:${roomId}`, password);
    if (created) sessionStorage.setItem(`wt:created:${roomId}`, '1');
    router.push(`/room/${encodeURIComponent(roomId)}`);
  };

  const onCreate = (form: FormData) => {
    setCreateError('');
    startCreate(async () => {
      try {
        const res = await fetch('/api/rooms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: String(form.get('password') ?? '') }),
        });
        const body = (await res.json()) as { roomId: string; password: string } | { error: string };
        if ('error' in body) setCreateError(body.error);
        else goToRoom(body.roomId, body.password, true);
      } catch {
        setCreateError('Could not reach the server. Is it running?');
      }
    });
  };

  const onJoin = (form: FormData) => {
    let room = String(form.get('room') ?? '').trim();
    let password = String(form.get('password') ?? '').trim();
    // Accept a full invite link as well as a bare room ID.
    try {
      const url = new URL(room);
      const match = url.pathname.match(/\/room\/([^/]+)/);
      if (match) room = decodeURIComponent(match[1]);
      const pw = new URLSearchParams(url.hash.slice(1)).get('pw');
      if (pw && !password) password = pw;
    } catch {
      /* not a URL */
    }
    room = room.toLowerCase();
    if (!ROOM_ID_PATTERN.test(room)) {
      setJoinError('That does not look like a room ID (format: abc-defg-hij).');
      return;
    }
    goToRoom(room, password, false);
  };

  return (
    <div className="stack home-forms">
      <form className="stack" action={onCreate}>
        <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={creating} id="createBtn">
          {creating ? 'Creating room…' : 'Create a room'}
        </button>
        {customPassword ? (
          <input name="password" maxLength={64} placeholder="Custom password (optional)" autoComplete="off" autoFocus aria-label="Custom password" />
        ) : (
          <button type="button" className="link-btn" onClick={() => setCustomPassword(true)}>
            Use a custom password
          </button>
        )}
        {createError && <p className="error">{createError}</p>}
      </form>

      <div className="or">or join a room</div>

      <form className="stack" action={onJoin}>
        <input name="room" required placeholder="Room ID or invite link" autoComplete="off" id="joinRoom" aria-label="Room ID or invite link" />
        <input name="password" placeholder="Password (not needed with a link)" autoComplete="off" id="joinPassword" aria-label="Password" />
        <button className="btn btn-block" type="submit" id="joinRoomBtn">
          Join
        </button>
        {joinError && <p className="error">{joinError}</p>}
      </form>
    </div>
  );
}
