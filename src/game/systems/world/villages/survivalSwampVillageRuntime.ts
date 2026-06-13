import * as THREE from "three";
import type { HutInfo } from "./baseVillageHutLayout";
import { SWAMP_VILLAGE_RADIUS } from "./survivalSwampVillageTerrain";
import { survivalHash01 } from "../survival/survivalMath";
import type { SurvivalChunkInfo } from "../survival/survivalWorldConfig";

export type SwampVillageRope = {
  key: string;
  start: [number, number, number];
  end: [number, number, number];
  sag: number;
  lightCount: number;
  lightHue: number;
};

export type SwampVillageHut = {
  key: string;
  localX: number;
  localZ: number;
  width: number;
  depth: number;
  height: number;
  rotation: number;
  ropeAngle: number;
  platformY: number;
  wallColor: string;
  roofColor: string;
  variant: number;
};

export type SwampVillageWalkway = {
  key: string;
  localX: number;
  localZ: number;
  rotation: number;
  width: number;
  length: number;
  y: number;
};

export type SwampVillageRamp = {
  key: string;
  localX: number;
  localZ: number;
  rotation: number;
  width: number;
  length: number;
  highY: number;
  lowY: number;
};

export type SwampVillageLilyPad = {
  key: string;
  localX: number;
  localZ: number;
  scale: number;
  rotation: number;
  color: string;
};

export type SwampVillageStump = {
  key: string;
  localX: number;
  localZ: number;
  height: number;
  radius: number;
};

export type SwampVillageReedPatch = {
  key: string;
  localX: number;
  localZ: number;
  rotation: number;
  scale: number;
};

export type SwampVillageLayout = {
  huts: SwampVillageHut[];
  hutInfos: HutInfo[];
  walkways: SwampVillageWalkway[];
  ramps: SwampVillageRamp[];
  lilyPads: SwampVillageLilyPad[];
  stumps: SwampVillageStump[];
  reeds: SwampVillageReedPatch[];
  ropes: SwampVillageRope[];
  waterY: number;
  platformY: number;
};

export type SwampVillageWaterLevelAtWorld = (worldX: number, worldZ: number) => number;

export type SwampVillageRopeLightSegment = {
  key: string;
  position: [number, number, number];
  quaternion: THREE.Quaternion;
  length: number;
};

export type SwampVillageRopeLightBulb = {
  key: string;
  position: [number, number, number];
  cordPosition: [number, number, number];
  cordLength: number;
  color: string;
  hasPointLight: boolean;
};

const SWAMP_ROPE_LIGHT_COLORS = ["#fde68a", "#fbbf24", "#bbf7d0", "#86efac"] as const;
const SWAMP_ROPE_SEGMENT_UP = new THREE.Vector3(0, 1, 0);
const SWAMP_VILLAGE_HUT_COLORS = ["#5c4a2e", "#4c3b25", "#665634", "#3f3524"];
const SWAMP_VILLAGE_ROOF_COLORS = ["#223516", "#2f431b", "#445223", "#1f2d16"];
const SWAMP_LILY_COLORS = ["#6ea43e", "#7db34d", "#4e8735", "#89bd5a"];
const SWAMP_DOCK_DIRECTIONS = [
  { key: "north", localX: 0, localZ: -SWAMP_VILLAGE_RADIUS * 0.5, rotation: 0, rampX: 0, rampZ: -1, rampRotation: Math.PI },
  { key: "south", localX: 0, localZ: SWAMP_VILLAGE_RADIUS * 0.5, rotation: 0, rampX: 0, rampZ: 1, rampRotation: 0 },
  { key: "east", localX: SWAMP_VILLAGE_RADIUS * 0.5, localZ: 0, rotation: Math.PI / 2, rampX: 1, rampZ: 0, rampRotation: Math.PI / 2 },
  { key: "west", localX: -SWAMP_VILLAGE_RADIUS * 0.5, localZ: 0, rotation: Math.PI / 2, rampX: -1, rampZ: 0, rampRotation: -Math.PI / 2 },
] as const;

function getSwampVillageWaterY(
  chunk: SurvivalChunkInfo,
  baseHeight: number,
  getWaterLevelAtWorld: SwampVillageWaterLevelAtWorld,
) {
  return Math.max(getWaterLevelAtWorld(chunk.x, chunk.z) + 0.22, baseHeight + 0.42);
}

function getHorizontalDistance(dx: number, dz: number) {
  return Math.sqrt(dx * dx + dz * dz);
}

function getSwampHutsByRopeAngle(huts: readonly SwampVillageHut[]) {
  const sortedHuts: SwampVillageHut[] = [];
  for (let index = 0; index < huts.length; index += 1) {
    const hut = huts[index];
    let insertIndex = sortedHuts.length;
    while (insertIndex > 0 && hut.ropeAngle < sortedHuts[insertIndex - 1].ropeAngle) {
      sortedHuts[insertIndex] = sortedHuts[insertIndex - 1];
      insertIndex -= 1;
    }
    sortedHuts[insertIndex] = hut;
  }
  return sortedHuts;
}

function getSwampHutRopeAnchor(hut: SwampVillageHut, target: SwampVillageHut): [number, number, number] {
  const dx = target.localX - hut.localX;
  const dz = target.localZ - hut.localZ;
  const distance = Math.max(1, getHorizontalDistance(dx, dz));
  const nx = dx / distance;
  const nz = dz / distance;
  const anchorRadius = Math.min(14, Math.max(hut.width, hut.depth) * 0.58 + 1.4);

  return [
    hut.localX + nx * anchorRadius,
    hut.platformY + hut.height + 1.55 + (hut.variant - 0.5) * 0.55,
    hut.localZ + nz * anchorRadius,
  ];
}

export function makeSwampVillageLayout(
  chunk: SurvivalChunkInfo,
  baseHeight: number,
  getWaterLevelAtWorld: SwampVillageWaterLevelAtWorld,
): SwampVillageLayout {
  const waterY = getSwampVillageWaterY(chunk, baseHeight, getWaterLevelAtWorld);
  const platformY = waterY + 5.9;
  const huts: SwampVillageHut[] = [];
  const hutInfos: HutInfo[] = [];
  const walkways: SwampVillageWalkway[] = [];
  const ramps: SwampVillageRamp[] = [];
  const rampLength = 76;
  const rampLowY = Math.max(baseHeight + 1.25, waterY + 0.76);
  for (let index = 0; index < SWAMP_DOCK_DIRECTIONS.length; index += 1) {
    const direction = SWAMP_DOCK_DIRECTIONS[index];
    walkways.push({
      key: `${chunk.key}-swamp-main-${direction.key}`,
      localX: direction.localX,
      localZ: direction.localZ,
      rotation: direction.rotation,
      width: 14,
      length: SWAMP_VILLAGE_RADIUS,
      y: platformY,
    });
    ramps.push({
      key: `${chunk.key}-swamp-ramp-${direction.key}`,
      localX: direction.rampX * (SWAMP_VILLAGE_RADIUS + rampLength * 0.5),
      localZ: direction.rampZ * (SWAMP_VILLAGE_RADIUS + rampLength * 0.5),
      rotation: direction.rampRotation,
      width: 17,
      length: rampLength,
      highY: platformY,
      lowY: rampLowY,
    });
  }

  const hutCount = chunk.lod === "mid" ? 7 : 13;
  for (let index = 0; index < hutCount; index += 1) {
    const ring = index % 4 === 0 ? 92 : index % 3 === 0 ? 148 : 124;
    const angle = (Math.PI * 2 * index) / hutCount + 0.22 + (survivalHash01(chunk.cx, chunk.cz, 910 + index) - 0.5) * 0.28;
    const localX = Math.sin(angle) * ring + (survivalHash01(chunk.cx, chunk.cz, 930 + index) - 0.5) * 14;
    const localZ = Math.cos(angle) * ring + (survivalHash01(chunk.cx, chunk.cz, 950 + index) - 0.5) * 14;
    const variant = survivalHash01(chunk.cx, chunk.cz, 970 + index);
    const width = 17 + Math.round(variant * 7);
    const depth = 15 + Math.round(survivalHash01(chunk.cx, chunk.cz, 990 + index) * 7);
    const height = 10.5 + Math.round(survivalHash01(chunk.cx, chunk.cz, 1010 + index) * 4.5);
    const rotation = Math.atan2(-localX, -localZ);
    const key = `${chunk.key}-swamp-hut-${index}`;

    huts.push({
      key,
      localX,
      localZ,
      width,
      depth,
      height,
      rotation,
      ropeAngle: Math.atan2(localX, localZ),
      platformY,
      wallColor: SWAMP_VILLAGE_HUT_COLORS[Math.floor(variant * SWAMP_VILLAGE_HUT_COLORS.length) % SWAMP_VILLAGE_HUT_COLORS.length],
      roofColor: SWAMP_VILLAGE_ROOF_COLORS[Math.floor(variant * SWAMP_VILLAGE_ROOF_COLORS.length * 1.9) % SWAMP_VILLAGE_ROOF_COLORS.length],
      variant,
    });

    hutInfos.push({
      id: key,
      x: chunk.x + localX,
      y: platformY,
      z: chunk.z + localZ,
      hutType: 30 + index,
      colorIndex: Math.floor(variant * 4) % 4,
      rotation,
      hasPath: true,
      pathRot: rotation,
      isMushroom: false,
      interiorWidth: Math.max(7, width - 4),
      interiorDepth: Math.max(7, depth - 4),
      interiorHeight: height + 3,
      villagerBackOffset: -depth * 0.18,
      villagerSideOffset: (survivalHash01(chunk.cx, chunk.cz, 1030 + index) - 0.5) * width * 0.34,
      villagerYOffset: 1.05,
      villagerTheme: "swamp",
    });

    const distance = Math.max(1, getHorizontalDistance(localX, localZ));
    walkways.push({
      key: `${key}-walkway`,
      localX: localX * 0.5,
      localZ: localZ * 0.5,
      rotation: Math.atan2(localX, localZ),
      width: 10 + survivalHash01(chunk.cx, chunk.cz, 1050 + index) * 3,
      length: Math.max(28, distance - Math.max(width, depth) * 0.45),
      y: platformY,
    });
  }

  const lilyPadCount = chunk.lod === "mid" ? 12 : 28;
  const lilyPads: SwampVillageLilyPad[] = [];
  for (let index = 0; index < lilyPadCount; index += 1) {
    const angle = survivalHash01(chunk.cx, chunk.cz, 1070 + index) * Math.PI * 2;
    const radius = 46 + Math.pow(survivalHash01(chunk.cx, chunk.cz, 1090 + index), 0.58) * (SWAMP_VILLAGE_RADIUS + 34);
    lilyPads.push({
      key: `${chunk.key}-swamp-lily-${index}`,
      localX: Math.sin(angle) * radius + (survivalHash01(chunk.cx, chunk.cz, 1110 + index) - 0.5) * 32,
      localZ: Math.cos(angle) * radius + (survivalHash01(chunk.cx, chunk.cz, 1130 + index) - 0.5) * 32,
      scale: 7 + survivalHash01(chunk.cx, chunk.cz, 1150 + index) * 12,
      rotation: angle + survivalHash01(chunk.cx, chunk.cz, 1170 + index) * Math.PI,
      color: SWAMP_LILY_COLORS[index % SWAMP_LILY_COLORS.length],
    });
  }

  const stumpCount = chunk.lod === "mid" ? 8 : 18;
  const stumps: SwampVillageStump[] = [];
  for (let index = 0; index < stumpCount; index += 1) {
    const angle = survivalHash01(chunk.cx, chunk.cz, 1190 + index) * Math.PI * 2;
    const radius = 64 + survivalHash01(chunk.cx, chunk.cz, 1210 + index) * (SWAMP_VILLAGE_RADIUS + 48);
    stumps.push({
      key: `${chunk.key}-swamp-stump-${index}`,
      localX: Math.sin(angle) * radius,
      localZ: Math.cos(angle) * radius,
      height: 4 + survivalHash01(chunk.cx, chunk.cz, 1230 + index) * 8,
      radius: 1.4 + survivalHash01(chunk.cx, chunk.cz, 1250 + index) * 1.8,
    });
  }

  const reedCount = chunk.lod === "mid" ? 14 : 36;
  const reeds: SwampVillageReedPatch[] = [];
  for (let index = 0; index < reedCount; index += 1) {
    const angle = survivalHash01(chunk.cx, chunk.cz, 1270 + index) * Math.PI * 2;
    const radius = 58 + Math.pow(survivalHash01(chunk.cx, chunk.cz, 1290 + index), 0.62) * (SWAMP_VILLAGE_RADIUS + 42);
    reeds.push({
      key: `${chunk.key}-swamp-reeds-${index}`,
      localX: Math.sin(angle) * radius + (survivalHash01(chunk.cx, chunk.cz, 1310 + index) - 0.5) * 24,
      localZ: Math.cos(angle) * radius + (survivalHash01(chunk.cx, chunk.cz, 1330 + index) - 0.5) * 24,
      rotation: angle + survivalHash01(chunk.cx, chunk.cz, 1350 + index) * Math.PI,
      scale: 0.8 + survivalHash01(chunk.cx, chunk.cz, 1370 + index) * 0.9,
    });
  }

  const sortedHuts = getSwampHutsByRopeAngle(huts);
  const ropes: SwampVillageRope[] = [];
  if (sortedHuts.length > 1) {
    for (let index = 0; index < sortedHuts.length; index += 1) {
      const hut = sortedHuts[index];
      const next = sortedHuts[(index + 1) % sortedHuts.length];
      const start = getSwampHutRopeAnchor(hut, next);
      const end = getSwampHutRopeAnchor(next, hut);
      const span = getHorizontalDistance(end[0] - start[0], end[2] - start[2]);
      ropes.push({
        key: `${chunk.key}-swamp-rope-${index}`,
        start,
        end,
        sag: Math.min(8.5, Math.max(3.2, span * 0.095)),
        lightCount: span > 78 ? 4 : 3,
        lightHue: survivalHash01(chunk.cx, chunk.cz, 1390 + index),
      });
    }
  }

  return { huts, hutInfos, walkways, ramps, lilyPads, stumps, reeds, ropes, waterY, platformY };
}

export function setSwampSaggingRopePoint(target: THREE.Vector3, rope: SwampVillageRope, t: number) {
  const invT = 1 - t;
  target.set(
    rope.start[0] * invT + rope.end[0] * t,
    rope.start[1] * invT + rope.end[1] * t - Math.sin(Math.PI * t) * rope.sag,
    rope.start[2] * invT + rope.end[2] * t,
  );
  return target;
}

export function getSwampVillageRopeLightSegments(ropes: readonly SwampVillageRope[], segmentCount = 7) {
  const safeSegmentCount = Math.max(1, Math.floor(segmentCount));
  const start = new THREE.Vector3();
  const end = new THREE.Vector3();
  const direction = new THREE.Vector3();
  const midpoint = new THREE.Vector3();
  const segments: SwampVillageRopeLightSegment[] = [];

  for (let ropeIndex = 0; ropeIndex < ropes.length; ropeIndex += 1) {
    const rope = ropes[ropeIndex];
    for (let index = 0; index < safeSegmentCount; index += 1) {
      setSwampSaggingRopePoint(start, rope, index / safeSegmentCount);
      setSwampSaggingRopePoint(end, rope, (index + 1) / safeSegmentCount);
      direction.subVectors(end, start);
      const length = Math.max(0.01, direction.length());
      midpoint.addVectors(start, end).multiplyScalar(0.5);
      segments.push({
        key: `${rope.key}-segment-${index}`,
        position: [midpoint.x, midpoint.y, midpoint.z],
        quaternion: new THREE.Quaternion().setFromUnitVectors(SWAMP_ROPE_SEGMENT_UP, direction.normalize()),
        length,
      });
    }
  }

  return segments;
}

export function getSwampVillageRopeLightBulbs(ropes: readonly SwampVillageRope[]) {
  const bulbs: SwampVillageRopeLightBulb[] = [];
  for (let ropeIndex = 0; ropeIndex < ropes.length; ropeIndex += 1) {
    const rope = ropes[ropeIndex];
    const lightColor = SWAMP_ROPE_LIGHT_COLORS[Math.floor(rope.lightHue * SWAMP_ROPE_LIGHT_COLORS.length) % SWAMP_ROPE_LIGHT_COLORS.length];
    for (let index = 0; index < rope.lightCount; index += 1) {
      const t = (index + 1) / (rope.lightCount + 1);
      const invT = 1 - t;
      const pointX = rope.start[0] * invT + rope.end[0] * t;
      const pointY = rope.start[1] * invT + rope.end[1] * t - Math.sin(Math.PI * t) * rope.sag;
      const pointZ = rope.start[2] * invT + rope.end[2] * t;
      const cordLength = 1.25 + ((ropeIndex + index) % 3) * 0.32;
      bulbs.push({
        key: `${rope.key}-light-${index}`,
        position: [pointX, pointY - cordLength, pointZ],
        cordPosition: [pointX, pointY - cordLength / 2, pointZ],
        cordLength,
        color: lightColor,
        hasPointLight: ropeIndex < 3 && index === Math.floor(rope.lightCount / 2),
      });
    }
  }

  return bulbs;
}
