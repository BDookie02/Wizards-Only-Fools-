import type { HutInfo } from "./baseVillageHutLayout";
import type { MountainMineshaftHut } from "./mountainVillageMineshaftRuntime";
import {
  MOUNTAIN_VILLAGE_HEIGHT,
  MOUNTAIN_VILLAGE_PLATEAU_RADIUS,
  MOUNTAIN_VILLAGE_RADIUS,
  MOUNTAIN_VILLAGE_TRAIL_END_RADIUS,
  MOUNTAIN_VILLAGE_TRAIL_HEIGHT_OFFSET,
  MOUNTAIN_VILLAGE_TRAIL_START_RADIUS,
  MOUNTAIN_VILLAGE_TRAIL_TURNS,
  getMountainVillageHeight,
  getMountainVillageTrailAngleOffset,
  getMountainVillageTrailWidth,
} from "./mountainVillageTerrain";
import { lerpNumber, smoothstep01, smoothstepRange, survivalHash01 } from "../survival/survivalMath";
import type { SurvivalChunkInfo } from "../survival/survivalWorldConfig";

type MountainVillageTerrainHeightForChunk = (chunk: SurvivalChunkInfo, localX: number, localZ: number) => number;

export type MountainVillageCabin = {
  key: string;
  localX: number;
  localZ: number;
  rotation: number;
  width: number;
  depth: number;
  height: number;
  bodyColor: string;
  roofColor: string;
  accentColor: string;
};

export type MountainVillageWaterfall = {
  angle: number;
  topX: number;
  topZ: number;
  topY: number;
  bottomX: number;
  bottomZ: number;
  bottomY: number;
  width: number;
};

export type MountainVillageCliffPatch = {
  key: string;
  localX: number;
  localZ: number;
  y: number;
  yaw: number;
  roll: number;
  width: number;
  depth: number;
  thickness: number;
  color: string;
  opacity: number;
};

export type MountainVillageTrailPoint = {
  localX: number;
  localZ: number;
  y: number;
  width: number;
  t: number;
};

export type MountainVillageTrailSupport = {
  key: string;
  localX: number;
  localZ: number;
  topY: number;
  height: number;
  yaw: number;
  side: -1 | 1;
};

export type MountainVillageTrailSegment = {
  key: string;
  localX: number;
  localZ: number;
  y: number;
  yaw: number;
  slope: number;
  width: number;
  length: number;
  index: number;
  supports: MountainVillageTrailSupport[];
};

const MOUNTAIN_CABIN_BODY_COLORS = ["#584633", "#64513d", "#4f4538", "#6b573f"] as const;
const MOUNTAIN_CABIN_ROOF_COLORS = ["#dceefa", "#cfe4f3", "#edf7ff", "#b9d3e8"] as const;
const MOUNTAIN_CABIN_ACCENT_COLORS = ["#82d8ff", "#f5d28a", "#bce7ff", "#d6f4ff"] as const;
const MOUNTAIN_CLIFF_STONE_COLORS = ["#3f474a", "#545d60", "#6f7a7d", "#838f94", "#2f3638"] as const;
const MOUNTAIN_CLIFF_SNOW_COLORS = ["#d9eef7", "#eef9ff", "#bcdce9"] as const;

function getMountainVillageTrailPoint(
  chunk: SurvivalChunkInfo,
  baseHeight: number,
  t: number,
  terrainHeightForChunk: MountainVillageTerrainHeightForChunk,
): MountainVillageTrailPoint {
  const eased = Math.pow(smoothstep01(t), 0.86);
  const radius = lerpNumber(MOUNTAIN_VILLAGE_TRAIL_START_RADIUS, MOUNTAIN_VILLAGE_TRAIL_END_RADIUS, eased);
  const angleOffset = getMountainVillageTrailAngleOffset(chunk);
  const angle = angleOffset + Math.pow(t, 1.16) * MOUNTAIN_VILLAGE_TRAIL_TURNS * Math.PI * 2;
  const localX = Math.sin(angle) * radius;
  const localZ = Math.cos(angle) * radius;
  const stiltLift = smoothstepRange(0.02, 0.16, t) * (1 - smoothstepRange(0.84, 0.98, t));
  const lift = lerpNumber(1.45, MOUNTAIN_VILLAGE_TRAIL_HEIGHT_OFFSET, stiltLift) + Math.sin(t * Math.PI) * 1.25;
  const y = getMountainVillageHeight(chunk, localX, localZ, terrainHeightForChunk, baseHeight) + lift;

  return { localX, localZ, y, width: getMountainVillageTrailWidth(t), t };
}

export function makeMountainVillageTrailPoints(
  chunk: SurvivalChunkInfo,
  baseHeight: number,
  terrainHeightForChunk: MountainVillageTerrainHeightForChunk,
): MountainVillageTrailPoint[] {
  const pointCount = chunk.lod === "near" ? 24 : 16;
  const points = new Array<MountainVillageTrailPoint>(pointCount + 1);

  for (let index = 0; index <= pointCount; index += 1) {
    points[index] = getMountainVillageTrailPoint(chunk, baseHeight, index / pointCount, terrainHeightForChunk);
  }

  return points;
}

export function makeMountainVillageTrailSegments(
  chunk: SurvivalChunkInfo,
  baseHeight: number,
  points: MountainVillageTrailPoint[],
  terrainHeightForChunk: MountainVillageTerrainHeightForChunk,
): MountainVillageTrailSegment[] {
  const segmentCount = points.length - 1;
  const segments = new Array<MountainVillageTrailSegment>(segmentCount);

  for (let index = 0; index < segmentCount; index += 1) {
    const point = points[index];
    const next = points[index + 1];
    const dx = next.localX - point.localX;
    const dz = next.localZ - point.localZ;
    const dy = next.y - point.y;
    const horizontalLength = Math.max(0.1, Math.sqrt(dx * dx + dz * dz));
    const midpointLocalX = (point.localX + next.localX) / 2;
    const midpointLocalZ = (point.localZ + next.localZ) / 2;
    const midpointY = (point.y + next.y) / 2;
    const progress = index / segmentCount;
    const yaw = Math.atan2(dx, dz);
    const width = getMountainVillageTrailWidth(progress);
    const rightX = Math.cos(yaw);
    const rightZ = -Math.sin(yaw);
    const supportOffset = width / 2 - 1.12;
    const supports: MountainVillageTrailSupport[] = [];

    for (let supportIndex = 0; supportIndex < 2; supportIndex += 1) {
      const side = supportIndex === 0 ? -1 : 1;
      const localX = midpointLocalX + rightX * supportOffset * side;
      const localZ = midpointLocalZ + rightZ * supportOffset * side;
      const topY = midpointY - 1.18;
      const groundY = getMountainVillageHeight(chunk, localX, localZ, terrainHeightForChunk, baseHeight) + 0.22;
      const height = topY - groundY;
      if (height < 4.6) continue;

      supports.push({
        key: `${chunk.key}-mountain-trail-support-${index}-${side}`,
        localX,
        localZ,
        topY,
        height,
        yaw,
        side,
      });
    }

    segments[index] = {
      key: `${chunk.key}-mountain-trail-${index}`,
      localX: midpointLocalX,
      localZ: midpointLocalZ,
      y: midpointY,
      yaw,
      slope: Math.atan2(dy, horizontalLength),
      width,
      length: horizontalLength * 1.08,
      index,
      supports,
    };
  }

  return segments;
}

export function makeMountainVillageCabins(chunk: SurvivalChunkInfo): MountainVillageCabin[] {
  const cabinCount = chunk.lod === "near" ? 8 : 5;
  const cabins = new Array<MountainVillageCabin>(cabinCount);
  const roofColorOffset = Math.floor(survivalHash01(chunk.cx, chunk.cz, 4610) * MOUNTAIN_CABIN_ROOF_COLORS.length);

  for (let index = 0; index < cabinCount; index += 1) {
    const angle = (Math.PI * 2 * index) / cabinCount + 0.28 + survivalHash01(chunk.cx, chunk.cz, 4480) * 0.2;
    const ring = 59 + (index % 2) * 12 + survivalHash01(chunk.cx, chunk.cz, 4510 + index) * 7;
    const width = 17 + survivalHash01(chunk.cx, chunk.cz, 4540 + index) * 7;
    const depth = 15 + survivalHash01(chunk.cx, chunk.cz, 4570 + index) * 6;
    const height = 9 + survivalHash01(chunk.cx, chunk.cz, 4600 + index) * 4;

    cabins[index] = {
      key: `${chunk.key}-mountain-cabin-${index}`,
      localX: Math.sin(angle) * ring,
      localZ: Math.cos(angle) * ring,
      rotation: angle + Math.PI,
      width,
      depth,
      height,
      bodyColor: MOUNTAIN_CABIN_BODY_COLORS[index % MOUNTAIN_CABIN_BODY_COLORS.length],
      roofColor: MOUNTAIN_CABIN_ROOF_COLORS[(index + roofColorOffset) % MOUNTAIN_CABIN_ROOF_COLORS.length],
      accentColor: MOUNTAIN_CABIN_ACCENT_COLORS[index % MOUNTAIN_CABIN_ACCENT_COLORS.length],
    };
  }

  return cabins;
}

export function makeMountainVillageCliffPatches(
  chunk: SurvivalChunkInfo,
  baseHeight: number,
  terrainHeightForChunk: MountainVillageTerrainHeightForChunk,
): MountainVillageCliffPatch[] {
  const count = chunk.lod === "near" ? 48 : 20;
  const patches = new Array<MountainVillageCliffPatch>(count);

  for (let index = 0; index < count; index += 1) {
    const ringT = survivalHash01(chunk.cx, chunk.cz, 5200 + index);
    const angle = (index / count) * Math.PI * 2 + (survivalHash01(chunk.cx, chunk.cz, 5230 + index) - 0.5) * 0.32;
    const radius = lerpNumber(
      MOUNTAIN_VILLAGE_PLATEAU_RADIUS + 16,
      MOUNTAIN_VILLAGE_RADIUS - 20,
      Math.pow(ringT, 0.92)
    ) + Math.sin(index * 2.17 + chunk.cx * 0.7) * 5.5;
    const localX = Math.sin(angle) * radius;
    const localZ = Math.cos(angle) * radius;
    const y = getMountainVillageHeight(chunk, localX, localZ, terrainHeightForChunk, baseHeight);
    const lift = y - baseHeight;
    const snowMix = smoothstepRange(MOUNTAIN_VILLAGE_HEIGHT * 0.6, MOUNTAIN_VILLAGE_HEIGHT * 0.92, lift);
    const colorSet = snowMix > 0.56 && index % 3 !== 1 ? MOUNTAIN_CLIFF_SNOW_COLORS : MOUNTAIN_CLIFF_STONE_COLORS;
    const width = lerpNumber(9, 23, survivalHash01(chunk.cx, chunk.cz, 5260 + index)) * (snowMix > 0.62 ? 0.78 : 1);
    const depth = lerpNumber(2.2, 6.4, survivalHash01(chunk.cx, chunk.cz, 5290 + index));

    patches[index] = {
      key: `${chunk.key}-mountain-cliff-patch-${index}`,
      localX,
      localZ,
      y: y + 0.46,
      yaw: angle + Math.PI / 2,
      roll: (survivalHash01(chunk.cx, chunk.cz, 5320 + index) - 0.5) * 0.34,
      width,
      depth,
      thickness: lerpNumber(0.18, 0.46, survivalHash01(chunk.cx, chunk.cz, 5350 + index)),
      color: colorSet[Math.floor(survivalHash01(chunk.cx, chunk.cz, 5380 + index) * colorSet.length) % colorSet.length],
      opacity: lerpNumber(0.48, 0.82, survivalHash01(chunk.cx, chunk.cz, 5410 + index)),
    };
  }

  return patches;
}

export function makeMountainVillageWaterfall(
  chunk: SurvivalChunkInfo,
  baseHeight: number,
  terrainHeightForChunk: MountainVillageTerrainHeightForChunk,
): MountainVillageWaterfall {
  const waterfallAngle = -Math.PI * 0.28 + survivalHash01(chunk.cx, chunk.cz, 4700) * 0.52;
  const topRadius = 112;
  const bottomRadius = MOUNTAIN_VILLAGE_TRAIL_START_RADIUS + 8;
  const topX = Math.sin(waterfallAngle) * topRadius;
  const topZ = Math.cos(waterfallAngle) * topRadius;
  const bottomX = Math.sin(waterfallAngle) * bottomRadius;
  const bottomZ = Math.cos(waterfallAngle) * bottomRadius;

  return {
    angle: waterfallAngle,
    topX,
    topZ,
    topY: getMountainVillageHeight(chunk, topX, topZ, terrainHeightForChunk, baseHeight) + 4.8,
    bottomX,
    bottomZ,
    bottomY: getMountainVillageHeight(chunk, bottomX, bottomZ, terrainHeightForChunk, baseHeight) + 1.25,
    width: 12 + survivalHash01(chunk.cx, chunk.cz, 4730) * 7,
  };
}

export function makeMountainVillageHutInfos(
  chunk: SurvivalChunkInfo,
  summitY: number,
  cabins: MountainVillageCabin[],
  interiorHuts: MountainMineshaftHut[],
) {
  const hutInfos = new Array<HutInfo>(cabins.length + interiorHuts.length);

  for (let index = 0; index < cabins.length; index += 1) {
    const cabin = cabins[index];
    hutInfos[index] = {
      id: `${chunk.key}-mountain-hut-${index}`,
      x: chunk.x + cabin.localX,
      y: summitY,
      z: chunk.z + cabin.localZ,
      hutType: 2,
      colorIndex: index % 4,
      rotation: cabin.rotation,
      hasPath: true,
      pathRot: cabin.rotation,
      isMushroom: false,
      interiorWidth: cabin.width,
      interiorDepth: cabin.depth,
      interiorHeight: cabin.height,
      villagerBackOffset: Math.max(2.5, cabin.depth / 2 - 2.45),
      villagerSideOffset: (index % 2 === 0 ? -1 : 1) * Math.min(0.9, cabin.width * 0.05),
      villagerYOffset: 0.95,
      villagerTheme: "village",
    };
  }

  for (let index = 0; index < interiorHuts.length; index += 1) {
    const hut = interiorHuts[index];
    hutInfos[cabins.length + index] = {
      id: `${chunk.key}-mountain-interior-hut-${index}`,
      x: chunk.x + hut.localX,
      y: hut.y + 0.48,
      z: chunk.z + hut.localZ,
      hutType: 2,
      colorIndex: (index + 1) % 4,
      rotation: hut.rotation,
      hasPath: true,
      pathRot: hut.rotation,
      isMushroom: false,
      interiorWidth: hut.width,
      interiorDepth: hut.depth,
      interiorHeight: hut.height,
      villagerBackOffset: Math.max(2.2, hut.depth / 2 + 1.4),
      villagerSideOffset: (index % 2 === 0 ? -1 : 1) * 0.55,
      villagerYOffset: 0.95,
      villagerTheme: "village",
    };
  }

  return hutInfos;
}
