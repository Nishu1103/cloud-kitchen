'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';

const THRESHOLD = 0.82;

/**
 * One-handed accept control.
 *
 * A tap-to-accept button is still present for keyboards and assistive tech. The slider
 * is the thumb path: drag past the threshold once, fire once, then lock until the
 * parent disables it. Losing the race is handled by the accept mutation, not here.
 */
export function SlideToAccept({
  onAccept,
  disabled,
  loading,
  label = 'Slide to Accept',
}: {
  onAccept: () => void;
  disabled?: boolean;
  loading?: boolean;
  label?: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const fired = useRef(false);
  const [progress, setProgress] = useState(0);
  const labelId = useId();

  useEffect(() => {
    if (!loading) {
      fired.current = false;
      setProgress(0);
    }
  }, [loading]);

  const reset = useCallback(() => {
    dragging.current = false;
    if (!fired.current) setProgress(0);
  }, []);

  const move = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track || disabled || loading || fired.current) return;
      const rect = track.getBoundingClientRect();
      const thumb = 56;
      const max = Math.max(1, rect.width - thumb - 8);
      const next = Math.min(1, Math.max(0, (clientX - rect.left - 4 - thumb / 2) / max));
      setProgress(next);
      if (next >= THRESHOLD && !fired.current) {
        fired.current = true;
        onAccept();
      }
    },
    [disabled, loading, onAccept],
  );

  return (
    <div className="space-y-2">
      <div
        ref={trackRef}
        className="relative h-14 touch-none overflow-hidden rounded-full bg-brand"
        onPointerDown={(event) => {
          if (disabled || loading) return;
          dragging.current = true;
          event.currentTarget.setPointerCapture(event.pointerId);
          move(event.clientX);
        }}
        onPointerMove={(event) => {
          if (!dragging.current) return;
          move(event.clientX);
        }}
        onPointerUp={reset}
        onPointerCancel={reset}
      >
        <p
          id={labelId}
          className="pointer-events-none absolute inset-0 flex items-center justify-center text-body font-semibold text-brand-ink"
          style={{ opacity: 1 - progress * 1.2 }}
        >
          {loading ? 'Accepting…' : label}
        </p>
        <span
          aria-hidden
          className="absolute top-1 flex h-12 w-12 items-center justify-center rounded-full bg-brand-ink text-brand shadow-md"
          style={{ left: `calc(4px + ${progress} * (100% - 56px))` }}
        >
          <span className="text-title font-semibold">›</span>
        </span>
      </div>
      <button
        type="button"
        className="sr-only"
        disabled={disabled || loading}
        onClick={onAccept}
        aria-describedby={labelId}
      >
        Accept this job
      </button>
    </div>
  );
}
