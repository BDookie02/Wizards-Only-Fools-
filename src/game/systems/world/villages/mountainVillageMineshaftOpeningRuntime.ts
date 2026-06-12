import { lerpNumber, survivalHash01 } from "../survival/survivalMath";
import {
  MOUNTAIN_VILLAGE_MINESHAFT_RIM_OUTER_RADIUS,
} from "./mountainVillageTerrain";

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
const MOUNTAIN_MINESHAFT_BOTTOM_ROCK_COLORS = ["#4b4237", "#2f2b27", "#66533c"];

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

export function getMountainMineshaftOpeningRuntimeSummary() {
  const snowDrifts = getMountainMineshaftSummitSnowDrifts();
  const rimBeams = getMountainMineshaftRimBeams({ count: 12, holeRadius: 25, outerRadius: 39 });
  const supportFrames = getMountainMineshaftSupportFrames({ count: 4 });
  const bottomRocks = getMountainMineshaftBottomRocks({ count: 14, bottomRadius: 28 });

  return {
    snowDriftCount: snowDrifts.length,
    rimBeamCount: rimBeams.length,
    supportFrameCount: supportFrames.length,
    supportPostCount: supportFrames.reduce((total, frame) => total + frame.posts.length, 0),
    supportSnowCapCount: supportFrames.reduce((total, frame) => total + frame.snowCaps.length, 0),
    bottomRockCount: bottomRocks.length,
    firstSnowDrift: snowDrifts[0],
    firstRimBeam: rimBeams[0],
    firstSupportFrame: supportFrames[0],
    firstBottomRock: bottomRocks[0],
  };
}
