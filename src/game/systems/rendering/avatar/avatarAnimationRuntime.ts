export type AvatarFrameTickInput = {
  nowMs: number;
  lastFrameAtMs: number | null;
  frame: number;
  frameDelayMs: number;
  frameCount?: number;
};

export type AvatarFrameTickResult = {
  frame: number;
  lastFrameAtMs: number | null;
  advanced: boolean;
};

export function getNextAvatarFrameTick({
  nowMs,
  lastFrameAtMs,
  frame,
  frameDelayMs,
  frameCount = 4,
}: AvatarFrameTickInput): AvatarFrameTickResult {
  const safeFrameCount = Math.max(1, Math.floor(frameCount));
  const currentFrame = ((Math.floor(frame) % safeFrameCount) + safeFrameCount) % safeFrameCount;

  if (!Number.isFinite(nowMs)) {
    return { frame: currentFrame, lastFrameAtMs, advanced: false };
  }

  if (!Number.isFinite(frameDelayMs) || frameDelayMs <= 0) {
    const nextFrame = (currentFrame + 1) % safeFrameCount;
    return { frame: nextFrame, lastFrameAtMs: nowMs, advanced: true };
  }

  if (lastFrameAtMs === null || !Number.isFinite(lastFrameAtMs)) {
    return { frame: currentFrame, lastFrameAtMs: nowMs, advanced: false };
  }

  const elapsedMs = nowMs - lastFrameAtMs;
  if (elapsedMs < frameDelayMs) {
    return { frame: currentFrame, lastFrameAtMs, advanced: false };
  }

  const stepCount = Math.max(1, Math.floor(elapsedMs / frameDelayMs));
  return {
    frame: (currentFrame + stepCount) % safeFrameCount,
    lastFrameAtMs: lastFrameAtMs + stepCount * frameDelayMs,
    advanced: true,
  };
}
