'use client';

import { CopyButton } from '@/components/CopyButton';
import { Icon } from '@/components/Icon';

type Props = { roomId: string; password: string; link: string };

export function inviteMessage({ roomId, password, link }: Props) {
  return ['Join me on Watch Together', `Link: ${link}`, `Room ID: ${roomId}`, `Password: ${password || '(none)'}`].join('\n');
}

function Row({ label, value, id, children }: { label: string; value: string; id?: string; children?: React.ReactNode }) {
  return (
    <div className="share-row">
      <span className="share-label">{label}</span>
      {children ?? (
        <code className="share-value" id={id}>
          {value}
        </code>
      )}
      <CopyButton text={value} className="icon-btn plain sm" title={`Copy ${label.toLowerCase()}`} copiedContent={<Icon name="check" size={16} />} id={id ? `copy-${id}` : undefined}>
        <Icon name="copy" size={16} />
      </CopyButton>
    </div>
  );
}

/** Room ID, password and invite link, each copyable, plus one "copy invite" for everything. */
export function ShareDetails(props: Props) {
  const { roomId, password, link } = props;
  return (
    <div className="share">
      <div className="share-list">
        <Row label="Room ID" value={roomId} id="shareRoomId" />
        <Row label="Password" value={password} id="sharePassword" />
        <Row label="Invite link" value={link} id="shareLink">
          <input className="share-value" value={link} readOnly id="inviteLink" onFocus={(e) => e.target.select()} aria-label="Invite link" />
        </Row>
      </div>
      <CopyButton text={inviteMessage(props)} className="btn btn-primary btn-block" id="copyAll" copiedContent={<><Icon name="check" size={16} /> Copied</>}>
        <Icon name="copy" size={16} /> Copy invite
      </CopyButton>
      <p className="share-hint">The link includes the password, so opening it is all it takes.</p>
    </div>
  );
}
