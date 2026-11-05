'use client';

import { useEffect, useRef } from 'react';

type Props = {
  stream: MediaStream | null;
  /** Change this to force re-attaching the same stream (e.g. after its tracks changed). */
  version?: number;
  muted?: boolean;
  volume?: number;
  /** Called when the browser blocks audible autoplay. */
  onBlocked?: () => void;
};

export function VideoView({ stream, version = 0, muted = false, volume = 1, onBlocked }: Props) {
  const ref = useRef<HTMLVideoElement>(null);
  const onBlockedRef = useRef(onBlocked);
  onBlockedRef.current = onBlocked;

  useEffect(() => {
    const v = ref.current!;
    v.srcObject = null;
    v.srcObject = stream;
    if (stream) {
      v.play().catch((err: DOMException) => {
        if (err.name === 'NotAllowedError') onBlockedRef.current?.();
      });
    }
  }, [stream, version]);

  // React doesn't keep the `muted` property in sync after mount, so set it directly.
  useEffect(() => {
    ref.current!.muted = muted;
  }, [muted]);

  useEffect(() => {
    ref.current!.volume = volume;
  }, [volume]);

  return <video ref={ref} autoPlay playsInline muted={muted} />;
}
