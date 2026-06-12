import type { HutInfo } from "./baseVillageHutLayout";
import type { MountainMineshaftHut } from "./mountainVillageMineshaftRuntime";
import {
  MOUNTAIN_VILLAGE_TRAIL_START_RADIUS,
  getMountainVillageHeight,
} from "./mountainVillageTerrain";
import { survivalHash01 } from "../survival/survivalMath";
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

const MOUNTAIN_CABIN_BODY_COLORS = ["#584633", "#64513d", "#4f4538", "#6b573f"] as const;
const MOUNTAIN_CABIN_ROOF_COLORS = ["#dceefa", "#cfe4f3", "#edf7ff", "#b9d3e8"] as const;
const MOUNTAIN_CABIN_ACCENT_COLORS = ["#82d8ff", "#f5d28a", "#bce7ff", "#d6f4ff"] as const;

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
