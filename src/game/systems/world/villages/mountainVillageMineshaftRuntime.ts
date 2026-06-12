import {
  MOUNTAIN_VILLAGE_MINESHAFT_EXIT_BRIDGE_END_RADIUS,
  MOUNTAIN_VILLAGE_MINESHAFT_EXIT_BRIDGE_START_RADIUS,
  MOUNTAIN_VILLAGE_MINESHAFT_GOLDEN_ANGLE,
  MOUNTAIN_VILLAGE_MINESHAFT_HOLE_RADIUS,
  MOUNTAIN_VILLAGE_MINESHAFT_WALL_FIBONACCI_SEQUENCE,
  MOUNTAIN_VILLAGE_MINESHAFT_WALL_LANTERN_COUNT,
  MOUNTAIN_VILLAGE_MINESHAFT_WALL_PAINTING_COUNT,
} from "./mountainVillageTerrain";
import { lerpNumber, survivalHash01 } from "../survival/survivalMath";

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

export type MountainMineshaftBottomRock = {
  index: number;
  angle: number;
  x: number;
  z: number;
  rotation: [number, number, number];
  scale: [number, number, number];
  color: string;
};

export type MountainMineshaftWallLanternDescriptor = {
  index: number;
  position: [number, number, number];
  rotation: [number, number, number];
  withLight: boolean;
};

export type MountainMineshaftWallPaintingDescriptor = {
  index: number;
  position: [number, number, number];
  rotation: [number, number, number];
  variant: number;
};

export type MountainMineshaftWallRopeLightDescriptor = {
  key: string;
  tierIndex: number;
  lightIndex: number;
  position: [number, number, number];
  rotation: [number, number, number];
  bulbScale: number;
  glowColor: string;
  hasLight: boolean;
};

export type MountainMineshaftWallDecorDescriptors = {
  lanterns: MountainMineshaftWallLanternDescriptor[];
  paintings: MountainMineshaftWallPaintingDescriptor[];
  ropeLights: MountainMineshaftWallRopeLightDescriptor[];
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
const bottomRockCache = new Map<string, MountainMineshaftBottomRock[]>();
const wallDecorCache = new Map<string, MountainMineshaftWallDecorDescriptors>();

const MOUNTAIN_MINESHAFT_BOTTOM_ROCK_COLORS = ["#4b4237", "#2f2b27", "#66533c"];
const MOUNTAIN_MINESHAFT_ROPE_LIGHT_GLOW_COLORS = ["#fff0a8", "#ffd56f", "#ffb65b", "#ff8a3a"];

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

export function getMountainMineshaftBottomRocks({
  count,
  bottomRadius,
  minRadius = 12.5,
}: {
  count: number;
  bottomRadius: number;
  minRadius?: number;
}) {
  const safeCount = Math.max(0, Math.floor(count));
  const maxRadius = Math.max(minRadius, bottomRadius - 4);
  const cacheKey = `${safeCount}:${bottomRadius}:${minRadius}`;
  const cached = bottomRockCache.get(cacheKey);
  if (cached) return cached;

  const rocks = new Array<MountainMineshaftBottomRock>(safeCount);
  for (let index = 0; index < safeCount; index += 1) {
    const angle = survivalHash01(9110, index, 3) * Math.PI * 2;
    const radius = lerpNumber(minRadius, maxRadius, Math.pow(survivalHash01(9120, index, 7), 0.7));
    const rockScale = lerpNumber(0.7, 1.8, survivalHash01(9130, index, 11));

    rocks[index] = {
      index,
      angle,
      x: Math.sin(angle) * radius,
      z: Math.cos(angle) * radius,
      rotation: [0, angle, 0],
      scale: [rockScale * 1.4, rockScale * 0.38, rockScale],
      color: MOUNTAIN_MINESHAFT_BOTTOM_ROCK_COLORS[index % MOUNTAIN_MINESHAFT_BOTTOM_ROCK_COLORS.length],
    };
  }
  bottomRockCache.set(cacheKey, rocks);
  return rocks;
}

export function getMountainMineshaftWallDecorDescriptors({
  bottomY,
  summitY,
}: {
  bottomY: number;
  summitY: number;
}): MountainMineshaftWallDecorDescriptors {
  const cacheKey = `${bottomY}:${summitY}`;
  const cached = wallDecorCache.get(cacheKey);
  if (cached) return cached;

  const lanternTopY = summitY - 8.2;
  const lanternLowerY = bottomY + 14.5;
  const lanternUsableHeight = Math.max(36, lanternTopY - lanternLowerY);
  const lanternRadius = MOUNTAIN_VILLAGE_MINESHAFT_HOLE_RADIUS - 0.72;
  const lanterns = new Array<MountainMineshaftWallLanternDescriptor>(MOUNTAIN_VILLAGE_MINESHAFT_WALL_LANTERN_COUNT);

  for (let index = 0; index < MOUNTAIN_VILLAGE_MINESHAFT_WALL_LANTERN_COUNT; index += 1) {
    const t = index / Math.max(1, MOUNTAIN_VILLAGE_MINESHAFT_WALL_LANTERN_COUNT - 1);
    const y = lanternTopY - t * lanternUsableHeight;
    const angle = -0.7 + index * MOUNTAIN_VILLAGE_MINESHAFT_GOLDEN_ANGLE;
    lanterns[index] = {
      index,
      position: [Math.sin(angle) * lanternRadius, y, Math.cos(angle) * lanternRadius],
      rotation: [0, angle, 0],
      withLight: index % 4 === 0,
    };
  }

  const paintingRadius = MOUNTAIN_VILLAGE_MINESHAFT_HOLE_RADIUS - 0.48;
  const paintingUsableHeight = Math.max(48, summitY - bottomY - 34);
  const paintings = new Array<MountainMineshaftWallPaintingDescriptor>(MOUNTAIN_VILLAGE_MINESHAFT_WALL_PAINTING_COUNT);

  for (let index = 0; index < MOUNTAIN_VILLAGE_MINESHAFT_WALL_PAINTING_COUNT; index += 1) {
    const angle = 0.38 + index * ((Math.PI * 2) / MOUNTAIN_VILLAGE_MINESHAFT_WALL_PAINTING_COUNT);
    const y = bottomY + 15 + ((index % 4) / 3) * Math.min(paintingUsableHeight, 86) + Math.floor(index / 4) * 6;
    paintings[index] = {
      index,
      position: [Math.sin(angle) * paintingRadius, y, Math.cos(angle) * paintingRadius],
      rotation: [0, angle, 0],
      variant: index,
    };
  }

  const ropeRadius = MOUNTAIN_VILLAGE_MINESHAFT_HOLE_RADIUS - 0.52;
  const ropeTopY = summitY - 6.2;
  const ropeLowerY = bottomY + 8.4;
  const ropeSequenceHeight = Math.max(30, ropeTopY - ropeLowerY);
  const ropeLights: MountainMineshaftWallRopeLightDescriptor[] = [];

  MOUNTAIN_VILLAGE_MINESHAFT_WALL_FIBONACCI_SEQUENCE.forEach((lightCount, tierIndex) => {
    const t = tierIndex / Math.max(1, MOUNTAIN_VILLAGE_MINESHAFT_WALL_FIBONACCI_SEQUENCE.length - 1);
    const y = ropeTopY - t * ropeSequenceHeight;
    const rowAngle = -0.25 + tierIndex * MOUNTAIN_VILLAGE_MINESHAFT_GOLDEN_ANGLE;

    for (let lightIndex = 0; lightIndex < lightCount; lightIndex += 1) {
      const angle = rowAngle + (lightCount === 1 ? 0 : (Math.PI * 2 * lightIndex) / lightCount);
      ropeLights.push({
        key: `rope-fibonacci-light-${tierIndex}-${lightIndex}`,
        tierIndex,
        lightIndex,
        position: [Math.sin(angle) * ropeRadius, y, Math.cos(angle) * ropeRadius],
        rotation: [0, angle, 0],
        bulbScale: 1.06 + Math.min(0.38, tierIndex * 0.05),
        glowColor: MOUNTAIN_MINESHAFT_ROPE_LIGHT_GLOW_COLORS[lightIndex % MOUNTAIN_MINESHAFT_ROPE_LIGHT_GLOW_COLORS.length],
        hasLight: tierIndex < 2 && lightIndex === 0,
      });
    }
  });

  const descriptors = { lanterns, paintings, ropeLights };
  wallDecorCache.set(cacheKey, descriptors);
  return descriptors;
}
