import {
  MOUNTAIN_VILLAGE_MINESHAFT_EXIT_BRIDGE_END_RADIUS,
  MOUNTAIN_VILLAGE_MINESHAFT_EXIT_BRIDGE_START_RADIUS,
} from "./mountainVillageTerrain";

type MountainMineshaftLandingHut = {
  localX: number;
  localZ: number;
  rotation: number;
};

type MountainMineshaftLandingLadder = {
  localX: number;
  localZ: number;
};

export type MountainMineshaftPlatformPiece = {
  key: string;
  centerX: number;
  width: number;
};

export type MountainMineshaftExitBridgeFrame = {
  angle: number;
  length: number;
  x: number;
  z: number;
};

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function getMountainMineshaftLadderLandingLocalX(
  hut: MountainMineshaftLandingHut,
  ladder?: MountainMineshaftLandingLadder,
) {
  if (!ladder) return null;

  const dx = ladder.localX - hut.localX;
  const dz = ladder.localZ - hut.localZ;
  const cos = Math.cos(hut.rotation);
  const sin = Math.sin(hut.rotation);

  return dx * cos - dz * sin;
}

export function getMountainMineshaftPlatformPieces(
  width: number,
  gapCenterX: number | null,
  gapWidth: number,
): MountainMineshaftPlatformPiece[] {
  if (gapCenterX === null) {
    return [{ key: "full", centerX: 0, width }];
  }

  const halfWidth = width / 2;
  const halfGap = gapWidth / 2;
  const gapMin = clampNumber(gapCenterX - halfGap, -halfWidth, halfWidth);
  const gapMax = clampNumber(gapCenterX + halfGap, -halfWidth, halfWidth);
  const pieces: MountainMineshaftPlatformPiece[] = [];

  if (gapMin > -halfWidth + 0.35) {
    const pieceWidth = gapMin + halfWidth;
    pieces.push({ key: "left", centerX: -halfWidth + pieceWidth / 2, width: pieceWidth });
  }

  if (gapMax < halfWidth - 0.35) {
    const pieceWidth = halfWidth - gapMax;
    pieces.push({ key: "right", centerX: gapMax + pieceWidth / 2, width: pieceWidth });
  }

  return pieces.length > 0 ? pieces : [{ key: "full", centerX: 0, width }];
}

export function getMountainMineshaftExitBridgeFrame(ladder: { angle: number }): MountainMineshaftExitBridgeFrame {
  const startRadius = MOUNTAIN_VILLAGE_MINESHAFT_EXIT_BRIDGE_START_RADIUS;
  const endRadius = MOUNTAIN_VILLAGE_MINESHAFT_EXIT_BRIDGE_END_RADIUS;
  const centerRadius = (startRadius + endRadius) / 2;
  const length = endRadius - startRadius;

  return {
    angle: ladder.angle,
    length,
    x: Math.sin(ladder.angle) * centerRadius,
    z: Math.cos(ladder.angle) * centerRadius,
  };
}
