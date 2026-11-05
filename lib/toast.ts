import { useSyncExternalStore } from 'react';

export type Toast = { id: number; text: string; leaving: boolean };

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const EMPTY: Toast[] = [];

function emit(next: Toast[]) {
  toasts = next;
  for (const l of listeners) l();
}

export function toast(text: string, ms = 4000) {
  const id = nextId++;
  emit([...toasts, { id, text, leaving: false }]);
  setTimeout(() => emit(toasts.map((t) => (t.id === id ? { ...t, leaving: true } : t))), ms);
  setTimeout(() => emit(toasts.filter((t) => t.id !== id)), ms + 400);
}

export function useToasts() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => toasts,
    () => EMPTY,
  );
}
