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

export type MountainMineshaftCatwalkRingPoint = {
  index: number;
  angle: number;
  position: [number, number, number];
  rotation: [number, number, number];
};

export type MountainMineshaftCatwalkLightPole = MountainMineshaftCatwalkRingPoint;

export type MountainMineshaftRimBeam = {
  index: number;
  angle: number;
  x: number;
  z: number;
  rotation: [number, number, number];
};

export type MountainMineshaftCatwalkDescriptors = {
  centerGuardPostCount: number;
  centerGuardRailRadius: number;
  centerGuardRailSegmentLength: number;
  lightPoleRadius: number;
  planks: MountainMineshaftCatwalkRingPoint[];
  darkGaps: MountainMineshaftCatwalkRingPoint[];
  edgeBlocks: MountainMineshaftCatwalkRingPoint[];
  guardPosts: MountainMineshaftCatwalkRingPoint[];
  railSegments: MountainMineshaftCatwalkRingPoint[];
};

const catwalkDescriptorCache = new Map<string, MountainMineshaftCatwalkDescriptors>();
const catwalkLightPoleCache = new Map<string, MountainMineshaftCatwalkLightPole[]>();
const rimBeamCache = new Map<string, MountainMineshaftRimBeam[]>();

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getRingPoint(index: number, angle: number, radius: number, y: number): MountainMineshaftCatwalkRingPoint {
  return {
    index,
    angle,
    position: [Math.sin(angle) * radius, y, Math.cos(angle) * radius],
    rotation: [0, angle, 0],
  };
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

export function getMountainMineshaftCatwalkDescriptors({
  segments,
  innerRadius,
  outerRadius,
}: {
  segments: number;
  innerRadius: number;
  outerRadius: number;
}): MountainMineshaftCatwalkDescriptors {
  const safeSegments = Math.max(1, Math.floor(segments));
  const cacheKey = `${safeSegments}:${innerRadius}:${outerRadius}`;
  const cached = catwalkDescriptorCache.get(cacheKey);
  if (cached) return cached;

  const plankRadius = (innerRadius + outerRadius) / 2;
  const centerGuardRailRadius = innerRadius + 0.55;
  const centerGuardPostCount = safeSegments * 2;
  const centerGuardRailSegmentLength = ((Math.PI * 2 * centerGuardRailRadius) / centerGuardPostCount) * 0.78;
  const lightPoleRadius = outerRadius + 0.95;
  const planks = new Array<MountainMineshaftCatwalkRingPoint>(safeSegments);
  const darkGaps = new Array<MountainMineshaftCatwalkRingPoint>(safeSegments);
  const edgeBlocks = new Array<MountainMineshaftCatwalkRingPoint>(safeSegments);
  const guardPosts = new Array<MountainMineshaftCatwalkRingPoint>(centerGuardPostCount);
  const railSegments = new Array<MountainMineshaftCatwalkRingPoint>(centerGuardPostCount);

  for (let index = 0; index < safeSegments; index += 1) {
    const centeredAngle = ((index + 0.5) / safeSegments) * Math.PI * 2;
    const gapAngle = (index / safeSegments) * Math.PI * 2;
    planks[index] = getRingPoint(index, centeredAngle, plankRadius, 0.22);
    darkGaps[index] = getRingPoint(index, gapAngle, plankRadius, 0.33);
    edgeBlocks[index] = getRingPoint(index, centeredAngle, centerGuardRailRadius, 0.46);
  }

  for (let index = 0; index < centerGuardPostCount; index += 1) {
    const postAngle = (index / centerGuardPostCount) * Math.PI * 2;
    const railAngle = ((index + 0.5) / centerGuardPostCount) * Math.PI * 2;
    guardPosts[index] = getRingPoint(index, postAngle, centerGuardRailRadius, 1.18);
    railSegments[index] = getRingPoint(index, railAngle, centerGuardRailRadius, 0);
  }

  const descriptors = {
    centerGuardPostCount,
    centerGuardRailRadius,
    centerGuardRailSegmentLength,
    lightPoleRadius,
    planks,
    darkGaps,
    edgeBlocks,
    guardPosts,
    railSegments,
  };
  catwalkDescriptorCache.set(cacheKey, descriptors);
  return descriptors;
}

export function getMountainMineshaftCatwalkLightPoles(hutAngle: number, lightPoleRadius: number) {
  const cacheKey = `${hutAngle}:${lightPoleRadius}`;
  const cached = catwalkLightPoleCache.get(cacheKey);
  if (cached) return cached;

  const lightPoles = new Array<MountainMineshaftCatwalkLightPole>(4);
  for (let index = 0; index < 4; index += 1) {
    const angle = hutAngle + index * Math.PI / 2 + 0.38;
    lightPoles[index] = {
      ...getRingPoint(index, angle, lightPoleRadius, 0.78),
      rotation: [0, angle + Math.PI / 2, 0],
    };
  }
  catwalkLightPoleCache.set(cacheKey, lightPoles);
  return lightPoles;
}

export function getMountainMineshaftRimBeams({
  count,
  holeRadius,
  outerRadius,
}: {
  count: number;
  holeRadius: number;
  outerRadius: number;
}) {
  const safeCount = Math.max(1, Math.floor(count));
  const centerRadius = (holeRadius + outerRadius) / 2;
  const cacheKey = `${safeCount}:${holeRadius}:${outerRadius}`;
  const cached = rimBeamCache.get(cacheKey);
  if (cached) return cached;

  const beams = new Array<MountainMineshaftRimBeam>(safeCount);
  for (let index = 0; index < safeCount; index += 1) {
    const angle = (Math.PI * 2 * index) / safeCount;
    beams[index] = {
      index,
      angle,
      x: Math.sin(angle) * centerRadius,
      z: Math.cos(angle) * centerRadius,
      rotation: [0, angle + Math.PI / 2, 0],
    };
  }
  rimBeamCache.set(cacheKey, beams);
  return beams;
}
