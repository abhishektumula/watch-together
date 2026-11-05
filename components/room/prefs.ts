'use client';

import { useCallback, useEffect, useState } from 'react';

export const LAYOUTS = ['cinema', 'sidebar', 'bottom', 'faces'] as const;
export type Layout = (typeof LAYOUTS)[number];

/** Position/size of the floating element, in % of the stage. */
export type FloatPos = { left: number; top: number; width: number };
export type FloatPositions = Partial<Record<Layout, FloatPos>>;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

/** A piece of UI state persisted to localStorage (loaded after mount to avoid hydration mismatches). */
export function usePersistent<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  useEffect(() => {
    setValue(read(key, initial));
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const v = typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
        localStorage.setItem(key, JSON.stringify(v));
        return v;
      });
    },
    [key],
  );
  return [value, update] as const;
}
