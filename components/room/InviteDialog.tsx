'use client';

import { useEffect, useRef } from 'react';
import { Icon } from '@/components/Icon';
import { ShareDetails } from './ShareDetails';

type Props = { open: boolean; link: string; roomId: string; password: string; onClose: () => void };

export function InviteDialog({ open, link, roomId, password, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current!;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="dialog"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose(); // click on backdrop
      }}
    >
      <div className="dialog-body">
      <div className="dialog-head">
        <h2>Invite to room</h2>
        <button className="icon-btn plain sm" onClick={onClose} title="Close" aria-label="Close" id="inviteClose">
          <Icon name="x" size={18} />
        </button>
      </div>
      <ShareDetails roomId={roomId} password={password} link={link} />
      </div>
    </dialog>
  );
}
