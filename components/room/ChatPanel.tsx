'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/Icon';
import type { ChatEntry } from '@/lib/call-client';

type Props = { messages: ChatEntry[]; onSend: (text: string) => void; onClose: () => void };

export function ChatPanel({ messages, onSend, onClose }: Props) {
  const [text, setText] = useState('');
  const logRef = useRef<HTMLOListElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  useEffect(() => {
    logRef.current?.lastElementChild?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  return (
    <aside className="chat">
      <div className="chat-head">
        <span>Chat</span>
        <button className="icon-btn plain sm" onClick={onClose} title="Close chat" aria-label="Close chat">
          <Icon name="x" size={18} />
        </button>
      </div>
      <ol className="chat-log" ref={logRef}>
        {messages.length === 0 && <li className="chat-empty">Messages stay in this call and disappear when it ends.</li>}
        {messages.map((m) => (
          <li key={m.id} className={m.mine ? 'mine' : ''}>
            <b>{m.mine ? 'You' : m.name}</b>
            <span>{m.text}</span>
          </li>
        ))}
      </ol>
      <form
        className="chat-form"
        onSubmit={(e) => {
          e.preventDefault();
          onSend(text);
          setText('');
        }}
      >
        <input id="chatInput" ref={inputRef} value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} placeholder="Send a message" autoComplete="off" />
        <button className="icon-btn plain sm" type="submit" title="Send" aria-label="Send" disabled={!text.trim()}>
          <Icon name="send" size={18} />
        </button>
      </form>
    </aside>
  );
}
