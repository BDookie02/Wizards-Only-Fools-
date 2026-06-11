import { useEffect, useState } from "react";

type LoopedFrameTimerOptions = {
  frameCount: number;
  intervalMs: number;
  firstFrame?: number;
  isRunning?: boolean;
};

export function useLoopedFrameTimer({
  frameCount,
  intervalMs,
  firstFrame = 0,
  isRunning = true,
}: LoopedFrameTimerOptions) {
  const [frame, setFrame] = useState(firstFrame);

  useEffect(() => {
    if (!isRunning || frameCount <= 0 || intervalMs <= 0) return;

    let cancelled = false;
    let frameTimeout: number | null = null;
    const lastFrame = firstFrame + frameCount - 1;
    const scheduleNextFrame = () => {
      frameTimeout = window.setTimeout(() => {
        if (cancelled) return;
        setFrame((current) => (current >= lastFrame ? firstFrame : current + 1));
        scheduleNextFrame();
      }, intervalMs);
    };

    scheduleNextFrame();
    return () => {
      cancelled = true;
      if (frameTimeout !== null) window.clearTimeout(frameTimeout);
    };
  }, [firstFrame, frameCount, intervalMs, isRunning]);

  return frame;
}
