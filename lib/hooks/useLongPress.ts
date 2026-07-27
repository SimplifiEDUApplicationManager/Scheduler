'use client';

import { useRef, useCallback } from 'react';

interface UseLongPressOptions {
  /** Duration in ms before the long-press fires (default: 500). */
  duration?: number;
  /** Called with progress 0→1 during the hold for animation. */
  onProgress?: (progress: number) => void;
  /** Called when the long-press completes. */
  onComplete: () => void;
  /** Called when the press is cancelled before completion. */
  onCancel?: () => void;
}

const FRAME_MS = 16; // ~60fps

export function useLongPress({
  duration = 500,
  onProgress,
  onComplete,
  onCancel,
}: UseLongPressOptions) {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef = useRef<number>(0);
  const firedRef = useRef(false);

  const stop = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (!firedRef.current) {
      onProgress?.(0);
      onCancel?.();
    }
    firedRef.current = false;
  }, [onProgress, onCancel]);

  const start = useCallback(() => {
    firedRef.current = false;
    startRef.current = Date.now();
    onProgress?.(0);

    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      onProgress?.(progress);

      if (progress >= 1) {
        firedRef.current = true;
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        onComplete();
      }
    }, FRAME_MS);
  }, [duration, onProgress, onComplete]);

  return {
    onMouseDown: start,
    onMouseUp: stop,
    onMouseLeave: stop,
    onTouchStart: start,
    onTouchEnd: stop,
  };
}
