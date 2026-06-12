import type { SurvivalChunkInfo } from "../survival/survivalWorldConfig";
import { getDistanceToSegment2D, lerpNumber } from "../survival/survivalMath";
import { getBrowserSurvivalPlayerPosition } from "../survival/survivalPosition";
import { MOUNTAIN_WATERFALL_CAMERA_HIDE_FAR } from "./mountainVillageTerrain";

export type MountainVillageWaterfallBounds = {
  angle?: number;
  width?: number;
  topX: number;
  topZ: number;
  topY: number;
  bottomX: number;
  bottomZ: number;
  bottomY: number;
};

export type MountainWaterfallPlaneDescriptor = {
  position: [number, number, number];
  rotation: [number, number, number];
  width: number;
  height: number;
};

export type MountainWaterfallDarkEdgeDescriptor = MountainWaterfallPlaneDescriptor & {
  side: -1 | 1;
};

export type MountainWaterfallFoamDescriptor = {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
};

export type MountainWaterfallSprayDescriptor = {
  index: number;
  position: [number, number, number];
  scale: [number, number, number];
};

export type MountainWaterfallVisualDescriptors = {
  mainFall: MountainWaterfallPlaneDescriptor;
  brightFall: MountainWaterfallPlaneDescriptor;
  darkEdges: MountainWaterfallDarkEdgeDescriptor[];
  topFoam: MountainWaterfallFoamDescriptor;
  bottomFoam: MountainWaterfallFoamDescriptor;
  sprayPuffs: MountainWaterfallSprayDescriptor[];
};

const WATERFALL_EDGE_SIDES = [-1, 1] as const;
const waterfallVisualDescriptorCache = new Map<string, MountainWaterfallVisualDescriptors>();

export function shouldHideMountainWaterfallForCamera(
  chunk: SurvivalChunkInfo,
  waterfall: MountainVillageWaterfallBounds,
) {
  const player = getBrowserSurvivalPlayerPosition();
  if (!player || typeof player.y !== "number") return false;

  const localX = player.x - chunk.x;
  const localZ = player.z - chunk.z;
  const distanceToFall = getDistanceToSegment2D(
    localX,
    localZ,
    waterfall.topX,
    waterfall.topZ,
    waterfall.bottomX,
    waterfall.bottomZ,
  );
  const isInsideFallHeight = player.y >= waterfall.bottomY - 16 && player.y <= waterfall.topY + 20;

  return isInsideFallHeight && distanceToFall < MOUNTAIN_WATERFALL_CAMERA_HIDE_FAR;
}

export function getMountainWaterfallVisualDescriptors({
  waterfall,
  summitY,
  sprayCount = 10,
  surfaceOffset = 3.6,
}: {
  waterfall: MountainVillageWaterfallBounds;
  summitY: number;
  sprayCount?: number;
  surfaceOffset?: number;
}): MountainWaterfallVisualDescriptors {
  const angle = waterfall.angle ?? 0;
  const width = waterfall.width ?? 12;
  const safeSprayCount = Math.max(0, Math.floor(sprayCount));
  const cacheKey = [
    angle,
    width,
    waterfall.topX,
    waterfall.topY,
    waterfall.topZ,
    waterfall.bottomX,
    waterfall.bottomY,
    waterfall.bottomZ,
    summitY,
    safeSprayCount,
    surfaceOffset,
  ].join(":");
  const cached = waterfallVisualDescriptorCache.get(cacheKey);
  if (cached) return cached;

  const outwardX = Math.sin(angle) * surfaceOffset;
  const outwardZ = Math.cos(angle) * surfaceOffset;
  const midX = (waterfall.topX + waterfall.bottomX) / 2 + outwardX;
  const midZ = (waterfall.topZ + waterfall.bottomZ) / 2 + outwardZ;
  const height = Math.max(18, waterfall.topY - waterfall.bottomY);
  const midY = waterfall.bottomY + height / 2;
  const rotation: [number, number, number] = [0, angle, 0];
  const darkEdges = WATERFALL_EDGE_SIDES.map((side) => {
    const sideOffset = side * width * 0.43;
    return {
      side,
      position: [midX + Math.cos(angle) * sideOffset, midY - height * 0.02, midZ - Math.sin(angle) * sideOffset] as [number, number, number],
      rotation,
      width: width * 0.12,
      height: height * 0.92,
    };
  });
  const sprayPuffs = new Array<MountainWaterfallSprayDescriptor>(safeSprayCount);
  for (let index = 0; index < safeSprayCount; index += 1) {
    const t = safeSprayCount <= 1 ? 0 : index / (safeSprayCount - 1);
    sprayPuffs[index] = {
      index,
      position: [
        lerpNumber(waterfall.topX, waterfall.bottomX, t) + outwardX,
        lerpNumber(waterfall.topY, waterfall.bottomY, t),
        lerpNumber(waterfall.topZ, waterfall.bottomZ, t) + outwardZ,
      ],
      scale: [1.8 + (index % 3), 0.7, 1.8 + (index % 2)],
    };
  }

  const descriptors = {
    mainFall: {
      position: [midX, midY, midZ] as [number, number, number],
      rotation,
      width,
      height,
    },
    brightFall: {
      position: [midX + outwardX * 0.18, midY + height * 0.04, midZ + outwardZ * 0.18] as [number, number, number],
      rotation,
      width: width * 0.36,
      height: height * 0.96,
    },
    darkEdges,
    topFoam: {
      position: [waterfall.topX * 0.74 + outwardX * 0.35, summitY + 0.98, waterfall.topZ * 0.74 + outwardZ * 0.35] as [number, number, number],
      rotation: [-Math.PI / 2, 0, 0] as [number, number, number],
      scale: [28, 9, 1] as [number, number, number],
    },
    bottomFoam: {
      position: [waterfall.bottomX + outwardX, waterfall.bottomY + 0.32, waterfall.bottomZ + outwardZ] as [number, number, number],
      rotation: [-Math.PI / 2, 0, 0] as [number, number, number],
      scale: [35, 24, 1] as [number, number, number],
    },
    sprayPuffs,
  };
  waterfallVisualDescriptorCache.set(cacheKey, descriptors);
  return descriptors;
}
