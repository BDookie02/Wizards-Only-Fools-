import type { MutableRefObject } from "react";

export type RenderClockEpochOffsetRef = MutableRefObject<number | null>;

export function getRenderClockEpochNowMs() {
  return Date.now();
}

export function getEpochMsFromRenderClock(
  elapsedSeconds: number,
  epochOffsetRef: RenderClockEpochOffsetRef,
  sampledEpochNow?: number,
) {
  const elapsedMs = elapsedSeconds * 1000;
  const epochNowMs = sampledEpochNow ?? getRenderClockEpochNowMs();
  if (!Number.isFinite(elapsedMs)) return epochNowMs;

  if (epochOffsetRef.current === null) {
    epochOffsetRef.current = epochNowMs - elapsedMs;
  }

  return epochOffsetRef.current + elapsedMs;
}
