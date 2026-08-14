import { useEffect, useRef, useState } from 'react';

/**
 * Animates a number from 0 to `target` on mount.
 *
 * Purely presentational — the value it settles on is always the real one that
 * was passed in. Honours prefers-reduced-motion by skipping straight to the
 * final value, and cancels cleanly on unmount.
 */
export function useCountUp(target: number, durationMs = 900): number {
  const [value, setValue] = useState(0);
  const frameRef = useRef<number>();

  useEffect(() => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced || !Number.isFinite(target) || target === 0) {
      setValue(target);
      return;
    }

    const start = performance.now();
    // easeOutCubic keeps the motion fast at the start and settled at the end.
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs);
      setValue(target * ease(progress));
      if (progress < 1) frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [target, durationMs]);

  return value;
}

export default useCountUp;
