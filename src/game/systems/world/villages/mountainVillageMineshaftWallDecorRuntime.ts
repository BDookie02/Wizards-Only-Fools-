import {
  MOUNTAIN_VILLAGE_MINESHAFT_GOLDEN_ANGLE,
  MOUNTAIN_VILLAGE_MINESHAFT_HOLE_RADIUS,
  MOUNTAIN_VILLAGE_MINESHAFT_WALL_FIBONACCI_SEQUENCE,
  MOUNTAIN_VILLAGE_MINESHAFT_WALL_LANTERN_COUNT,
  MOUNTAIN_VILLAGE_MINESHAFT_WALL_PAINTING_COUNT,
} from "./mountainVillageTerrain";

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

const MOUNTAIN_MINESHAFT_ROPE_LIGHT_GLOW_COLORS = ["#fff0a8", "#ffd56f", "#ffb65b", "#ff8a3a"];
const wallDecorCache = new Map<string, MountainMineshaftWallDecorDescriptors>();

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
  let ropeLightCount = 0;
  for (let tierIndex = 0; tierIndex < MOUNTAIN_VILLAGE_MINESHAFT_WALL_FIBONACCI_SEQUENCE.length; tierIndex += 1) {
    ropeLightCount += MOUNTAIN_VILLAGE_MINESHAFT_WALL_FIBONACCI_SEQUENCE[tierIndex];
  }
  const ropeLights = new Array<MountainMineshaftWallRopeLightDescriptor>(ropeLightCount);
  let writeIndex = 0;

  for (let tierIndex = 0; tierIndex < MOUNTAIN_VILLAGE_MINESHAFT_WALL_FIBONACCI_SEQUENCE.length; tierIndex += 1) {
    const lightCount = MOUNTAIN_VILLAGE_MINESHAFT_WALL_FIBONACCI_SEQUENCE[tierIndex];
    const t = tierIndex / Math.max(1, MOUNTAIN_VILLAGE_MINESHAFT_WALL_FIBONACCI_SEQUENCE.length - 1);
    const y = ropeTopY - t * ropeSequenceHeight;
    const rowAngle = -0.25 + tierIndex * MOUNTAIN_VILLAGE_MINESHAFT_GOLDEN_ANGLE;

    for (let lightIndex = 0; lightIndex < lightCount; lightIndex += 1) {
      const angle = rowAngle + (lightCount === 1 ? 0 : (Math.PI * 2 * lightIndex) / lightCount);
      ropeLights[writeIndex] = {
        key: `rope-fibonacci-light-${tierIndex}-${lightIndex}`,
        tierIndex,
        lightIndex,
        position: [Math.sin(angle) * ropeRadius, y, Math.cos(angle) * ropeRadius],
        rotation: [0, angle, 0],
        bulbScale: 1.06 + Math.min(0.38, tierIndex * 0.05),
        glowColor: MOUNTAIN_MINESHAFT_ROPE_LIGHT_GLOW_COLORS[lightIndex % MOUNTAIN_MINESHAFT_ROPE_LIGHT_GLOW_COLORS.length],
        hasLight: tierIndex < 2 && lightIndex === 0,
      };
      writeIndex += 1;
    }
  }

  const descriptors = { lanterns, paintings, ropeLights };
  wallDecorCache.set(cacheKey, descriptors);
  return descriptors;
}

export function getMountainMineshaftWallDecorSummary(bottomY = 18, summitY = 160) {
  const descriptors = getMountainMineshaftWallDecorDescriptors({ bottomY, summitY });
  return {
    lanternCount: descriptors.lanterns.length,
    lightedLanternCount: descriptors.lanterns.filter((lantern) => lantern.withLight).length,
    paintingCount: descriptors.paintings.length,
    ropeLightCount: descriptors.ropeLights.length,
    poweredRopeLightCount: descriptors.ropeLights.filter((light) => light.hasLight).length,
  };
}
