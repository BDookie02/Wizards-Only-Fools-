import type { LiveMapPosition } from "./mapOverlayRuntime";

export type MiniMapDisplayCoords = {
  x: number;
  z: number;
};

export type PublishedMiniMapPosition = {
  x: number;
  z: number;
} | null | undefined;

export function toFiniteMiniMapNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function areLiveMapPositionsEqual(a: LiveMapPosition, b: LiveMapPosition) {
  return a.x === b.x && a.z === b.z && a.angle === b.angle;
}

export function getRoundedMiniMapDisplayCoords(position: LiveMapPosition): MiniMapDisplayCoords {
  return {
    x: Math.round(position.x),
    z: Math.round(position.z),
  };
}

export function getMiniMapPlayerAngleCssValue(angle: number, fallback = 0) {
  return `${toFiniteMiniMapNumber(angle, fallback)}rad`;
}

export function syncMiniMapPositionWithPublishedState(
  target: LiveMapPosition,
  publishedPosition: PublishedMiniMapPosition,
  publishedYaw: number | undefined,
) {
  if (publishedPosition) {
    target.x = toFiniteMiniMapNumber(publishedPosition.x, target.x);
    target.z = toFiniteMiniMapNumber(publishedPosition.z, target.z);
  }

  if (publishedYaw !== undefined) {
    target.angle = toFiniteMiniMapNumber(publishedYaw, target.angle);
  }

  return target;
}

export function resolveMiniMapMoveDetail(
  detail: Record<string, unknown> | null | undefined,
  previous: LiveMapPosition,
): LiveMapPosition {
  return {
    x: toFiniteMiniMapNumber(detail?.x, previous.x),
    z: toFiniteMiniMapNumber(detail?.z, previous.z),
    angle: toFiniteMiniMapNumber(detail?.angle, previous.angle),
  };
}
