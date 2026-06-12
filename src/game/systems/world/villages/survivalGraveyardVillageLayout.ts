import { survivalHash01 } from "../survival/survivalMath";
import type { SurvivalChunkInfo } from "../survival/survivalWorldConfig";
import {
  GRAVEYARD_FENCE_RADIUS,
  GRAVEYARD_RING_PATH_RADIUS,
  getGraveyardChapelMask,
  getGraveyardLocalRadiusSq,
} from "./survivalGraveyardVillageTerrain";

export type GraveyardTomb = {
  key: string;
  localX: number;
  localY: number;
  localZ: number;
  rotation: number;
  name: string;
  joke: string;
  variant: number;
};

export type GraveyardFenceSegment = {
  key: string;
  localX: number;
  localY: number;
  localZ: number;
  rotation: number;
  length: number;
};

export type GraveyardPathStone = {
  key: string;
  localX: number;
  localY: number;
  localZ: number;
  rotation: number;
  width: number;
  depth: number;
  color: string;
};

export type GraveyardLayout = {
  baseHeight: number;
  tombs: GraveyardTomb[];
  fenceSegments: GraveyardFenceSegment[];
  pathStones: GraveyardPathStone[];
};

export type GraveyardLayoutHeightResolver = (localX: number, localZ: number) => number;

const GRAVEYARD_FENCE_SEGMENT_COUNT = 48;
const GRAVEYARD_FENCE_GATE_HALF_WIDTH = 34;
const GRAVEYARD_TOMB_INNER_RADIUS = GRAVEYARD_FENCE_RADIUS - 34;
const GRAVEYARD_TOMB_INNER_RADIUS_SQ = GRAVEYARD_TOMB_INNER_RADIUS * GRAVEYARD_TOMB_INNER_RADIUS;
const GRAVEYARD_PATH_STONE_COLORS = ["#d7d8cf", "#bfc1ba", "#f0efe4", "#9b9f99", "#caccbf", "#747873"] as const;
const GRAVEYARD_CROSS_STONE_COUNT = 96;
const GRAVEYARD_RING_STONE_COUNT = 72;

const GRAVEYARD_TOMB_NAMES = [
  "BARRY D. ALIVE",
  "ANITA NAP",
  "WILL B. BACK",
  "RESTIN PEAS",
  "IZZY GONE",
  "DUSTY BONES",
  "MANNY TOMBS",
  "SUE VENEER",
  "AL B. QUIET",
  "GRANT D. WISH",
  "MAY B. LATER",
  "RUSTY GATE",
  "MIRA SHADOW",
  "NED A. MAP",
  "TARA FIRMA",
  "PHIL D. HOLE",
  "OLLIE NIGHT",
  "DORA BELL",
  "PERCY VEER",
  "LANA TORCH",
  "FAY D. BLACK",
  "HUGH MIST",
  "CLARA VELL",
  "ARTIE FACT",
  "GENE POOL",
  "MILES TOGO",
  "PAIGE TURNER",
  "NORA MOR",
  "VIC TORY",
  "ELLA VATOR",
  "LEN D. HAND",
  "RITA STONE",
  "CORA NER",
  "MAX TENSION",
  "IVY COVER",
  "WANDA RING",
  "BEN D. ROAD",
  "MOLLY CUE",
  "OTTO MATIC",
  "PEARL GATES",
  "ROSE MARY",
  "BLAIR WITCH",
  "CY RUS",
  "DINA MITE",
  "ED ITOR",
  "FELIX LUCK",
  "GAIL FORCE",
  "HAL LOWEEN",
  "IRA MOUND",
  "JUNE BUGG",
  "KIP NAPLEY",
  "LOU MINOUS",
  "MOE MENT",
  "NIA REST",
  "OPAL EYES",
  "PETE SAKES",
  "QUINN TESS",
  "RAY N. CLOUD",
  "SAGE ADVICE",
  "TESS TAMENT",
  "UNA ROUND",
  "VERN AL",
  "WADE IN",
  "XENA MARK",
  "YARA KNOT",
  "ZED MOR",
  "ABBY NORMAL",
  "BEA HIND",
  "CAL CULUS",
  "DREW BLOOD",
  "EMMA NENT",
  "FIN ISH",
  "GUS TAVO",
  "HANK ERIN",
  "ISLA CRYPT",
  "JAY WALKER",
  "KARA VANN",
  "LEO LANTERN",
  "MARA BELL",
  "NOEL ESCAPE",
  "OSCAR GROUCH",
  "PIP SQUEAK",
  "ROCCO WALL",
  "SAL T. EARTH",
] as const;

const GRAVEYARD_TOMB_JOKES = [
  "Forgot to quicksave.",
  "Still waiting on patch notes.",
  "Asked for one more quest.",
  "BRB became permanent.",
  "Looted a cursed sandwich.",
  "Trusted the tutorial chest.",
  "Said the boss looked easy.",
  "Missed the jump by one pixel.",
  "Paused for dramatic effect.",
  "Tried speedrunning stairs.",
  "Ignored the spooky sign.",
  "Found the floor trap.",
  "Took a nap in hard mode.",
  "Challenged gravity twice.",
  "Equipped the wrong shoes.",
  "Asked if it was haunted.",
] as const;

function makeGraveyardTombs(chunk: SurvivalChunkInfo, resolveHeight: GraveyardLayoutHeightResolver): GraveyardTomb[] {
  const tombs: GraveyardTomb[] = [];
  const xPositions = [-198, -150, -102, -54, 54, 102, 150, 198];
  const zRows = [-192, -150, -108, 108, 150, 192];
  const nameOffset = Math.floor(survivalHash01(chunk.cx, chunk.cz, 12210) * GRAVEYARD_TOMB_NAMES.length);

  for (let rowIndex = 0; rowIndex < zRows.length; rowIndex += 1) {
    const rowZ = zRows[rowIndex];
    for (let colIndex = 0; colIndex < xPositions.length; colIndex += 1) {
      const baseX = xPositions[colIndex];
      const localX = baseX + (survivalHash01(chunk.cx + rowIndex, chunk.cz + colIndex, 12220) - 0.5) * 8;
      const localZ = rowZ + (survivalHash01(chunk.cx - rowIndex, chunk.cz + colIndex, 12230) - 0.5) * 6;
      if (getGraveyardLocalRadiusSq(localX, localZ) > GRAVEYARD_TOMB_INNER_RADIUS_SQ) continue;
      if (getGraveyardChapelMask(localX, localZ) > 0.08) continue;

      const index = tombs.length;
      if (index >= GRAVEYARD_TOMB_NAMES.length) break;

      const variant = survivalHash01(chunk.cx + index, chunk.cz - index, 12240);
      const name = GRAVEYARD_TOMB_NAMES[(nameOffset + index * 37) % GRAVEYARD_TOMB_NAMES.length];
      const joke = GRAVEYARD_TOMB_JOKES[Math.floor(survivalHash01(chunk.cx - index, chunk.cz + index, 12250) * GRAVEYARD_TOMB_JOKES.length) % GRAVEYARD_TOMB_JOKES.length];
      const facingCenter = localZ < 0 ? 0 : Math.PI;

      tombs.push({
        key: `${chunk.key}-grave-${index}`,
        localX,
        localY: resolveHeight(localX, localZ),
        localZ,
        rotation: facingCenter + (variant - 0.5) * 0.16,
        name,
        joke,
        variant,
      });
    }
    if (tombs.length >= GRAVEYARD_TOMB_NAMES.length) break;
  }

  return tombs;
}

function makeGraveyardFenceSegments(chunk: SurvivalChunkInfo, resolveHeight: GraveyardLayoutHeightResolver): GraveyardFenceSegment[] {
  const segmentLength = (Math.PI * 2 * GRAVEYARD_FENCE_RADIUS / GRAVEYARD_FENCE_SEGMENT_COUNT) * 1.03;
  const segments: GraveyardFenceSegment[] = [];

  for (let index = 0; index < GRAVEYARD_FENCE_SEGMENT_COUNT; index += 1) {
    const angle = (Math.PI * 2 * index) / GRAVEYARD_FENCE_SEGMENT_COUNT;
    const localX = Math.sin(angle) * GRAVEYARD_FENCE_RADIUS;
    const localZ = Math.cos(angle) * GRAVEYARD_FENCE_RADIUS;
    const northSouthGate = Math.abs(localX) < GRAVEYARD_FENCE_GATE_HALF_WIDTH && Math.abs(Math.cos(angle)) > 0.9;
    const eastWestGate = Math.abs(localZ) < GRAVEYARD_FENCE_GATE_HALF_WIDTH && Math.abs(Math.sin(angle)) > 0.9;
    if (northSouthGate || eastWestGate) continue;

    segments.push({
      key: `${chunk.key}-grave-fence-${index}`,
      localX,
      localY: resolveHeight(localX, localZ),
      localZ,
      rotation: angle,
      length: segmentLength,
    });
  }

  return segments;
}

function makeGraveyardPathStones(chunk: SurvivalChunkInfo, resolveHeight: GraveyardLayoutHeightResolver): GraveyardPathStone[] {
  const stones: GraveyardPathStone[] = [];

  for (let index = 0; index < GRAVEYARD_CROSS_STONE_COUNT + GRAVEYARD_RING_STONE_COUNT; index += 1) {
    const ring = index >= GRAVEYARD_CROSS_STONE_COUNT;
    const t = ring ? (index - GRAVEYARD_CROSS_STONE_COUNT) / GRAVEYARD_RING_STONE_COUNT : index / GRAVEYARD_CROSS_STONE_COUNT;
    const angle = t * Math.PI * 2 + survivalHash01(chunk.cx, chunk.cz, 12300 + index) * 0.12;
    const localX = ring
      ? Math.sin(angle) * (GRAVEYARD_RING_PATH_RADIUS + (survivalHash01(chunk.cx, chunk.cz, 12310 + index) - 0.5) * 15)
      : (index % 2 === 0 ? (t - 0.5) * 450 : (survivalHash01(chunk.cx, chunk.cz, 12320 + index) - 0.5) * 25);
    const localZ = ring
      ? Math.cos(angle) * (GRAVEYARD_RING_PATH_RADIUS + (survivalHash01(chunk.cx, chunk.cz, 12330 + index) - 0.5) * 15)
      : (index % 2 === 0 ? (survivalHash01(chunk.cx, chunk.cz, 12340 + index) - 0.5) * 25 : (t - 0.5) * 450);
    if (getGraveyardChapelMask(localX, localZ) > 0.12) continue;
    const chipScale = survivalHash01(chunk.cx, chunk.cz, 12380 + index);

    stones.push({
      key: `${chunk.key}-grave-path-stone-${index}`,
      localX,
      localY: resolveHeight(localX, localZ) + 0.1,
      localZ,
      rotation: ring ? angle : survivalHash01(chunk.cx, chunk.cz, 12350 + index) * Math.PI,
      width: 0.48 + chipScale * 1.42,
      depth: 0.34 + survivalHash01(chunk.cx, chunk.cz, 12370 + index) * 1.05,
      color: GRAVEYARD_PATH_STONE_COLORS[index % GRAVEYARD_PATH_STONE_COLORS.length],
    });
  }

  return stones;
}

export function makeGraveyardLayout(
  chunk: SurvivalChunkInfo,
  baseHeight: number,
  includePathStones: boolean,
  resolveHeight: GraveyardLayoutHeightResolver,
): GraveyardLayout {
  return {
    baseHeight,
    tombs: makeGraveyardTombs(chunk, resolveHeight),
    fenceSegments: makeGraveyardFenceSegments(chunk, resolveHeight),
    pathStones: includePathStones ? makeGraveyardPathStones(chunk, resolveHeight) : [],
  };
}
