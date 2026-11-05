'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { copyText } from '@/components/room/copy';

type Props = {
  text: string;
  children?: ReactNode;
  /** What to show for a moment after copying. */
  copiedContent?: ReactNode;
  className?: string;
  title?: string;
  id?: string;
};

/** A button that copies `text` and briefly confirms it. */
export function CopyButton({ text, children = 'Copy', copiedContent = 'Copied', className = 'btn btn-sm', title, id }: Props) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <button
      type="button"
      id={id}
      title={title}
      aria-label={title}
      className={`${className}${copied ? ' copied' : ''}`}
      onClick={async () => {
        await copyText(text, { silent: true });
        setCopied(true);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? copiedContent : children}
    </button>
  );
}
