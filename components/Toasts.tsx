'use client';

import { useToasts } from '@/lib/toast';

export function Toasts() {
  const toasts = useToasts();
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast${t.leaving ? ' out' : ''}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}
