import type { MutableRefObject } from "react";

export type RenderClockEpochOffsetRef = MutableRefObject<number | null>;

export function getEpochMsFromRenderClock(
  elapsedSeconds: number,
  epochOffsetRef: RenderClockEpochOffsetRef,
  sampledEpochNow?: number,
) {
  const elapsedMs = elapsedSeconds * 1000;
  if (!Number.isFinite(elapsedMs)) return sampledEpochNow ?? Date.now();

  if (epochOffsetRef.current === null) {
    epochOffsetRef.current = (sampledEpochNow ?? Date.now()) - elapsedMs;
  }

  return epochOffsetRef.current + elapsedMs;
}
