import {
  MOUNTAIN_VILLAGE_MINESHAFT_BOTTOM_BASE_OFFSET,
  MOUNTAIN_VILLAGE_MINESHAFT_EXIT_BRIDGE_Y_OFFSET,
  MOUNTAIN_VILLAGE_MINESHAFT_HUT_RADIUS,
  MOUNTAIN_VILLAGE_MINESHAFT_LADDER_EXIT_CLEARANCE,
  MOUNTAIN_VILLAGE_MINESHAFT_LADDER_RING_RADIUS,
  MOUNTAIN_VILLAGE_MINESHAFT_LADDER_START_CLEARANCE,
  MOUNTAIN_VILLAGE_MINESHAFT_LADDER_WIDTH,
} from "./mountainVillageTerrain";
import { survivalHash01 } from "../survival/survivalMath";
import type { SurvivalChunkInfo } from "../survival/survivalWorldConfig";

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

const MOUNTAIN_MINESHAFT_HUT_LEVEL_FRACTIONS_NEAR = [0.18, 0.48, 0.8] as const;
const MOUNTAIN_MINESHAFT_HUT_LEVEL_FRACTIONS_MID = [0.24, 0.68] as const;
const MOUNTAIN_MINESHAFT_HUT_BODY_COLORS = ["#514331", "#5d4b35", "#423b32", "#664f35"] as const;
const MOUNTAIN_MINESHAFT_HUT_ROOF_COLORS = ["#6f5131", "#805d39", "#5c4028", "#8a6a42"] as const;
const MOUNTAIN_MINESHAFT_HUT_ACCENT_COLORS = ["#86d9ff", "#f1cf82", "#c7eaff", "#d7b46c"] as const;

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
