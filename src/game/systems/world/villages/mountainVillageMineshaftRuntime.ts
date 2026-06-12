import {
  MOUNTAIN_VILLAGE_MINESHAFT_BOTTOM_BASE_OFFSET,
  MOUNTAIN_VILLAGE_MINESHAFT_EXIT_BRIDGE_Y_OFFSET,
  MOUNTAIN_VILLAGE_MINESHAFT_HOLE_RADIUS,
  MOUNTAIN_VILLAGE_MINESHAFT_HUT_RADIUS,
  MOUNTAIN_VILLAGE_MINESHAFT_LADDER_EXIT_CLEARANCE,
  MOUNTAIN_VILLAGE_MINESHAFT_LADDER_RING_RADIUS,
  MOUNTAIN_VILLAGE_MINESHAFT_LADDER_START_CLEARANCE,
  MOUNTAIN_VILLAGE_MINESHAFT_LADDER_WIDTH,
  MOUNTAIN_VILLAGE_MINESHAFT_RIM_OUTER_RADIUS,
} from "./mountainVillageTerrain";
import { lerpNumber, survivalHash01 } from "../survival/survivalMath";
import type { SurvivalChunkInfo } from "../survival/survivalWorldConfig";

type MountainMineshaftLandingHut = {
  localX: number;
  localZ: number;
  rotation: number;
};

type MountainMineshaftLandingLadder = {
  localX: number;
  localZ: number;
};

export type MountainMineshaftHut = {
  key: string;
  angle: number;
  localX: number;
  localZ: number;
  y: number;
  rotation: number;
  width: number;
  depth: number;
  height: number;
  platformWidth: number;
  platformDepth: number;
  bodyColor: string;
  roofColor: string;
  accentColor: string;
};

export type MountainMineshaftLadder = {
  key: string;
  angle: number;
  localX: number;
  localZ: number;
  startY: number;
  endY: number;
  rotation: number;
  width: number;
};

export type MountainMineshaftSummitSnowDrift = {
  index: number;
  positionXZ: [number, number];
  yOffset: number;
  rotation: [number, number, number];
  scale: [number, number, number];
  color: string;
};

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

export type MountainMineshaftSupportPostDescriptor = {
  side: -1 | 1;
  positionOffset: [number, number, number];
  rotation: [number, number, number];
};

export type MountainMineshaftSupportSnowCapDescriptor = {
  side: -1 | 1;
  position: [number, number, number];
};

export type MountainMineshaftSupportFrame = {
  index: number;
  angle: number;
  rotation: [number, number, number];
  posts: MountainMineshaftSupportPostDescriptor[];
  topBeamPositionOffset: [number, number, number];
  snowCaps: MountainMineshaftSupportSnowCapDescriptor[];
};

const summitSnowDriftCache = new Map<string, MountainMineshaftSummitSnowDrift[]>();
const rimBeamCache = new Map<string, MountainMineshaftRimBeam[]>();
const supportFrameCache = new Map<string, MountainMineshaftSupportFrame[]>();
const bottomRockCache = new Map<string, MountainMineshaftBottomRock[]>();

const MOUNTAIN_MINESHAFT_SUPPORT_SIDES = [-1, 1] as const;
const MOUNTAIN_MINESHAFT_HUT_LEVEL_FRACTIONS_NEAR = [0.18, 0.48, 0.8] as const;
const MOUNTAIN_MINESHAFT_HUT_LEVEL_FRACTIONS_MID = [0.24, 0.68] as const;
const MOUNTAIN_MINESHAFT_HUT_BODY_COLORS = ["#514331", "#5d4b35", "#423b32", "#664f35"] as const;
const MOUNTAIN_MINESHAFT_HUT_ROOF_COLORS = ["#6f5131", "#805d39", "#5c4028", "#8a6a42"] as const;
const MOUNTAIN_MINESHAFT_HUT_ACCENT_COLORS = ["#86d9ff", "#f1cf82", "#c7eaff", "#d7b46c"] as const;
const MOUNTAIN_MINESHAFT_BOTTOM_ROCK_COLORS = ["#4b4237", "#2f2b27", "#66533c"];

export function makeMountainMineshaftHuts(chunk: SurvivalChunkInfo, baseHeight: number, summitY: number): MountainMineshaftHut[] {
  const bottomY = baseHeight + MOUNTAIN_VILLAGE_MINESHAFT_BOTTOM_BASE_OFFSET;
  const availableHeight = Math.max(96, summitY - bottomY - 30);
  const levelFractions = chunk.lod === "near"
    ? MOUNTAIN_MINESHAFT_HUT_LEVEL_FRACTIONS_NEAR
    : MOUNTAIN_MINESHAFT_HUT_LEVEL_FRACTIONS_MID;
  const angleBase = 0.72 + survivalHash01(chunk.cx, chunk.cz, 5200) * 0.38;
  const huts = new Array<MountainMineshaftHut>(levelFractions.length);

  for (let index = 0; index < levelFractions.length; index += 1) {
    const fraction = levelFractions[index];
    const angle = angleBase + index * 1.19 + (survivalHash01(chunk.cx, chunk.cz, 5220 + index) - 0.5) * 0.16;
    const width = 9.8 + survivalHash01(chunk.cx, chunk.cz, 5250 + index) * 2.8;
    const depth = 8.2 + survivalHash01(chunk.cx, chunk.cz, 5280 + index) * 2.4;
    const height = 6.6 + survivalHash01(chunk.cx, chunk.cz, 5310 + index) * 1.8;

    huts[index] = {
      key: `${chunk.key}-mineshaft-hut-${index}`,
      angle,
      localX: Math.sin(angle) * MOUNTAIN_VILLAGE_MINESHAFT_HUT_RADIUS,
      localZ: Math.cos(angle) * MOUNTAIN_VILLAGE_MINESHAFT_HUT_RADIUS,
      y: bottomY + 12 + availableHeight * fraction,
      rotation: angle + Math.PI,
      width,
      depth,
      height,
      platformWidth: width + 5.8,
      platformDepth: depth * 0.72 + 7.8,
      bodyColor: MOUNTAIN_MINESHAFT_HUT_BODY_COLORS[index % MOUNTAIN_MINESHAFT_HUT_BODY_COLORS.length],
      roofColor: MOUNTAIN_MINESHAFT_HUT_ROOF_COLORS[index % MOUNTAIN_MINESHAFT_HUT_ROOF_COLORS.length],
      accentColor: MOUNTAIN_MINESHAFT_HUT_ACCENT_COLORS[index % MOUNTAIN_MINESHAFT_HUT_ACCENT_COLORS.length],
    };
  }

  return huts;
}

export function makeMountainMineshaftLadders(
  chunk: SurvivalChunkInfo,
  baseHeight: number,
  huts: MountainMineshaftHut[],
  summitY: number,
): MountainMineshaftLadder[] {
  const bottomY = baseHeight + MOUNTAIN_VILLAGE_MINESHAFT_BOTTOM_BASE_OFFSET + MOUNTAIN_VILLAGE_MINESHAFT_LADDER_START_CLEARANCE;
  const ladders: MountainMineshaftLadder[] = [];

  for (let index = 0; index < huts.length; index += 1) {
    const hut = huts[index];
    const ladderAngle = hut.angle + (index % 2 === 0 ? -0.46 : 0.46) + index * 0.08;
    const startY = index === 0 ? bottomY : huts[index - 1].y + MOUNTAIN_VILLAGE_MINESHAFT_LADDER_START_CLEARANCE;

    ladders.push({
      key: `${chunk.key}-mineshaft-ladder-${index}`,
      angle: ladderAngle,
      localX: Math.sin(ladderAngle) * MOUNTAIN_VILLAGE_MINESHAFT_LADDER_RING_RADIUS,
      localZ: Math.cos(ladderAngle) * MOUNTAIN_VILLAGE_MINESHAFT_LADDER_RING_RADIUS,
      startY,
      endY: hut.y + MOUNTAIN_VILLAGE_MINESHAFT_LADDER_EXIT_CLEARANCE,
      rotation: ladderAngle + Math.PI,
      width: MOUNTAIN_VILLAGE_MINESHAFT_LADDER_WIDTH,
    });
  }

  const topHut = huts[huts.length - 1];
  if (topHut) {
    const exitAngle = topHut.angle + (huts.length % 2 === 0 ? 0.62 : -0.62);
    ladders.push({
      key: `${chunk.key}-mineshaft-top-exit-ladder`,
      angle: exitAngle,
      localX: Math.sin(exitAngle) * MOUNTAIN_VILLAGE_MINESHAFT_LADDER_RING_RADIUS,
      localZ: Math.cos(exitAngle) * MOUNTAIN_VILLAGE_MINESHAFT_LADDER_RING_RADIUS,
      startY: topHut.y + MOUNTAIN_VILLAGE_MINESHAFT_LADDER_START_CLEARANCE,
      endY: summitY + MOUNTAIN_VILLAGE_MINESHAFT_EXIT_BRIDGE_Y_OFFSET + 1.45,
      rotation: exitAngle + Math.PI,
      width: MOUNTAIN_VILLAGE_MINESHAFT_LADDER_WIDTH,
    });
  }

  return ladders;
}

export function getMountainMineshaftSummitSnowDrifts({
  count = 28,
  rimOuterRadius = MOUNTAIN_VILLAGE_MINESHAFT_RIM_OUTER_RADIUS,
}: {
  count?: number;
  rimOuterRadius?: number;
} = {}) {
  const safeCount = Math.max(0, Math.floor(count));
  const cacheKey = `${safeCount}:${rimOuterRadius}`;
  const cached = summitSnowDriftCache.get(cacheKey);
  if (cached) return cached;

  const drifts = new Array<MountainMineshaftSummitSnowDrift>(safeCount);
  for (let index = 0; index < safeCount; index += 1) {
    const angle = (index * Math.PI * 2) / safeCount + Math.sin(index * 1.83) * 0.14;
    const radius = rimOuterRadius + 9 + (index % 5) * 7.2 + Math.sin(index * 2.4) * 2.1;
    drifts[index] = {
      index,
      positionXZ: [Math.sin(angle) * radius, Math.cos(angle) * radius],
      yOffset: 0.84,
      rotation: [-Math.PI / 2, 0, angle],
      scale: [4.4 + (index % 4) * 1.7, 1.9 + (index % 3) * 0.85, 1],
      color: index % 2 === 0 ? "#f8fdff" : "#cdeafa",
    };
  }
  summitSnowDriftCache.set(cacheKey, drifts);
  return drifts;
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

export function getMountainMineshaftSupportFrames({ count = 4 }: { count?: number } = {}) {
  const safeCount = Math.max(0, Math.floor(count));
  const cacheKey = `${safeCount}`;
  const cached = supportFrameCache.get(cacheKey);
  if (cached) return cached;

  const frames = new Array<MountainMineshaftSupportFrame>(safeCount);
  for (let index = 0; index < safeCount; index += 1) {
    const angle = (index * Math.PI) / 2 + Math.PI / 4;
    frames[index] = {
      index,
      angle,
      rotation: [0, angle, 0],
      posts: MOUNTAIN_MINESHAFT_SUPPORT_SIDES.map((side) => ({
        side,
        positionOffset: [side * 12, 8.2, 29] as [number, number, number],
        rotation: [0, 0, side * 0.12] as [number, number, number],
      })),
      topBeamPositionOffset: [0, 16.2, 29],
      snowCaps: MOUNTAIN_MINESHAFT_SUPPORT_SIDES.map((side) => ({
        side,
        position: [side * 8.7, 1.32, 0] as [number, number, number],
      })),
    };
  }

  supportFrameCache.set(cacheKey, frames);
  return frames;
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
