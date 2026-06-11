export type GameCanvasResizeSnapshot = {
  devicePixelRatio: number;
  height: number;
  width: number;
};

export function getGameCanvasResizeSnapshot(width: number, height: number): GameCanvasResizeSnapshot {
  return {
    devicePixelRatio: typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
    height,
    width,
  };
}

export function didGameCanvasResizeChange(
  previous: GameCanvasResizeSnapshot | null,
  next: GameCanvasResizeSnapshot,
) {
  return (
    !previous ||
    previous.width !== next.width ||
    previous.height !== next.height ||
    previous.devicePixelRatio !== next.devicePixelRatio
  );
}
