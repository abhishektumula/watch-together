'use client';

import { useEffect, useRef, useState } from 'react';
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
        <b>Chat</b>
        <button className="icon" onClick={onClose} title="Close">
          ✕
        </button>
      </div>
      <ol className="chat-log" ref={logRef}>
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
        <input id="chatInput" ref={inputRef} value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} placeholder="Type a message…" autoComplete="off" />
        <button className="btn primary small" type="submit">
          Send
        </button>
      </form>
    </aside>
  );
}
