import * as THREE from "three";

import { getDarrelPetalNoise } from "../../rendering/textures/textureNoise";

export type DarrelBranchTransform = {
  length: number;
  midpoint: THREE.Vector3;
  quaternion: THREE.Quaternion;
};

export type DarrelHillStairRamp = {
  angle: number;
  centerY: number;
  centerZ: number;
  halfThickness: number;
  length: number;
};

export type DarrelHillStep = {
  y: number;
  z: number;
  width: number;
  depth: number;
};

export type DarrelSideSign = -1 | 1;

export type DarrelSideStairRamp = {
  side: DarrelSideSign;
  position: [number, number, number];
  rotation: [number, number, number];
};

export type DarrelSideStairStep = {
  side: DarrelSideSign;
  index: number;
  x: number;
  stepHeight: number;
};

export type DarrelSideStairLayout = {
  stepWidth: number;
  rampAngle: number;
  rampCenterY: number;
  rampHalfThickness: number;
  rampLength: number;
  ramps: DarrelSideStairRamp[];
  steps: DarrelSideStairStep[];
};

export type DarrelBackyardRiverSegment = {
  x: number;
  z: number;
  width: number;
  depth: number;
  rotation: number;
};

export type DarrelBackyardRiverStone = {
  x: number;
  z: number;
  rotation: number;
  width: number;
  height: number;
  depth: number;
};

export type DarrelWaterfallStone = {
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  depth: number;
  yaw: number;
};

export type DarrelWaterfallMossPad = {
  x: number;
  y: number;
  z: number;
  width: number;
  depth: number;
  yaw: number;
};

export type DarrelWaterfallWaterPatch = {
  x: number;
  z: number;
  width: number;
  depth: number;
  yaw: number;
};

export type DarrelWaterfallSprayPuff = {
  x: number;
  y: number;
  z: number;
  scale: number;
};

export type DarrelWaterfallRunnel = {
  x: number;
  z: number;
  width: number;
  depth: number;
  yaw: number;
};

export type DarrelPetalDriftPatch = {
  x: number;
  z: number;
  width: number;
  depth: number;
  yaw: number;
};

export type DarrelFallenPetal = {
  x: number;
  z: number;
  y: number;
  yaw: number;
  sx: number;
  sz: number;
};

export type DarrelFallingPetal = {
  x: number;
  z: number;
  phase: number;
  speed: number;
  sway: number;
  drift: number;
  scale: number;
  spin: number;
};

export type DarrelBlossomSprite = {
  key: number;
  x: number;
  y: number;
  z: number;
  scale: number;
};

export type DarrelTreeBranchDescriptor = {
  start: [number, number, number];
  end: [number, number, number];
  radius: number;
};

export type DarrelCanopyPadDescriptor = {
  position: [number, number, number];
  scale: [number, number, number];
  rotation: number;
};

export type DarrelBlossomClusterDescriptor = {
  position: [number, number, number];
  size: number;
  count: number;
};

export type DarrelGroveDetailVisibility = {
  showWaterAndGate: boolean;
  showTrees: boolean;
  showFinishingDetails: boolean;
};

const DARREL_BRANCH_UP = new THREE.Vector3(0, 1, 0);
const DARREL_SIDE_SIGNS: readonly DarrelSideSign[] = [-1, 1];
const DARREL_BACKYARD_RIVER_STONE_X = [-170, -128, -88, -48, -8, 34, 78, 122, 166] as const;
const darrelBlossomSpriteCache = new Map<string, readonly DarrelBlossomSprite[]>();

export const DARREL_GROVE_DETAIL_PHASE_DELAYS_MS = {
  waterAndGate: 120,
  trees: 360,
  finishingDetails: 760,
} as const;

export function getDarrelGroveDetailVisibility(showDetails: boolean, phase: number): DarrelGroveDetailVisibility {
  return {
    showWaterAndGate: !showDetails || phase >= 1,
    showTrees: !showDetails || phase >= 2,
    showFinishingDetails: showDetails && phase >= 3,
  };
}

export const DARREL_BACKYARD_RIVER_SEGMENTS: readonly DarrelBackyardRiverSegment[] = [
  { x: -110, z: 104, width: 112, depth: 34, rotation: -0.18 },
  { x: -12, z: 116, width: 118, depth: 38, rotation: 0.08 },
  { x: 96, z: 106, width: 124, depth: 34, rotation: 0.22 },
];

export const DARREL_BACKYARD_RIVER_STONES: readonly DarrelBackyardRiverStone[] = DARREL_BACKYARD_RIVER_STONE_X.map((x, index) => ({
  x,
  z: 135 + Math.sin(index) * 10,
  rotation: index * 0.7,
  width: 12 + (index % 3) * 3,
  height: 1.2,
  depth: 7 + (index % 2) * 4,
}));

export const DARREL_WATERFALL_HILL_STONES: readonly DarrelWaterfallStone[] = [
  { x: -62, y: 3.2, z: 28, width: 18, height: 5, depth: 12, yaw: -0.3 },
  { x: -42, y: 7.4, z: -24, width: 14, height: 7, depth: 11, yaw: 0.48 },
  { x: -24, y: 1.9, z: 62, width: 12, height: 3.8, depth: 9, yaw: 0.16 },
  { x: 28, y: 6.8, z: 18, width: 18, height: 7, depth: 12, yaw: -0.16 },
  { x: 52, y: 3.1, z: 41, width: 15, height: 4.8, depth: 10, yaw: 0.33 },
  { x: 40, y: 10.5, z: -20, width: 15, height: 7.2, depth: 10, yaw: -0.54 },
];

export const DARREL_WATERFALL_MOSS_PADS: readonly DarrelWaterfallMossPad[] = [
  { x: -34, y: 24.35, z: -16, width: 26, depth: 10, yaw: -0.18 },
  { x: 22, y: 23.9, z: -10, width: 24, depth: 9, yaw: 0.2 },
  { x: -50, y: 14.9, z: 10, width: 28, depth: 8, yaw: 0.52 },
  { x: 48, y: 14.7, z: 7, width: 25, depth: 8, yaw: -0.44 },
];

export const DARREL_WATERFALL_RIVER_FEED_CHANNELS: readonly DarrelWaterfallWaterPatch[] = [
  { x: -30, z: 184, width: 37, depth: 20, yaw: -0.26 },
  { x: -48, z: 210, width: 44, depth: 22, yaw: -0.1 },
  { x: -63, z: 238, width: 54, depth: 24, yaw: 0.08 },
  { x: 30, z: 184, width: 37, depth: 20, yaw: 0.26 },
  { x: 48, z: 210, width: 44, depth: 22, yaw: 0.1 },
  { x: 63, z: 238, width: 54, depth: 24, yaw: -0.08 },
];

export const DARREL_WATERFALL_RIVER_MOUTHS: readonly DarrelWaterfallWaterPatch[] = [
  { x: -78, z: 251, width: 44, depth: 17, yaw: -0.14 },
  { x: 78, z: 251, width: 44, depth: 17, yaw: 0.14 },
];

export const DARREL_WATERFALL_SPRAY_PUFFS: readonly DarrelWaterfallSprayPuff[] = [
  { x: -12, y: 5.8, z: 92, scale: 3.8 },
  { x: 10, y: 6.6, z: 94, scale: 4.2 },
  { x: -4, y: 8.2, z: 87, scale: 3.2 },
  { x: 18, y: 4.7, z: 89, scale: 3.5 },
  { x: -20, y: 4.9, z: 89, scale: 3.4 },
];

export const DARREL_WATERFALL_RUNNELS: readonly DarrelWaterfallRunnel[] = [
  { x: Math.sin(0) * 7, z: 128, width: 24, depth: 18, yaw: 0.12 },
  { x: Math.sin(1) * 7, z: 148, width: 21, depth: 18, yaw: -0.16 },
  { x: Math.sin(2) * 7, z: 166, width: 18, depth: 18, yaw: 0.12 },
];

export const DARREL_PETAL_DRIFT_PATCHES: readonly DarrelPetalDriftPatch[] = [
  { x: -154, z: -158, width: 136, depth: 76, yaw: -0.18 },
  { x: 154, z: -156, width: 138, depth: 78, yaw: 0.14 },
  { x: -158, z: 154, width: 142, depth: 80, yaw: 0.26 },
  { x: 158, z: 154, width: 138, depth: 78, yaw: -0.2 },
  { x: 0, z: -186, width: 174, depth: 50, yaw: 0.05 },
  { x: 0, z: 186, width: 180, depth: 52, yaw: -0.08 },
  { x: -190, z: 0, width: 58, depth: 168, yaw: 0.08 },
  { x: 190, z: 0, width: 60, depth: 168, yaw: -0.1 },
];

export const DARREL_BONSAI_BRANCHES: readonly DarrelTreeBranchDescriptor[] = [
  { start: [0, 0, 0], end: [5, 8, -6], radius: 5.2 },
  { start: [5, 8, -6], end: [2, 17, -18], radius: 4.5 },
  { start: [2, 17, -18], end: [-4, 26, -33], radius: 3.7 },
  { start: [-4, 26, -33], end: [1, 34, -52], radius: 2.9 },
  { start: [1, 34, -52], end: [0, 40, -78], radius: 2.25 },
  { start: [-1, 29, -40], end: [-24, 34, -55], radius: 1.9 },
  { start: [2, 30, -42], end: [26, 34, -58], radius: 1.85 },
  { start: [0, 36, -62], end: [-36, 39, -82], radius: 1.45 },
  { start: [0, 36, -62], end: [36, 39, -84], radius: 1.45 },
  { start: [0, 39, -76], end: [-28, 41, -102], radius: 1.15 },
  { start: [0, 39, -76], end: [28, 41, -102], radius: 1.15 },
  { start: [0, 40, -78], end: [0, 41, -116], radius: 1.1 },
  { start: [2, 18, -20], end: [18, 22, -34], radius: 1.7 },
  { start: [-2, 20, -22], end: [-20, 25, -36], radius: 1.65 },
];

export const DARREL_BONSAI_CANOPY_PADS: readonly DarrelCanopyPadDescriptor[] = [
  { position: [-23, 39, -78], scale: [27, 6.5, 18], rotation: -0.16 },
  { position: [22, 39.5, -80], scale: [29, 6.2, 19], rotation: 0.14 },
  { position: [0, 41.5, -94], scale: [36, 7.2, 22], rotation: 0 },
  { position: [-18, 43, -108], scale: [26, 5.5, 16], rotation: 0.22 },
  { position: [18, 43, -110], scale: [26, 5.5, 16], rotation: -0.22 },
  { position: [0, 40, -126], scale: [28, 4.8, 15], rotation: 0 },
  { position: [-37, 36.5, -62], scale: [19, 4.7, 13], rotation: -0.32 },
  { position: [37, 36.5, -64], scale: [19, 4.7, 13], rotation: 0.32 },
];

export const DARREL_BONSAI_BLOSSOM_CLUSTERS: readonly DarrelBlossomClusterDescriptor[] = [
  { position: [-24, 43, -78], size: 9.6, count: 11 },
  { position: [22, 43, -80], size: 9.8, count: 9 },
  { position: [0, 46, -94], size: 11.4, count: 11 },
  { position: [-18, 47, -108], size: 9.2, count: 9 },
  { position: [18, 47, -110], size: 9.2, count: 11 },
  { position: [0, 44, -126], size: 10.6, count: 9 },
  { position: [-37, 40, -62], size: 8.2, count: 11 },
  { position: [37, 40, -64], size: 8.2, count: 9 },
  { position: [-12, 37, -42], size: 7.4, count: 11 },
  { position: [14, 38, -46], size: 7.4, count: 9 },
];

export const DARREL_LEGACY_BONSAI_BRANCHES: readonly DarrelTreeBranchDescriptor[] = [
  { start: [0, 0, 0], end: [2, 18, -1], radius: 4.8 },
  { start: [2, 16, -1], end: [-7, 34, 4], radius: 3.8 },
  { start: [-5, 31, 3], end: [-22, 43, -4], radius: 2.6 },
  { start: [-8, 34, 4], end: [-14, 54, 10], radius: 2.2 },
  { start: [2, 18, -1], end: [13, 34, -8], radius: 3.2 },
  { start: [12, 33, -8], end: [32, 43, -18], radius: 2.4 },
  { start: [14, 34, -8], end: [18, 56, -5], radius: 2.1 },
  { start: [0, 10, 0], end: [-18, 22, -15], radius: 2.7 },
  { start: [-17, 21, -14], end: [-32, 28, -26], radius: 1.7 },
  { start: [1, 24, -1], end: [4, 47, 12], radius: 2.9 },
  { start: [4, 45, 12], end: [18, 62, 18], radius: 1.8 },
  { start: [2, 42, 0], end: [44, 70, 26], radius: 2.1 },
  { start: [-2, 45, 0], end: [-44, 72, -18], radius: 2 },
  { start: [0, 48, 0], end: [0, 82, 48], radius: 1.8 },
  { start: [0, 50, 0], end: [38, 78, -38], radius: 1.6 },
];

export const DARREL_LEGACY_BONSAI_BLOSSOM_CLUSTERS: readonly DarrelBlossomClusterDescriptor[] = [
  { position: [-23, 43, -4], size: 10.2, count: 11 },
  { position: [-14, 55, 10], size: 9, count: 9 },
  { position: [32, 43, -18], size: 10, count: 11 },
  { position: [18, 56, -5], size: 8.8, count: 9 },
  { position: [-32, 28, -26], size: 8.4, count: 11 },
  { position: [18, 62, 18], size: 9.2, count: 9 },
  { position: [-7, 34, 4], size: 8, count: 11 },
  { position: [12, 33, -8], size: 7.8, count: 9 },
  { position: [44, 70, 26], size: 13.4, count: 11 },
  { position: [-44, 72, -18], size: 13, count: 9 },
  { position: [0, 82, 48], size: 12.6, count: 11 },
  { position: [38, 78, -38], size: 12.2, count: 9 },
];

export function getDarrelQuestGateNowMs() {
  return Date.now();
}

export function getDarrelBlossomSprites(size: number, count: number) {
  const safeSize = Number.isFinite(size) ? size : 5;
  const safeCount = Math.max(0, Math.floor(count));
  const cacheKey = `${safeSize}:${safeCount}`;
  const cached = darrelBlossomSpriteCache.get(cacheKey);
  if (cached) return cached;

  const generated: DarrelBlossomSprite[] = [];
  for (let index = 0; index < safeCount; index += 1) {
    const angle = index * 2.399;
    generated.push({
      key: index,
      x: Math.cos(angle) * (1.2 + (index % 3) * 0.8),
      y: ((index % 4) - 1.5) * 1.15,
      z: Math.sin(angle) * (1.2 + (index % 2) * 0.7),
      scale: safeSize * (0.72 + (index % 3) * 0.13),
    });
  }
  darrelBlossomSpriteCache.set(cacheKey, generated);
  return generated;
}

export function getDarrelBranchTransform(
  start: [number, number, number],
  end: [number, number, number],
): DarrelBranchTransform {
  const startVec = new THREE.Vector3(...start);
  const endVec = new THREE.Vector3(...end);
  const direction = new THREE.Vector3().subVectors(endVec, startVec);
  const length = direction.length();
  const midpoint = new THREE.Vector3().addVectors(startVec, endVec).multiplyScalar(0.5);
  const normalizedDirection = length > 0.0001 ? direction.clone().normalize() : DARREL_BRANCH_UP;
  const quaternion = new THREE.Quaternion().setFromUnitVectors(DARREL_BRANCH_UP, normalizedDirection);
  return { length, midpoint, quaternion };
}

export function getDarrelHillStairRamp(
  startZ: number,
  endZ: number,
  startSurfaceY: number,
  endSurfaceY: number,
  halfThickness: number,
): DarrelHillStairRamp {
  const run = endZ - startZ;
  const rise = endSurfaceY - startSurfaceY;
  const angle = -Math.atan2(rise, run);
  return {
    angle,
    centerY: (startSurfaceY + endSurfaceY) / 2 - Math.cos(angle) * halfThickness,
    centerZ: (startZ + endZ) / 2,
    halfThickness,
    length: Math.sqrt(run * run + rise * rise),
  };
}

export function getDarrelHillSteps(entrySurfaceOffset: number, stepCount: number) {
  const safeStepCount = Math.max(1, Math.floor(stepCount));
  const steps = new Array<DarrelHillStep>(safeStepCount);
  for (let index = 0; index < safeStepCount; index += 1) {
    const progress = (index + 1) / safeStepCount;
    steps[index] = {
      y: entrySurfaceOffset * progress,
      z: -116 + index * 4.8,
      width: 34 - Math.min(index, 6) * 1.2,
      depth: 9,
    };
  }
  return steps;
}

export function getDarrelSideStairLayout({
  porchHalfWidth,
  porchTopY,
  porchZ,
  sideStairRun,
  sideStairCount,
  rampHalfThickness = 0.36,
}: {
  porchHalfWidth: number;
  porchTopY: number;
  porchZ: number;
  sideStairRun: number;
  sideStairCount: number;
  rampHalfThickness?: number;
}): DarrelSideStairLayout {
  const safeStairCount = Math.max(1, Math.floor(sideStairCount));
  const stepWidth = sideStairRun / safeStairCount;
  const rampAngle = Math.atan2(porchTopY, sideStairRun);
  const rampCenterY = porchTopY / 2 - Math.cos(rampAngle) * rampHalfThickness;
  const rampLength = Math.sqrt(sideStairRun * sideStairRun + porchTopY * porchTopY);
  const ramps = DARREL_SIDE_SIGNS.map((side) => ({
    side,
    position: [side * (porchHalfWidth + sideStairRun / 2 - 0.35), rampCenterY, porchZ] as [number, number, number],
    rotation: [0, 0, -side * rampAngle] as [number, number, number],
  }));
  const steps: DarrelSideStairStep[] = [];
  for (let sideIndex = 0; sideIndex < DARREL_SIDE_SIGNS.length; sideIndex += 1) {
    const side = DARREL_SIDE_SIGNS[sideIndex];
    for (let index = 0; index < safeStairCount; index += 1) {
      const stepHeight = porchTopY * ((index + 1) / safeStairCount);
      const innerOffset = index * stepWidth + stepWidth / 2;
      steps.push({
        side,
        index,
        x: side * (porchHalfWidth + sideStairRun - innerOffset),
        stepHeight,
      });
    }
  }
  return {
    stepWidth,
    rampAngle,
    rampCenterY,
    rampHalfThickness,
    rampLength,
    ramps,
    steps,
  };
}

export function isInsideDarrelHutFootprint(x: number, z: number) {
  return Math.abs(x) < 48 && Math.abs(z) < 40;
}

export function getDarrelFallenPetals(targetCount: number, groundY: number) {
  const safeTargetCount = Math.max(0, Math.floor(targetCount));
  const generated: DarrelFallenPetal[] = [];
  for (let index = 0; index < safeTargetCount; index += 1) {
    const x = -242 + getDarrelPetalNoise(index, 1) * 484;
    const z = -242 + getDarrelPetalNoise(index, 2) * 484;
    if (isInsideDarrelHutFootprint(x, z)) continue;

    const nearTree = Math.abs(x) > 118 || Math.abs(z) > 118;
    const scale = nearTree ? 3.15 : 2.25;
    generated.push({
      x,
      z,
      y: groundY + 0.16 + (index % 5) * 0.004,
      yaw: getDarrelPetalNoise(index, 3) * Math.PI * 2,
      sx: (4.4 + getDarrelPetalNoise(index, 4) * 7.8) * scale,
      sz: (2.3 + getDarrelPetalNoise(index, 5) * 4.2) * scale,
    });
  }
  return generated;
}

export function getDarrelFallingPetals(count: number) {
  const safeCount = Math.max(0, Math.floor(count));
  const generated: DarrelFallingPetal[] = [];
  for (let index = 0; index < safeCount; index += 1) {
    const nearCorner = getDarrelPetalNoise(index, 8) > 0.34;
    const side = Math.floor(getDarrelPetalNoise(index, 9) * 4);
    const cornerX = side === 0 || side === 3 ? -1 : 1;
    const cornerZ = side < 2 ? -1 : 1;
    const x = nearCorner
      ? cornerX * (110 + getDarrelPetalNoise(index, 1) * 115)
      : -165 + getDarrelPetalNoise(index, 1) * 330;
    const z = nearCorner
      ? cornerZ * (110 + getDarrelPetalNoise(index, 2) * 115)
      : -165 + getDarrelPetalNoise(index, 2) * 330;

    generated.push({
      x,
      z,
      phase: getDarrelPetalNoise(index, 3),
      speed: 0.045 + getDarrelPetalNoise(index, 4) * 0.05,
      sway: 4 + getDarrelPetalNoise(index, 5) * 8,
      drift: getDarrelPetalNoise(index, 6) * Math.PI * 2,
      scale: 7.2 + getDarrelPetalNoise(index, 7) * 8.8,
      spin: (getDarrelPetalNoise(index, 10) - 0.5) * 2.2,
    });
  }
  return generated;
}
