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

const DARREL_BRANCH_UP = new THREE.Vector3(0, 1, 0);
const DARREL_SIDE_SIGNS: readonly DarrelSideSign[] = [-1, 1];
const DARREL_BACKYARD_RIVER_STONE_X = [-170, -128, -88, -48, -8, 34, 78, 122, 166] as const;

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

export function getDarrelQuestGateNowMs() {
  return Date.now();
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
