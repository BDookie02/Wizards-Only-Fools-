import { Fragment, useEffect, useMemo, useRef } from "react";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import * as THREE from "three";
import { SURVIVAL_BLOCK_SIZE, type CharacterCustomization } from "../../../../store/gameStore";
import { AvatarBillboard, AvatarWorldFacingPlane, NPC_AVATAR_GROUND_LIFT, NPC_AVATAR_SCALE } from "../../../PixelAvatar";
import { getCachedIndexRange } from "../../rendering/indexRange";
import { configurePixelSpriteTexture } from "../../rendering/textures/pixelSpriteTexture";
import { makeSurvivalEdgeSkirtGeometry } from "../terrain/survivalTerrainGeometry";
import { getSurvivalTerrainDetailTexture } from "../terrain/survivalTerrainTextures";
import { shouldBuildSurvivalChunkColliders, shouldRenderSurvivalChunkSkirt } from "../survival/survivalChunks";
import { useGraveyardLoadStage } from "../survival/survivalLoadStage";
import { clamp01, lerpNumber, smoothstepRange, survivalHash01 } from "../survival/survivalMath";
import { SURVIVAL_NEAR_RADIUS, type SurvivalChunkInfo } from "../survival/survivalWorldConfig";
import { finalizeSurvivalInstancedMesh } from "../vegetation/survivalInstancing";
import { useSurvivalFeatureCount } from "../../../tools/qa/survivalFeatureCounters";

type SurvivalTerrainHeightForChunk = (chunk: SurvivalChunkInfo, localX: number, localZ: number) => number;
type SurvivalTerrainColorAtWorld = (worldX: number, worldZ: number, height: number) => THREE.Color;
type SurvivalVillageBaseHeightForChunk = (chunk: SurvivalChunkInfo) => number;

function getGraveyardRadius(localX: number, localZ: number) {
  return Math.sqrt(localX * localX + localZ * localZ);
}

function getGraveyardRadiusSq(localX: number, localZ: number) {
  return localX * localX + localZ * localZ;
}

export function getGraveyardLocalSurfaceHeight(
  localX: number,
  localZ: number,
  chunkCx: number,
  chunkCz: number,
  baseHeight: number,
) {
  const radius = getGraveyardRadius(localX, localZ);
  const gateEntryMask = getGraveyardGateEntryMask(localX, localZ);
  const gateClearingMask = getGraveyardGateClearingMask(localX, localZ);
  const hillA = Math.sin(localX * 0.035 + chunkCx * 1.7) * Math.cos(localZ * 0.028 - chunkCz * 1.3);
  const hillB = Math.sin((localX + localZ) * 0.023 + 2.4) * 0.58;
  const moundRing = Math.pow(smoothstepRange(42, GRAVEYARD_VILLAGE_RADIUS, radius) * (1 - smoothstepRange(GRAVEYARD_VILLAGE_RADIUS - 34, GRAVEYARD_VILLAGE_RADIUS, radius)), 0.9);
  const pathMask = getGraveyardEffectivePathMask(localX, localZ);
  const chapelMask = getGraveyardChapelMask(localX, localZ);
  const hills = (hillA * 4.6 + hillB * 2.8 + moundRing * 5.8) * (1 - pathMask * 0.78) * (1 - chapelMask * 0.98) * (1 - gateClearingMask);
  const gateFlattenMask = Math.max(gateEntryMask * 0.96, gateClearingMask * 0.9);
  return lerpNumber(baseHeight + hills - pathMask * 0.38, baseHeight - 0.46, gateFlattenMask);
}

type GraveyardTomb = {
  key: string;
  localX: number;
  localY: number;
  localZ: number;
  rotation: number;
  name: string;
  joke: string;
  variant: number;
};

type GraveyardFenceSegment = {
  key: string;
  localX: number;
  localY: number;
  localZ: number;
  rotation: number;
  length: number;
};

type GraveyardPathStone = {
  key: string;
  localX: number;
  localY: number;
  localZ: number;
  rotation: number;
  width: number;
  depth: number;
  color: string;
};

type GraveyardLayout = {
  baseHeight: number;
  tombs: GraveyardTomb[];
  fenceSegments: GraveyardFenceSegment[];
  pathStones: GraveyardPathStone[];
};

const GRAVEYARD_VILLAGE_RADIUS = 238;
const GRAVEYARD_PATH_WIDTH = 35;
const GRAVEYARD_RING_PATH_RADIUS = 88;
const GRAVEYARD_RING_PATH_WIDTH = 20;
export const GRAVEYARD_FENCE_RADIUS = 246;
const GRAVEYARD_FENCE_SEGMENT_COUNT = 48;
const GRAVEYARD_FENCE_GATE_HALF_WIDTH = 34;
const GRAVEYARD_TOMB_INNER_RADIUS = GRAVEYARD_FENCE_RADIUS - 34;
const GRAVEYARD_TOMB_INNER_RADIUS_SQ = GRAVEYARD_TOMB_INNER_RADIUS * GRAVEYARD_TOMB_INNER_RADIUS;
const CHAPEL_CENTER_HALF_WIDTH = 54;
const CHAPEL_CENTER_HALF_DEPTH = 82;
const CHAPEL_SIDE_WING_HALF_WIDTH = 34;
const CHAPEL_SIDE_WING_HALF_DEPTH = 57;
const CHAPEL_SIDE_WING_CENTER_X = CHAPEL_CENTER_HALF_WIDTH + CHAPEL_SIDE_WING_HALF_WIDTH;
const CHAPEL_OUTER_HALF_WIDTH = CHAPEL_SIDE_WING_CENTER_X + CHAPEL_SIDE_WING_HALF_WIDTH;
const CHAPEL_WALL_THICKNESS = 2.8;
const CHAPEL_WALL_HEIGHT = 34.8;
const CHAPEL_WALL_HALF_HEIGHT = CHAPEL_WALL_HEIGHT / 2;
const CHAPEL_SEATED_NPC_WALL_CLEARANCE = 13.5;
const CHAPEL_EXIT_HALF_WIDTH = 12;
const CHAPEL_SIDE_EXIT_HALF_WIDTH = 11;
const CHAPEL_REAR_EXIT_CENTER_X = 33;
const CHAPEL_REAR_EXIT_HALF_WIDTH = 8.5;
const CHAPEL_FOUNDATION_FEATHER = 10;
const GRAVEYARD_COLOR_GRASS_A = new THREE.Color("#26301f");
const GRAVEYARD_COLOR_GRASS_B = new THREE.Color("#38422b");
const GRAVEYARD_COLOR_GRASS_C = new THREE.Color("#1b2118");
const GRAVEYARD_COLOR_GRASS_SHADOW = new THREE.Color("#111511");
const GRAVEYARD_COLOR_GRAVEL_A = new THREE.Color("#b7b8b0");
const GRAVEYARD_COLOR_GRAVEL_B = new THREE.Color("#d9d9cf");
const GRAVEYARD_COLOR_GRAVEL_C = new THREE.Color("#8e928d");
const GRAVEYARD_COLOR_GRAVEL_EDGE = new THREE.Color("#5f625d");
const GRAVEYARD_COLOR_CHAPEL_STONE_LIGHT = new THREE.Color("#72746d");
const GRAVEYARD_COLOR_CHAPEL_STONE_DARK = new THREE.Color("#595b55");
const GRAVEYARD_COLOR_CHAPEL_CRACK = new THREE.Color("#2d302b");
const graveyardGroundGravelScratch = new THREE.Color();
const graveyardGroundChapelScratch = new THREE.Color();
const CHAPEL_STAIR_RAMP_LENGTH = 44;
const CHAPEL_STAIR_RAMP_THICKNESS = 0.82;
const CHAPEL_STAIR_RAMP_LOW_TOP = 0.02;
const CHAPEL_STAIR_RAMP_COLLIDER_LOW_TOP = -0.32;
const CHAPEL_STAIR_RAMP_CENTER_TOP = 1.18;
const CHAPEL_STAIR_RAMP_WING_TOP = 1.16;
const CHAPEL_WATCH_TOWER_HEIGHT = 42;
const CHAPEL_WATCH_TOWER_RADIUS = 8.8;
const CHAPEL_WATCH_TOWER_Y = 55;
const CHAPEL_WATCH_TOWER_POSITIONS: Array<[number, number, number]> = [
  [-CHAPEL_OUTER_HALF_WIDTH + 8, CHAPEL_WATCH_TOWER_Y, -CHAPEL_SIDE_WING_HALF_DEPTH + 8],
  [CHAPEL_OUTER_HALF_WIDTH - 8, CHAPEL_WATCH_TOWER_Y, -CHAPEL_SIDE_WING_HALF_DEPTH + 8],
  [-CHAPEL_OUTER_HALF_WIDTH + 8, CHAPEL_WATCH_TOWER_Y, CHAPEL_SIDE_WING_HALF_DEPTH - 8],
  [CHAPEL_OUTER_HALF_WIDTH - 8, CHAPEL_WATCH_TOWER_Y, CHAPEL_SIDE_WING_HALF_DEPTH - 8],
];
const CHAPEL_GARGOYLE_FOOT_DROP = 0.76;
const CHAPEL_GARGOYLE_LEDGE_OVERLAP = 0.9;
const CHAPEL_GARGOYLE_LEDGE_Y = CHAPEL_WALL_HEIGHT + 0.08;
const CHAPEL_WATCH_TOWER_CAP_TOP_Y = CHAPEL_WATCH_TOWER_Y + CHAPEL_WATCH_TOWER_HEIGHT * 0.5 + 3.3;
const getChapelGargoyleRestY = (supportY: number, scale = 1) => supportY + CHAPEL_GARGOYLE_FOOT_DROP * scale;
const CHAPEL_GARGOYLE_POSITIONS: Array<{ key: string; position: [number, number, number]; yaw: number; scale?: number }> = [
  { key: "north-left", position: [-32, getChapelGargoyleRestY(CHAPEL_GARGOYLE_LEDGE_Y), -(CHAPEL_CENTER_HALF_DEPTH + CHAPEL_GARGOYLE_LEDGE_OVERLAP)], yaw: Math.PI },
  { key: "north-right", position: [32, getChapelGargoyleRestY(CHAPEL_GARGOYLE_LEDGE_Y), -(CHAPEL_CENTER_HALF_DEPTH + CHAPEL_GARGOYLE_LEDGE_OVERLAP)], yaw: Math.PI },
  { key: "south-left", position: [-32, getChapelGargoyleRestY(CHAPEL_GARGOYLE_LEDGE_Y), CHAPEL_CENTER_HALF_DEPTH + CHAPEL_GARGOYLE_LEDGE_OVERLAP], yaw: 0 },
  { key: "south-right", position: [32, getChapelGargoyleRestY(CHAPEL_GARGOYLE_LEDGE_Y), CHAPEL_CENTER_HALF_DEPTH + CHAPEL_GARGOYLE_LEDGE_OVERLAP], yaw: 0 },
  { key: "west-north", position: [-(CHAPEL_OUTER_HALF_WIDTH + CHAPEL_GARGOYLE_LEDGE_OVERLAP), getChapelGargoyleRestY(CHAPEL_GARGOYLE_LEDGE_Y, 0.9), -36], yaw: -Math.PI / 2, scale: 0.9 },
  { key: "west-mid", position: [-(CHAPEL_OUTER_HALF_WIDTH + CHAPEL_GARGOYLE_LEDGE_OVERLAP), getChapelGargoyleRestY(CHAPEL_GARGOYLE_LEDGE_Y, 0.9), 0], yaw: -Math.PI / 2, scale: 0.9 },
  { key: "west-south", position: [-(CHAPEL_OUTER_HALF_WIDTH + CHAPEL_GARGOYLE_LEDGE_OVERLAP), getChapelGargoyleRestY(CHAPEL_GARGOYLE_LEDGE_Y, 0.9), 36], yaw: -Math.PI / 2, scale: 0.9 },
  { key: "east-north", position: [CHAPEL_OUTER_HALF_WIDTH + CHAPEL_GARGOYLE_LEDGE_OVERLAP, getChapelGargoyleRestY(CHAPEL_GARGOYLE_LEDGE_Y, 0.9), -36], yaw: Math.PI / 2, scale: 0.9 },
  { key: "east-mid", position: [CHAPEL_OUTER_HALF_WIDTH + CHAPEL_GARGOYLE_LEDGE_OVERLAP, getChapelGargoyleRestY(CHAPEL_GARGOYLE_LEDGE_Y, 0.9), 0], yaw: Math.PI / 2, scale: 0.9 },
  { key: "east-south", position: [CHAPEL_OUTER_HALF_WIDTH + CHAPEL_GARGOYLE_LEDGE_OVERLAP, getChapelGargoyleRestY(CHAPEL_GARGOYLE_LEDGE_Y, 0.9), 36], yaw: Math.PI / 2, scale: 0.9 },
  { key: "tower-nw", position: [-CHAPEL_OUTER_HALF_WIDTH + 8, getChapelGargoyleRestY(CHAPEL_WATCH_TOWER_CAP_TOP_Y, 0.78), -CHAPEL_SIDE_WING_HALF_DEPTH + 8], yaw: -Math.PI * 0.75, scale: 0.78 },
  { key: "tower-ne", position: [CHAPEL_OUTER_HALF_WIDTH - 8, getChapelGargoyleRestY(CHAPEL_WATCH_TOWER_CAP_TOP_Y, 0.78), -CHAPEL_SIDE_WING_HALF_DEPTH + 8], yaw: Math.PI * 0.75, scale: 0.78 },
  { key: "tower-sw", position: [-CHAPEL_OUTER_HALF_WIDTH + 8, getChapelGargoyleRestY(CHAPEL_WATCH_TOWER_CAP_TOP_Y, 0.78), CHAPEL_SIDE_WING_HALF_DEPTH - 8], yaw: -Math.PI * 0.25, scale: 0.78 },
  { key: "tower-se", position: [CHAPEL_OUTER_HALF_WIDTH - 8, getChapelGargoyleRestY(CHAPEL_WATCH_TOWER_CAP_TOP_Y, 0.78), CHAPEL_SIDE_WING_HALF_DEPTH - 8], yaw: Math.PI * 0.25, scale: 0.78 },
];
const CHAPEL_EXIT_RAMP_DEFINITIONS = [
  { key: "south", position: [0, 0, 0] as [number, number, number], rotation: 0, distance: CHAPEL_CENTER_HALF_DEPTH, width: 52, top: CHAPEL_STAIR_RAMP_CENTER_TOP, outset: -1 },
  { key: "north-west", position: [-CHAPEL_REAR_EXIT_CENTER_X, 0, 0] as [number, number, number], rotation: Math.PI, distance: CHAPEL_CENTER_HALF_DEPTH, width: 40, top: CHAPEL_STAIR_RAMP_CENTER_TOP, outset: -1 },
  { key: "north-east", position: [CHAPEL_REAR_EXIT_CENTER_X, 0, 0] as [number, number, number], rotation: Math.PI, distance: CHAPEL_CENTER_HALF_DEPTH, width: 40, top: CHAPEL_STAIR_RAMP_CENTER_TOP, outset: -1 },
  { key: "east", position: [0, 0, 0] as [number, number, number], rotation: Math.PI / 2, distance: CHAPEL_OUTER_HALF_WIDTH, width: 50, top: CHAPEL_STAIR_RAMP_WING_TOP, outset: -1 },
  { key: "west", position: [0, 0, 0] as [number, number, number], rotation: -Math.PI / 2, distance: CHAPEL_OUTER_HALF_WIDTH, width: 50, top: CHAPEL_STAIR_RAMP_WING_TOP, outset: -1 },
];
const GRAVEYARD_TOMB_TEXTURE_CHIP_RECTS: Array<[number, number, number, number]> = [
  [10, 14, 24, 8],
  [214, 14, 32, 10],
  [10, 118, 18, 20],
  [220, 124, 26, 14],
];
const CHAPEL_CHANDELIER_CANDLE_POSITIONS: Array<[number, number, number]> = [];
for (let index = 0; index < 8; index += 1) {
  const angle = (index / 8) * Math.PI * 2;
  CHAPEL_CHANDELIER_CANDLE_POSITIONS.push([Math.cos(angle) * 6.2, 0, Math.sin(angle) * 6.2]);
}

function makeChapelRampColliderGeometry(baseHeight: number) {
  const exitCount = CHAPEL_EXIT_RAMP_DEFINITIONS.length;
  const positions = new Float32Array(exitCount * 4 * 3);
  const indices = new Uint16Array(exitCount * 6);

  for (let exitIndex = 0; exitIndex < CHAPEL_EXIT_RAMP_DEFINITIONS.length; exitIndex += 1) {
    const exit = CHAPEL_EXIT_RAMP_DEFINITIONS[exitIndex];
    const baseIndex = exitIndex * 4;
    let positionOffset = baseIndex * 3;
    const halfWidth = exit.width / 2;
    const highZ = exit.distance + exit.outset;
    const lowZ = highZ + CHAPEL_STAIR_RAMP_LENGTH;
    const cos = Math.cos(exit.rotation);
    const sin = Math.sin(exit.rotation);
    const transformPoint = (x: number, y: number, z: number) => {
      positions[positionOffset] = exit.position[0] + x * cos + z * sin;
      positions[positionOffset + 1] = baseHeight + y;
      positions[positionOffset + 2] = exit.position[2] - x * sin + z * cos;
      positionOffset += 3;
    };

    transformPoint(-halfWidth, exit.top, highZ);
    transformPoint(-halfWidth, CHAPEL_STAIR_RAMP_COLLIDER_LOW_TOP, lowZ);
    transformPoint(halfWidth, exit.top, highZ);
    transformPoint(halfWidth, CHAPEL_STAIR_RAMP_COLLIDER_LOW_TOP, lowZ);
    const indexOffset = exitIndex * 6;
    indices[indexOffset] = baseIndex;
    indices[indexOffset + 1] = baseIndex + 1;
    indices[indexOffset + 2] = baseIndex + 2;
    indices[indexOffset + 3] = baseIndex + 2;
    indices[indexOffset + 4] = baseIndex + 1;
    indices[indexOffset + 5] = baseIndex + 3;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}
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

const graveyardTombTextureCache = new Map<string, THREE.Texture>();
const graveyardStoneTextureCache = new Map<string, THREE.Texture>();

type ChapelWallSegment = {
  key: string;
  position: [number, number, number];
  size: [number, number, number];
};

function getSoftRectMask(
  localX: number,
  localZ: number,
  centerX: number,
  centerZ: number,
  halfWidth: number,
  halfDepth: number,
  feather = CHAPEL_FOUNDATION_FEATHER,
) {
  return Math.min(
    1 - smoothstepRange(halfWidth, halfWidth + feather, Math.abs(localX - centerX)),
    1 - smoothstepRange(halfDepth, halfDepth + feather, Math.abs(localZ - centerZ)),
  );
}

function getGraveyardChapelFootprintMask(localX: number, localZ: number) {
  const centralHall = getSoftRectMask(localX, localZ, 0, 0, CHAPEL_CENTER_HALF_WIDTH, CHAPEL_CENTER_HALF_DEPTH);
  const westWing = getSoftRectMask(localX, localZ, -CHAPEL_SIDE_WING_CENTER_X, 0, CHAPEL_SIDE_WING_HALF_WIDTH, CHAPEL_SIDE_WING_HALF_DEPTH);
  const eastWing = getSoftRectMask(localX, localZ, CHAPEL_SIDE_WING_CENTER_X, 0, CHAPEL_SIDE_WING_HALF_WIDTH, CHAPEL_SIDE_WING_HALF_DEPTH);
  return Math.max(centralHall, westWing, eastWing);
}

function getChapelWallSegments(): ChapelWallSegment[] {
  const t = CHAPEL_WALL_THICKNESS;
  const h = CHAPEL_WALL_HEIGHT;
  const y = CHAPEL_WALL_HALF_HEIGHT;
  const frontDoorTop = 24.4;
  const sideDoorTop = 22.4;
  const frontLintelHeight = h - frontDoorTop;
  const sideLintelHeight = h - sideDoorTop;
  const frontLintelY = frontDoorTop + frontLintelHeight * 0.5;
  const sideLintelY = sideDoorTop + sideLintelHeight * 0.5;
  const frontDoorSideWidth = CHAPEL_CENTER_HALF_WIDTH - CHAPEL_EXIT_HALF_WIDTH;
  const frontDoorSideX = CHAPEL_EXIT_HALF_WIDTH + frontDoorSideWidth * 0.5;
  const rearOuterWallWidth = CHAPEL_CENTER_HALF_WIDTH - CHAPEL_REAR_EXIT_CENTER_X - CHAPEL_REAR_EXIT_HALF_WIDTH;
  const rearOuterWallX = CHAPEL_REAR_EXIT_CENTER_X + CHAPEL_REAR_EXIT_HALF_WIDTH + rearOuterWallWidth * 0.5;
  const rearCenterWallWidth = (CHAPEL_REAR_EXIT_CENTER_X - CHAPEL_REAR_EXIT_HALF_WIDTH) * 2;
  const centralSideDepth = CHAPEL_CENTER_HALF_DEPTH - CHAPEL_SIDE_WING_HALF_DEPTH;
  const centralSideZ = CHAPEL_SIDE_WING_HALF_DEPTH + centralSideDepth * 0.5;
  const wingDoorSideDepth = CHAPEL_SIDE_WING_HALF_DEPTH - CHAPEL_SIDE_EXIT_HALF_WIDTH;
  const wingDoorSideZ = CHAPEL_SIDE_EXIT_HALF_WIDTH + wingDoorSideDepth * 0.5;

  return [
    { key: "central-north-west-outer", position: [-rearOuterWallX, y, -CHAPEL_CENTER_HALF_DEPTH], size: [rearOuterWallWidth, h, t] },
    { key: "central-north-center", position: [0, y, -CHAPEL_CENTER_HALF_DEPTH], size: [rearCenterWallWidth, h, t] },
    { key: "central-north-east-outer", position: [rearOuterWallX, y, -CHAPEL_CENTER_HALF_DEPTH], size: [rearOuterWallWidth, h, t] },
    { key: "central-south-west", position: [-frontDoorSideX, y, CHAPEL_CENTER_HALF_DEPTH], size: [frontDoorSideWidth, h, t] },
    { key: "central-south-east", position: [frontDoorSideX, y, CHAPEL_CENTER_HALF_DEPTH], size: [frontDoorSideWidth, h, t] },
    { key: "central-south-door-lintel", position: [0, frontLintelY, CHAPEL_CENTER_HALF_DEPTH], size: [CHAPEL_EXIT_HALF_WIDTH * 2 + 4, frontLintelHeight, t] },
    { key: "central-north-west-door-lintel", position: [-CHAPEL_REAR_EXIT_CENTER_X, sideLintelY, -CHAPEL_CENTER_HALF_DEPTH], size: [CHAPEL_REAR_EXIT_HALF_WIDTH * 2 + 4, sideLintelHeight, t] },
    { key: "central-north-east-door-lintel", position: [CHAPEL_REAR_EXIT_CENTER_X, sideLintelY, -CHAPEL_CENTER_HALF_DEPTH], size: [CHAPEL_REAR_EXIT_HALF_WIDTH * 2 + 4, sideLintelHeight, t] },
    { key: "central-west-north", position: [-CHAPEL_CENTER_HALF_WIDTH, y, -centralSideZ], size: [t, h, centralSideDepth] },
    { key: "central-west-south", position: [-CHAPEL_CENTER_HALF_WIDTH, y, centralSideZ], size: [t, h, centralSideDepth] },
    { key: "central-east-north", position: [CHAPEL_CENTER_HALF_WIDTH, y, -centralSideZ], size: [t, h, centralSideDepth] },
    { key: "central-east-south", position: [CHAPEL_CENTER_HALF_WIDTH, y, centralSideZ], size: [t, h, centralSideDepth] },
    { key: "west-wing-north", position: [-CHAPEL_SIDE_WING_CENTER_X, y, -CHAPEL_SIDE_WING_HALF_DEPTH], size: [CHAPEL_SIDE_WING_HALF_WIDTH * 2, h, t] },
    { key: "west-wing-south", position: [-CHAPEL_SIDE_WING_CENTER_X, y, CHAPEL_SIDE_WING_HALF_DEPTH], size: [CHAPEL_SIDE_WING_HALF_WIDTH * 2, h, t] },
    { key: "east-wing-north", position: [CHAPEL_SIDE_WING_CENTER_X, y, -CHAPEL_SIDE_WING_HALF_DEPTH], size: [CHAPEL_SIDE_WING_HALF_WIDTH * 2, h, t] },
    { key: "east-wing-south", position: [CHAPEL_SIDE_WING_CENTER_X, y, CHAPEL_SIDE_WING_HALF_DEPTH], size: [CHAPEL_SIDE_WING_HALF_WIDTH * 2, h, t] },
    { key: "west-wing-side-north", position: [-CHAPEL_OUTER_HALF_WIDTH, y, -wingDoorSideZ], size: [t, h, wingDoorSideDepth] },
    { key: "west-wing-side-south", position: [-CHAPEL_OUTER_HALF_WIDTH, y, wingDoorSideZ], size: [t, h, wingDoorSideDepth] },
    { key: "east-wing-side-north", position: [CHAPEL_OUTER_HALF_WIDTH, y, -wingDoorSideZ], size: [t, h, wingDoorSideDepth] },
    { key: "east-wing-side-south", position: [CHAPEL_OUTER_HALF_WIDTH, y, wingDoorSideZ], size: [t, h, wingDoorSideDepth] },
    { key: "west-wing-side-door-lintel", position: [-CHAPEL_OUTER_HALF_WIDTH, sideLintelY, 0], size: [t, sideLintelHeight, CHAPEL_SIDE_EXIT_HALF_WIDTH * 2 + 5] },
    { key: "east-wing-side-door-lintel", position: [CHAPEL_OUTER_HALF_WIDTH, sideLintelY, 0], size: [t, sideLintelHeight, CHAPEL_SIDE_EXIT_HALF_WIDTH * 2 + 5] },
  ];
}

function getGraveyardPathMask(localX: number, localZ: number) {
  const absX = Math.abs(localX);
  const absZ = Math.abs(localZ);
  const radius = getGraveyardRadius(localX, localZ);
  const crossPath = Math.max(
    1 - smoothstepRange(GRAVEYARD_PATH_WIDTH * 0.5, GRAVEYARD_PATH_WIDTH * 0.78, absX),
    1 - smoothstepRange(GRAVEYARD_PATH_WIDTH * 0.5, GRAVEYARD_PATH_WIDTH * 0.78, absZ),
  );
  const ringPath = 1 - smoothstepRange(GRAVEYARD_RING_PATH_WIDTH * 0.42, GRAVEYARD_RING_PATH_WIDTH * 0.78, Math.abs(radius - GRAVEYARD_RING_PATH_RADIUS));
  return Math.max(crossPath, ringPath, getGraveyardChapelWalkMask(localX, localZ), getGraveyardGateEntryMask(localX, localZ) * 0.92);
}

function getGraveyardGateEntryMask(localX: number, localZ: number) {
  const absX = Math.abs(localX);
  const absZ = Math.abs(localZ);
  const northSouthGate =
    (1 - smoothstepRange(82, 154, absX)) *
    smoothstepRange(88, 146, absZ) *
    (1 - smoothstepRange(GRAVEYARD_FENCE_RADIUS + 28, GRAVEYARD_FENCE_RADIUS + 184, absZ));
  const eastWestGate =
    (1 - smoothstepRange(82, 154, absZ)) *
    smoothstepRange(88, 146, absX) *
    (1 - smoothstepRange(GRAVEYARD_FENCE_RADIUS + 28, GRAVEYARD_FENCE_RADIUS + 184, absX));
  return clamp01(Math.max(northSouthGate, eastWestGate));
}

export function getGraveyardGateClearingMask(localX: number, localZ: number) {
  const absX = Math.abs(localX);
  const absZ = Math.abs(localZ);
  const northSouthShoulder =
    (1 - smoothstepRange(214, 306, absX)) *
    smoothstepRange(48, 104, absZ) *
    (1 - smoothstepRange(GRAVEYARD_FENCE_RADIUS + 116, GRAVEYARD_FENCE_RADIUS + 270, absZ));
  const eastWestShoulder =
    (1 - smoothstepRange(214, 306, absZ)) *
    smoothstepRange(48, 104, absX) *
    (1 - smoothstepRange(GRAVEYARD_FENCE_RADIUS + 116, GRAVEYARD_FENCE_RADIUS + 270, absX));
  return clamp01(Math.max(getGraveyardGateEntryMask(localX, localZ), northSouthShoulder, eastWestShoulder));
}

function getGraveyardChapelFoundationMask(localX: number, localZ: number) {
  return getGraveyardChapelFootprintMask(localX, localZ);
}

function getGraveyardChapelWalkMask(localX: number, localZ: number) {
  const absX = Math.abs(localX);
  const absZ = Math.abs(localZ);
  const southExit = (
    1 - smoothstepRange(28, 44, absX)
  ) * smoothstepRange(CHAPEL_CENTER_HALF_DEPTH - 18, CHAPEL_CENTER_HALF_DEPTH - 2, localZ) * (
    1 - smoothstepRange(132, 162, localZ)
  );
  const rearSideExitX = Math.max(
    1 - smoothstepRange(CHAPEL_REAR_EXIT_HALF_WIDTH + 5, CHAPEL_REAR_EXIT_HALF_WIDTH + 19, Math.abs(localX - CHAPEL_REAR_EXIT_CENTER_X)),
    1 - smoothstepRange(CHAPEL_REAR_EXIT_HALF_WIDTH + 5, CHAPEL_REAR_EXIT_HALF_WIDTH + 19, Math.abs(localX + CHAPEL_REAR_EXIT_CENTER_X)),
  );
  const northSideExits = rearSideExitX * smoothstepRange(
    CHAPEL_CENTER_HALF_DEPTH - 18,
    CHAPEL_CENTER_HALF_DEPTH - 2,
    -localZ,
  ) * (
    1 - smoothstepRange(132, 162, -localZ)
  );
  const eastWestExits = (
    1 - smoothstepRange(28, 44, absZ)
  ) * smoothstepRange(CHAPEL_OUTER_HALF_WIDTH - 18, CHAPEL_OUTER_HALF_WIDTH - 2, absX) * (
    1 - smoothstepRange(174, 206, absX)
  );
  return Math.max(southExit, northSideExits, eastWestExits);
}

export function getGraveyardChapelMask(localX: number, localZ: number) {
  return Math.max(getGraveyardChapelFoundationMask(localX, localZ), getGraveyardChapelWalkMask(localX, localZ));
}

export function getGraveyardEffectivePathMask(localX: number, localZ: number) {
  const pathMask = getGraveyardPathMask(localX, localZ);
  const chapelFoundationMask = getGraveyardChapelFoundationMask(localX, localZ);
  return pathMask * (1 - chapelFoundationMask * 0.98);
}

function getGraveyardVillageHeight(
  chunk: SurvivalChunkInfo,
  localX: number,
  localZ: number,
  terrainHeightForChunk: SurvivalTerrainHeightForChunk,
  baseHeight: number,
) {
  const naturalHeight = terrainHeightForChunk(chunk, localX, localZ);
  const gateClearingMask = getGraveyardGateClearingMask(localX, localZ);
  const radius = getGraveyardRadius(localX, localZ);
  const edgeBlend = smoothstepRange(GRAVEYARD_FENCE_RADIUS - 42, SURVIVAL_BLOCK_SIZE / 2, radius) * (1 - gateClearingMask * 0.95);
  const graveyardHeight = getGraveyardLocalSurfaceHeight(localX, localZ, chunk.cx, chunk.cz, baseHeight);
  return lerpNumber(graveyardHeight, naturalHeight, edgeBlend);
}

function getGraveyardGroundColorInto(
  target: THREE.Color,
  chunk: SurvivalChunkInfo,
  localX: number,
  localZ: number,
  height: number,
  baseHeight: number,
  terrainColorAtWorld: SurvivalTerrainColorAtWorld,
) {
  const pathMask = getGraveyardEffectivePathMask(localX, localZ);
  const chapelFoundationMask = getGraveyardChapelFoundationMask(localX, localZ);
  const noise = survivalHash01(Math.floor(localX * 0.21), Math.floor(localZ * 0.21), 12050);
  const gravelNoise = survivalHash01(Math.floor(localX * 0.52), Math.floor(localZ * 0.52), 12062);
  const gravelSpeckle = survivalHash01(Math.floor(localX * 1.25), Math.floor(localZ * 1.25), 12073);
  const chapelStoneNoise = survivalHash01(Math.floor(localX * 0.88), Math.floor(localZ * 0.88), 12084);
  const chapelCrackNoise = survivalHash01(Math.floor(localX * 1.72), Math.floor(localZ * 1.72), 12091);
  const pathEdgeMask = smoothstepRange(0.18, 0.48, pathMask) * (1 - smoothstepRange(0.66, 0.9, pathMask));
  const slopeTint = clamp01((height - baseHeight + 3) / 12);
  target
    .copy(GRAVEYARD_COLOR_GRASS_A)
    .lerp(noise > 0.62 ? GRAVEYARD_COLOR_GRASS_B : GRAVEYARD_COLOR_GRASS_C, noise > 0.62 ? 0.5 : 0.34)
    .lerp(GRAVEYARD_COLOR_GRASS_SHADOW, slopeTint * 0.22);
  const gravel = graveyardGroundGravelScratch
    .copy(GRAVEYARD_COLOR_GRAVEL_A)
    .lerp(GRAVEYARD_COLOR_GRAVEL_B, gravelNoise * 0.62)
    .lerp(GRAVEYARD_COLOR_GRAVEL_C, gravelSpeckle > 0.72 ? 0.34 : 0.08)
    .lerp(GRAVEYARD_COLOR_GRAVEL_EDGE, pathEdgeMask * 0.42);
  const chapelGravel = graveyardGroundChapelScratch
    .copy(gravel)
    .lerp(chapelStoneNoise > 0.58 ? GRAVEYARD_COLOR_CHAPEL_STONE_LIGHT : GRAVEYARD_COLOR_CHAPEL_STONE_DARK, 0.42)
    .lerp(GRAVEYARD_COLOR_CHAPEL_CRACK, chapelCrackNoise > 0.76 ? 0.32 : 0.06);
  target.lerp(gravel, clamp01(pathMask * 0.92)).lerp(chapelGravel, chapelFoundationMask * 0.48);
  const worldX = chunk.x + localX;
  const worldZ = chunk.z + localZ;
  const naturalColor = terrainColorAtWorld(worldX, worldZ, height);
  const radius = getGraveyardRadius(localX, localZ);
  const edgeBreakup = (
    Math.sin(localX * 0.034 + chunk.cx * 1.9) * 4.5 +
    Math.cos(localZ * 0.041 - chunk.cz * 1.4) * 3.5 +
    Math.sin((localX + localZ) * 0.019) * 3
  );
  const outerBlend = smoothstepRange(GRAVEYARD_FENCE_RADIUS - 92, SURVIVAL_BLOCK_SIZE / 2 - 2, radius + edgeBreakup);
  return target.lerp(naturalColor, clamp01(outerBlend));
}

function getGraveyardTerrainSegments(chunk: SurvivalChunkInfo) {
  if (chunk.distance === 0) return 52;
  if (chunk.distance <= SURVIVAL_NEAR_RADIUS) return 34;
  return 22;
}

function makeGraveyardVillageTerrainGeometry(
  chunk: SurvivalChunkInfo,
  terrainHeightForChunk: SurvivalTerrainHeightForChunk,
  terrainColorAtWorld: SurvivalTerrainColorAtWorld,
  villageBaseHeightForChunk: SurvivalVillageBaseHeightForChunk,
) {
  const segments = getGraveyardTerrainSegments(chunk);
  const baseHeight = villageBaseHeightForChunk(chunk);
  const geo = new THREE.PlaneGeometry(SURVIVAL_BLOCK_SIZE, SURVIVAL_BLOCK_SIZE, segments, segments);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const colorScratch = new THREE.Color();

  for (let i = 0; i < pos.count; i += 1) {
    const localX = pos.getX(i);
    const localZ = pos.getZ(i);
    const height = getGraveyardVillageHeight(chunk, localX, localZ, terrainHeightForChunk, baseHeight);
    const color = getGraveyardGroundColorInto(colorScratch, chunk, localX, localZ, height, baseHeight, terrainColorAtWorld);
    const colorOffset = i * 3;
    pos.setY(i, height);
    colors[colorOffset] = color.r;
    colors[colorOffset + 1] = color.g;
    colors[colorOffset + 2] = color.b;
  }

  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}

function makeGraveyardVillageTerrainSkirtGeometry(
  chunk: SurvivalChunkInfo,
  terrainHeightForChunk: SurvivalTerrainHeightForChunk,
  terrainColorAtWorld: SurvivalTerrainColorAtWorld,
  villageBaseHeightForChunk: SurvivalVillageBaseHeightForChunk,
) {
  const segments = getGraveyardTerrainSegments(chunk);
  const baseHeight = villageBaseHeightForChunk(chunk);
  const colorScratch = new THREE.Color();
  return makeSurvivalEdgeSkirtGeometry(
    `${chunk.key}:graveyard-skirt:${segments}`,
    segments,
    (localX, localZ) => {
      const height = getGraveyardVillageHeight(chunk, localX, localZ, terrainHeightForChunk, baseHeight);
      const color = getGraveyardGroundColorInto(colorScratch, chunk, localX, localZ, height, baseHeight, terrainColorAtWorld);
      return { height, color };
    },
  );
}

function mixGraveyardStoneColor(baseHex: string, targetHex: string, amount: number) {
  return new THREE.Color(baseHex).lerp(new THREE.Color(targetHex), clamp01(amount)).getStyle();
}

function makeGraveyardStoneTexture(baseHex: string, variant: number, role: "body" | "dark" | "accent" | "foundation") {
  const seed = Math.round(variant * 10000);
  const cacheKey = `${baseHex}|${seed}|${role}`;
  const cached = graveyardStoneTextureCache.get(cacheKey);
  if (cached) return cached;

  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    ctx.imageSmoothingEnabled = false;
    const highlight = mixGraveyardStoneColor(baseHex, role === "foundation" ? "#62705b" : "#efe6d2", role === "dark" ? 0.14 : 0.28);
    const midtone = mixGraveyardStoneColor(baseHex, role === "foundation" ? "#2f3a29" : "#8a8378", role === "accent" ? 0.22 : 0.16);
    const shadow = mixGraveyardStoneColor(baseHex, role === "foundation" ? "#0b0d09" : "#171512", role === "dark" ? 0.42 : 0.32);
    const moss = role === "foundation" ? "#4a5c33" : "#4f6741";
    const lichen = role === "dark" ? "#74776b" : "#cad0b1";

    ctx.fillStyle = baseHex;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < canvas.height; y += 2) {
      for (let x = 0; x < canvas.width; x += 2) {
        const grain = survivalHash01(x + seed, y - seed, 12480);
        const vein = Math.sin((x + seed * 0.017) * 0.16 + y * 0.045) + Math.cos((y - seed * 0.013) * 0.12 - x * 0.055);
        const damp = smoothstepRange(54, 126, y) * survivalHash01(x - seed, y + seed, 12481);

        if (vein > 1.18) {
          ctx.fillStyle = midtone;
          ctx.fillRect(x, y, 2, 2);
        } else if (grain > 0.91) {
          ctx.fillStyle = highlight;
          ctx.fillRect(x, y, 2, 2);
        } else if (grain < 0.1) {
          ctx.fillStyle = shadow;
          ctx.fillRect(x, y, 2, 2);
        } else if (damp > 0.78) {
          ctx.fillStyle = moss;
          ctx.fillRect(x, y, 2, 2);
        }
      }
    }

    for (let y = 10; y < canvas.height; y += 14 + Math.floor(survivalHash01(seed, y, 12482) * 7)) {
      ctx.fillStyle = "rgba(18, 16, 13, 0.18)";
      ctx.fillRect(0, y, canvas.width, 2);
      if (survivalHash01(seed, y, 12483) > 0.44) {
        ctx.fillStyle = "rgba(238, 232, 216, 0.14)";
        ctx.fillRect(0, y + 2, canvas.width, 2);
      }
    }

    for (let crack = 0; crack < 4; crack += 1) {
      let x = Math.floor(survivalHash01(seed, crack, 12484) * canvas.width);
      let y = Math.floor(survivalHash01(crack, seed, 12485) * 56) + 8;
      const length = 18 + Math.floor(survivalHash01(seed + crack, seed - crack, 12486) * 42);
      const drift = survivalHash01(crack, seed, 12487) > 0.5 ? 2 : -2;

      for (let step = 0; step < length; step += 4) {
        ctx.fillStyle = shadow;
        ctx.fillRect(Math.max(0, Math.min(canvas.width - 2, x)), Math.max(0, Math.min(canvas.height - 4, y)), 2, 4);
        if (step % 12 === 0) {
          ctx.fillStyle = "rgba(236, 228, 207, 0.18)";
          ctx.fillRect(Math.max(0, Math.min(canvas.width - 2, x + 2)), Math.max(0, Math.min(canvas.height - 2, y)), 2, 2);
        }
        x += (survivalHash01(x + seed, y - seed, 12488) > 0.52 ? drift : 0);
        y += 4;
      }
    }

    for (let chip = 0; chip < 12; chip += 1) {
      const side = survivalHash01(seed, chip, 12489);
      const width = 4 + Math.floor(survivalHash01(chip, seed, 12490) * 12);
      const height = 2 + Math.floor(survivalHash01(seed + chip, chip, 12491) * 7);
      const x = side < 0.34 ? 0 : side < 0.68 ? canvas.width - width : Math.floor(survivalHash01(chip, seed, 12492) * (canvas.width - width));
      const y = side >= 0.68 ? 0 : Math.floor(survivalHash01(seed, chip, 12493) * (canvas.height - height));

      ctx.fillStyle = shadow;
      ctx.fillRect(x, y, width, height);
      ctx.fillStyle = "rgba(244, 238, 221, 0.2)";
      ctx.fillRect(Math.min(canvas.width - 2, x + 1), Math.min(canvas.height - 2, y + height), Math.max(2, width - 2), 2);
    }

    for (let spot = 0; spot < 14; spot += 1) {
      const x = Math.floor(survivalHash01(seed + spot, spot, 12494) * 120);
      const y = 58 + Math.floor(survivalHash01(spot, seed - spot, 12495) * 66);
      const size = 2 + Math.floor(survivalHash01(seed, spot, 12496) * 7);
      ctx.fillStyle = survivalHash01(spot, seed, 12497) > 0.5 ? moss : lichen;
      ctx.fillRect(x, y, size, 2);
      ctx.fillRect(x + 2, y + 2, Math.max(2, size - 2), 2);
    }
  }

  const texture = configurePixelSpriteTexture(new THREE.CanvasTexture(canvas));
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(role === "foundation" ? 1.45 : 1.1, role === "foundation" ? 1.25 : 1.0);
  texture.needsUpdate = true;
  graveyardStoneTextureCache.set(cacheKey, texture);
  return texture;
}

function makeGraveyardTombTextTexture(name: string, joke: string, variant: number) {
  const cacheKey = `${name}|${joke}|${variant}`;
  const cached = graveyardTombTextureCache.get(cacheKey);
  if (cached) return cached;

  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 160;
  const ctx = canvas.getContext("2d");
  if (!ctx) return configurePixelSpriteTexture(new THREE.CanvasTexture(canvas));

  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = variant % 2 === 0 ? "#cfc8b8" : "#b9b2a3";
  ctx.fillRect(10, 14, 236, 132);
  ctx.fillStyle = "#81796d";
  ctx.fillRect(10, 138, 236, 8);
  ctx.fillRect(238, 22, 8, 124);
  ctx.fillStyle = "#f1ead9";
  ctx.fillRect(18, 22, 214, 6);
  ctx.fillStyle = "rgba(47, 43, 36, 0.22)";
  ctx.fillRect(22, 130, 202, 2);
  ctx.fillRect(28, 72, 172, 2);

  for (let speckle = 0; speckle < 95; speckle += 1) {
    const x = 18 + Math.floor(survivalHash01(variant + speckle, speckle, 12510) * 214);
    const y = 30 + Math.floor(survivalHash01(speckle, variant - speckle, 12511) * 104);
    const light = survivalHash01(variant, speckle, 12512) > 0.58;
    ctx.fillStyle = light ? "rgba(245, 238, 219, 0.48)" : "rgba(43, 38, 30, 0.32)";
    ctx.fillRect(x, y, 2, 2);
  }

  for (let crack = 0; crack < 3; crack += 1) {
    let x = 38 + Math.floor(survivalHash01(variant, crack, 12513) * 156);
    let y = 34 + Math.floor(survivalHash01(crack, variant, 12514) * 76);
    const length = 16 + Math.floor(survivalHash01(variant + crack, crack, 12515) * 34);
    const drift = survivalHash01(crack, variant, 12516) > 0.5 ? 2 : -2;

    for (let step = 0; step < length; step += 4) {
      ctx.fillStyle = "rgba(32, 27, 20, 0.42)";
      ctx.fillRect(x, y, 2, 4);
      if (step % 12 === 0) {
        ctx.fillStyle = "rgba(242, 235, 217, 0.24)";
        ctx.fillRect(x + 2, y, 2, 2);
      }
      x += survivalHash01(x + variant, y, 12517) > 0.54 ? drift : 0;
      y += 4;
    }
  }

  for (let index = 0; index < GRAVEYARD_TOMB_TEXTURE_CHIP_RECTS.length; index += 1) {
    const [x, y, width, height] = GRAVEYARD_TOMB_TEXTURE_CHIP_RECTS[index];
    ctx.fillStyle = "rgba(67, 59, 48, 0.38)";
    ctx.fillRect(x, y, width, height);
    ctx.fillStyle = "rgba(247, 239, 221, 0.22)";
    ctx.fillRect(x + 2, y + height, Math.max(2, width - 4), 2);
  }

  ctx.fillStyle = "#171512";
  ctx.font = "bold 18px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(name, 128, 50);
  ctx.fillStyle = "#2b2720";
  ctx.font = "bold 14px monospace";
  const words = joke.split(" ");
  const lines: string[] = [];
  let current = "";
  for (let index = 0; index < words.length; index += 1) {
    const word = words[index];
    const next = current ? `${current} ${word}` : word;
    if (next.length > 22 && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  const lineCount = Math.min(3, lines.length);
  for (let index = 0; index < lineCount; index += 1) {
    ctx.fillText(lines[index], 128, 86 + index * 19);
  }

  const texture = configurePixelSpriteTexture(new THREE.CanvasTexture(canvas));
  graveyardTombTextureCache.set(cacheKey, texture);
  return texture;
}

function makeGraveyardTombs(chunk: SurvivalChunkInfo, baseHeight: number, terrainHeightForChunk: SurvivalTerrainHeightForChunk): GraveyardTomb[] {
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
      if (getGraveyardRadiusSq(localX, localZ) > GRAVEYARD_TOMB_INNER_RADIUS_SQ) continue;
      if (getGraveyardChapelMask(localX, localZ) > 0.08) continue;

      const index = tombs.length;
      if (index >= GRAVEYARD_TOMB_NAMES.length) break;

      const variant = survivalHash01(chunk.cx + index, chunk.cz - index, 12240);
      const name = GRAVEYARD_TOMB_NAMES[(nameOffset + index * 37) % GRAVEYARD_TOMB_NAMES.length];
      const joke = GRAVEYARD_TOMB_JOKES[Math.floor(survivalHash01(chunk.cx - index, chunk.cz + index, 12250) * GRAVEYARD_TOMB_JOKES.length) % GRAVEYARD_TOMB_JOKES.length];
      const localY = getGraveyardVillageHeight(chunk, localX, localZ, terrainHeightForChunk, baseHeight);
      const facingCenter = localZ < 0 ? 0 : Math.PI;

      tombs.push({
        key: `${chunk.key}-grave-${index}`,
        localX,
        localY,
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

function makeGraveyardFenceSegments(chunk: SurvivalChunkInfo, baseHeight: number, terrainHeightForChunk: SurvivalTerrainHeightForChunk): GraveyardFenceSegment[] {
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
      localY: getGraveyardVillageHeight(chunk, localX, localZ, terrainHeightForChunk, baseHeight),
      localZ,
      rotation: angle,
      length: segmentLength,
    });
  }

  return segments;
}

function makeGraveyardPathStones(chunk: SurvivalChunkInfo, baseHeight: number, terrainHeightForChunk: SurvivalTerrainHeightForChunk): GraveyardPathStone[] {
  const stones: GraveyardPathStone[] = [];
  const colors = ["#d7d8cf", "#bfc1ba", "#f0efe4", "#9b9f99", "#caccbf", "#747873"];
  const crossStoneCount = 96;
  const ringStoneCount = 72;

  for (let index = 0; index < crossStoneCount + ringStoneCount; index += 1) {
    const ring = index >= crossStoneCount;
    const t = ring ? (index - crossStoneCount) / ringStoneCount : index / crossStoneCount;
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
      localY: getGraveyardVillageHeight(chunk, localX, localZ, terrainHeightForChunk, baseHeight) + 0.1,
      localZ,
      rotation: ring ? angle : survivalHash01(chunk.cx, chunk.cz, 12350 + index) * Math.PI,
      width: 0.48 + chipScale * 1.42,
      depth: 0.34 + survivalHash01(chunk.cx, chunk.cz, 12370 + index) * 1.05,
      color: colors[index % colors.length],
    });
  }

  return stones;
}

function makeGraveyardLayout(
  chunk: SurvivalChunkInfo,
  baseHeight: number,
  includePathStones: boolean,
  terrainHeightForChunk: SurvivalTerrainHeightForChunk,
): GraveyardLayout {
  return {
    baseHeight,
    tombs: makeGraveyardTombs(chunk, baseHeight, terrainHeightForChunk),
    fenceSegments: makeGraveyardFenceSegments(chunk, baseHeight, terrainHeightForChunk),
    pathStones: includePathStones ? makeGraveyardPathStones(chunk, baseHeight, terrainHeightForChunk) : [],
  };
}

function GraveyardSpikedFence({ segments, showDetails }: { segments: GraveyardFenceSegment[]; showDetails: boolean }) {
  return (
    <group name="graveyard-black-spiked-fence">
      {segments.map((segment) => (
        <group key={segment.key} position={[segment.localX, segment.localY, segment.localZ]} rotation={[0, segment.rotation, 0]}>
          <mesh position={[0, -0.46, 0]} castShadow={false} receiveShadow>
            <boxGeometry args={[segment.length + 2.1, 1.08, 1.28]} />
            <meshBasicMaterial color="#050505" />
          </mesh>
          <mesh position={[0, 0.38, 0]} castShadow={false}>
            <boxGeometry args={[segment.length + 1.4, 0.76, 1.05]} />
            <meshBasicMaterial color="#020202" />
          </mesh>
          <mesh position={[0, 7.42, 0]} castShadow={false}>
            <boxGeometry args={[segment.length, 0.58, 0.52]} />
            <meshBasicMaterial color="#050505" />
          </mesh>
          <mesh position={[0, 4.95, 0]} castShadow={false}>
            <boxGeometry args={[segment.length, 0.48, 0.42]} />
            <meshBasicMaterial color="#080808" />
          </mesh>
          <mesh position={[0, 2.52, 0]} castShadow={false}>
            <boxGeometry args={[segment.length, 0.42, 0.36]} />
            <meshBasicMaterial color="#111111" />
          </mesh>
          {[-0.48, 0.48].map((offset) => (
            <mesh key={`post-${offset}`} position={[offset * segment.length, 5.05, 0]} castShadow={false}>
              <boxGeometry args={[1.18, 10.1, 1.18]} />
              <meshBasicMaterial color="#080808" />
            </mesh>
          ))}
          {showDetails && getCachedIndexRange(3).map((index) => {
            const x = -segment.length * 0.32 + index * (segment.length * 0.64 / 2);
            return (
              <Fragment key={`spike-${index}`}>
                <mesh position={[x, 4.78, 0]} castShadow={false}>
                  <boxGeometry args={[0.5, 8.2, 0.5]} />
                  <meshBasicMaterial color="#0c0c0c" />
                </mesh>
                <mesh position={[x, 9.85, 0]} rotation={[0, Math.PI / 4, 0]} castShadow={false}>
                  <coneGeometry args={[0.72, 2.15, 4]} />
                  <meshBasicMaterial color="#030303" />
                </mesh>
                <mesh position={[x + 0.14, 8.8, -0.24]} castShadow={false}>
                  <boxGeometry args={[0.16, 1.4, 0.12]} />
                  <meshBasicMaterial color="#333333" />
                </mesh>
              </Fragment>
            );
          })}
        </group>
      ))}
    </group>
  );
}

function GraveyardPathStones({ stones, showDetails }: { stones: GraveyardPathStone[]; showDetails: boolean }) {
  const pathStoneRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    const mesh = pathStoneRef.current;
    if (!mesh) return;

    for (let index = 0; index < stones.length; index += 1) {
      const stone = stones[index];
      dummy.position.set(stone.localX, stone.localY, stone.localZ);
      dummy.rotation.set(-Math.PI / 2, 0, stone.rotation);
      dummy.scale.set(stone.width, stone.depth, 0.12);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    }
    mesh.count = stones.length;
    finalizeSurvivalInstancedMesh(mesh, 0, 0, GRAVEYARD_VILLAGE_RADIUS + 36, 12);
  }, [dummy, stones]);

  if (!showDetails || stones.length === 0) return null;

  return (
    <group name="graveyard-path-stones">
      <instancedMesh ref={pathStoneRef} args={[undefined, undefined, Math.max(1, stones.length)]} castShadow={false} renderOrder={2}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color="#caccbf" transparent opacity={0.68} />
      </instancedMesh>
    </group>
  );
}

function GraveyardTombstone({ tomb, showInscription }: { tomb: GraveyardTomb; showInscription: boolean }) {
  const styleIndex = Math.floor(survivalHash01(tomb.localX, tomb.localZ, 12412) * 5) % 5;
  const labelTexture = useMemo(
    () => showInscription ? makeGraveyardTombTextTexture(tomb.name, tomb.joke, styleIndex * 11 + Math.floor(tomb.variant * 9)) : null,
    [showInscription, tomb.joke, tomb.name, styleIndex, tomb.variant],
  );
  const stoneColor = tomb.variant > 0.66 ? "#9a9488" : tomb.variant > 0.33 ? "#b2ab9e" : "#7d7972";
  const darkStone = tomb.variant > 0.5 ? "#4a4640" : "#36332f";
  const accentStone = tomb.variant > 0.66 ? "#d2c9b7" : tomb.variant > 0.33 ? "#716b62" : "#bfb7a7";
  const stoneTexture = useMemo(
    () => makeGraveyardStoneTexture(stoneColor, tomb.variant + styleIndex * 0.17, "body"),
    [stoneColor, styleIndex, tomb.variant],
  );
  const darkStoneTexture = useMemo(
    () => makeGraveyardStoneTexture(darkStone, tomb.variant + styleIndex * 0.19, "dark"),
    [darkStone, styleIndex, tomb.variant],
  );
  const accentStoneTexture = useMemo(
    () => makeGraveyardStoneTexture(accentStone, tomb.variant + styleIndex * 0.23, "accent"),
    [accentStone, styleIndex, tomb.variant],
  );
  const width = 11.6 + tomb.variant * 5.2 + (styleIndex === 3 ? 2.4 : 0);
  const height = 15.2 + survivalHash01(tomb.localX, tomb.localZ, 12400) * 7.6 + (styleIndex === 1 ? 4.6 : 0);
  const depth = 1.85 + tomb.variant * 0.72;
  const baseWidth = width + (styleIndex === 3 ? 5.8 : 4.1);
  const baseDepth = depth + 2.45;
  const foundationColor = tomb.variant > 0.5 ? "#1d241b" : "#252c21";
  const foundationTexture = useMemo(
    () => makeGraveyardStoneTexture(foundationColor, tomb.variant + styleIndex * 0.29, "foundation"),
    [foundationColor, styleIndex, tomb.variant],
  );
  const labelY = styleIndex === 1 ? height * 0.42 + 1.25 : styleIndex === 3 ? height * 0.39 + 1.15 : height * 0.48 + 1.05;
  const labelHeight = styleIndex === 1 ? height * 0.42 : styleIndex === 4 ? height * 0.48 : height * 0.52;
  const labelWidth = styleIndex === 3 ? width * 0.43 : width * 0.78;
  const frontZ = -depth / 2 - 0.035;

  return (
    <group name="graveyard-joke-tomb" position={[tomb.localX, tomb.localY, tomb.localZ]} rotation={[0, tomb.rotation, 0]}>
      <mesh position={[0, -0.88, 0.62]} castShadow={false} receiveShadow>
        <boxGeometry args={[baseWidth * 1.08, 1.76, baseDepth * 1.16]} />
        <meshBasicMaterial map={foundationTexture} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 2.0]} castShadow={false} renderOrder={1} scale={[1.9, 1.18, 1]}>
        <circleGeometry args={[7.4 + tomb.variant * 2.2, 12]} />
        <meshBasicMaterial color="#202519" transparent opacity={0.82} />
      </mesh>
      <mesh position={[0, 0.78, 0.62]} castShadow={false} receiveShadow>
        <boxGeometry args={[baseWidth, 1.56, baseDepth]} />
        <meshBasicMaterial map={darkStoneTexture} />
      </mesh>

      {styleIndex === 0 && (
        <>
          <mesh position={[0, height * 0.5 + 1.2, 0]} castShadow={false} receiveShadow>
            <boxGeometry args={[width, height, depth]} />
            <meshBasicMaterial map={stoneTexture} />
          </mesh>
          <mesh position={[0, height + 1.95, 0]} castShadow={false}>
            <boxGeometry args={[width * 0.74, 1.5, depth + 0.12]} />
            <meshBasicMaterial map={stoneTexture} />
          </mesh>
          <mesh position={[0, height * 0.74 + 1.2, frontZ - 0.02]} castShadow={false}>
            <boxGeometry args={[width * 0.56, 0.5, 0.24]} />
            <meshBasicMaterial color="#2d2a27" />
          </mesh>
        </>
      )}

      {styleIndex === 1 && (
        <>
          <mesh position={[0, height * 0.5 + 1.2, 0]} castShadow={false} receiveShadow>
            <boxGeometry args={[width * 0.62, height, depth]} />
            <meshBasicMaterial map={stoneTexture} />
          </mesh>
          <mesh position={[0, height + 2.7, 0]} castShadow={false}>
            <boxGeometry args={[width * 0.42, 4.1, depth + 0.12]} />
            <meshBasicMaterial map={stoneTexture} />
          </mesh>
          <mesh position={[0, height + 3.0, 0]} castShadow={false}>
            <boxGeometry args={[width * 0.95, 1.52, depth + 0.18]} />
            <meshBasicMaterial map={stoneTexture} />
          </mesh>
          <mesh position={[0, height * 0.72 + 1.1, frontZ - 0.02]} castShadow={false}>
            <boxGeometry args={[0.72, 4.25, 0.26]} />
            <meshBasicMaterial color="#2d2a27" />
          </mesh>
          <mesh position={[0, height * 0.82 + 1.1, frontZ - 0.04]} castShadow={false}>
            <boxGeometry args={[3.25, 0.62, 0.24]} />
            <meshBasicMaterial color="#2d2a27" />
          </mesh>
        </>
      )}

      {styleIndex === 2 && (
        <>
          <mesh position={[0, height * 0.46 + 1.1, 0]} castShadow={false} receiveShadow>
            <boxGeometry args={[width, height * 0.92, depth]} />
            <meshBasicMaterial map={stoneTexture} />
          </mesh>
          <mesh position={[0, height * 0.92 + 1.1, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow={false}>
            <cylinderGeometry args={[width * 0.5, width * 0.5, depth + 0.06, 16]} />
            <meshBasicMaterial map={stoneTexture} />
          </mesh>
          <mesh position={[0, height * 0.86 + 1.1, frontZ - 0.04]} castShadow={false}>
            <boxGeometry args={[width * 0.62, 0.46, 0.24]} />
            <meshBasicMaterial color="#2d2a27" />
          </mesh>
        </>
      )}

      {styleIndex === 3 && (
        <>
          {[-1, 1].map((side) => (
            <Fragment key={`double-marker-${side}`}>
              <mesh position={[side * width * 0.27, height * 0.46 + 1.05, 0]} castShadow={false} receiveShadow>
                <boxGeometry args={[width * 0.42, height * 0.92, depth]} />
                <meshBasicMaterial map={side < 0 ? stoneTexture : accentStoneTexture} />
              </mesh>
              <mesh position={[side * width * 0.27, height * 0.95 + 1.02, 0]} castShadow={false}>
                <boxGeometry args={[width * 0.36, 1.35, depth + 0.12]} />
                <meshBasicMaterial map={side < 0 ? stoneTexture : accentStoneTexture} />
              </mesh>
            </Fragment>
          ))}
          <mesh position={[0, height * 0.18 + 1.0, frontZ - 0.04]} castShadow={false}>
            <boxGeometry args={[width * 0.22, 2.8, 0.22]} />
            <meshBasicMaterial color="#2d2a27" />
          </mesh>
        </>
      )}

      {styleIndex === 4 && (
        <>
          <mesh position={[0, height * 0.42 + 1.12, 0]} castShadow={false} receiveShadow>
            <boxGeometry args={[width * 0.74, height * 0.84, depth]} />
            <meshBasicMaterial map={stoneTexture} />
          </mesh>
          <mesh position={[0, height * 0.92 + 1.02, 0]} rotation={[0, Math.PI / 4, 0]} castShadow={false}>
            <coneGeometry args={[width * 0.52, height * 0.34, 4]} />
            <meshBasicMaterial map={accentStoneTexture} />
          </mesh>
          <mesh position={[0, height * 0.62 + 1.1, frontZ - 0.04]} castShadow={false}>
            <boxGeometry args={[width * 0.42, 0.5, 0.24]} />
            <meshBasicMaterial color="#2d2a27" />
          </mesh>
          <mesh position={[0, height * 0.7 + 1.1, frontZ - 0.05]} castShadow={false}>
            <boxGeometry args={[0.54, 2.7, 0.22]} />
            <meshBasicMaterial color="#2d2a27" />
          </mesh>
        </>
      )}

      <mesh position={[0, 1.72, -baseDepth * 0.5 - 0.04]} castShadow={false}>
        <boxGeometry args={[baseWidth * 0.86, 0.34, 0.2]} />
        <meshBasicMaterial color="#15130f" transparent opacity={0.54} />
      </mesh>
      <mesh position={[-baseWidth * 0.38, height * 0.32 + 1.1, frontZ - 0.045]} castShadow={false}>
        <boxGeometry args={[0.34, height * 0.48, 0.22]} />
        <meshBasicMaterial color="#e5dcc8" transparent opacity={0.28} />
      </mesh>
      <mesh position={[baseWidth * 0.34, height * 0.58 + 1.1, frontZ - 0.045]} castShadow={false}>
        <boxGeometry args={[0.28, height * 0.36, 0.22]} />
        <meshBasicMaterial color="#28241e" transparent opacity={0.46} />
      </mesh>
      {labelTexture && (
        <mesh position={[styleIndex === 3 ? -width * 0.27 : 0, labelY, frontZ - 0.075]} rotation={[0, Math.PI, 0]} frustumCulled={false} renderOrder={3}>
          <planeGeometry args={[labelWidth, labelHeight]} />
          <meshBasicMaterial map={labelTexture} transparent depthWrite={false} side={THREE.DoubleSide} polygonOffset polygonOffsetFactor={-3} polygonOffsetUnits={-3} />
        </mesh>
      )}
    </group>
  );
}

function GraveyardTombs({ tombs, showDetails }: { tombs: GraveyardTomb[]; showDetails: boolean }) {
  const visibleTombs = showDetails ? tombs : [];
  if (!showDetails) {
    for (let index = 0; index < tombs.length; index += 4) {
      visibleTombs.push(tombs[index]);
    }
  }

  return (
    <group name="graveyard-joke-tombs">
      {visibleTombs.map((tomb, index) => (
        <GraveyardTombstone key={tomb.key} tomb={tomb} showInscription={showDetails && index % 8 === 0} />
      ))}
    </group>
  );
}

function ChapelStainedWindow({ position, rotation = [0, 0, 0], scale = 1 }: { position: [number, number, number]; rotation?: [number, number, number]; scale?: number }) {
  return (
    <group position={position} rotation={rotation} scale={[scale, scale, scale]}>
      <mesh castShadow={false}>
        <boxGeometry args={[6.2, 10.4, 0.22]} />
        <meshBasicMaterial color="#0b0b10" />
      </mesh>
      <mesh position={[0, 0, -0.14]} castShadow={false}>
        <boxGeometry args={[5.2, 8.8, 0.16]} />
        <meshBasicMaterial color="#1d4ed8" transparent opacity={0.82} />
      </mesh>
      <mesh position={[-1.35, 0, -0.24]} castShadow={false}>
        <boxGeometry args={[1.1, 8.2, 0.12]} />
        <meshBasicMaterial color="#7e22ce" transparent opacity={0.82} />
      </mesh>
      <mesh position={[1.35, 0, -0.26]} castShadow={false}>
        <boxGeometry args={[1.1, 8.2, 0.12]} />
        <meshBasicMaterial color="#dc2626" transparent opacity={0.76} />
      </mesh>
      <mesh position={[0, 2.25, -0.3]} castShadow={false}>
        <boxGeometry args={[5.0, 0.42, 0.1]} />
        <meshBasicMaterial color="#facc15" transparent opacity={0.88} />
      </mesh>
      <mesh position={[0, -2.25, -0.3]} castShadow={false}>
        <boxGeometry args={[5.0, 0.42, 0.1]} />
        <meshBasicMaterial color="#facc15" transparent opacity={0.88} />
      </mesh>
    </group>
  );
}

function ChapelMuralWindow({ position, rotation = [0, 0, 0], scale = 1, variant = 0 }: { position: [number, number, number]; rotation?: [number, number, number]; scale?: number; variant?: number }) {
  const robes = variant % 2 === 0 ? "#7c3aed" : "#b91c1c";
  const halo = variant % 2 === 0 ? "#facc15" : "#f59e0b";

  return (
    <group position={position} rotation={rotation} scale={[scale, scale, scale]}>
      <mesh castShadow={false}>
        <boxGeometry args={[10.4, 20.6, 0.3]} />
        <meshBasicMaterial color="#08090d" />
      </mesh>
      <mesh position={[0, 0, -0.2]} castShadow={false}>
        <boxGeometry args={[8.8, 18.5, 0.16]} />
        <meshBasicMaterial color="#1e3a8a" transparent opacity={0.82} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[-2.9, 0, -0.34]} castShadow={false}>
        <boxGeometry args={[1.55, 17.2, 0.14]} />
        <meshBasicMaterial color="#06b6d4" transparent opacity={0.78} />
      </mesh>
      <mesh position={[2.9, 0, -0.36]} castShadow={false}>
        <boxGeometry args={[1.55, 17.2, 0.14]} />
        <meshBasicMaterial color="#dc2626" transparent opacity={0.76} />
      </mesh>
      <mesh position={[0, 3.2, -0.45]} castShadow={false}>
        <circleGeometry args={[2.25, 12]} />
        <meshBasicMaterial color={halo} transparent opacity={0.88} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, -2.9, -0.5]} castShadow={false}>
        <boxGeometry args={[3.3, 8.6, 0.12]} />
        <meshBasicMaterial color={robes} transparent opacity={0.82} />
      </mesh>
      <mesh position={[0, 0.5, -0.58]} castShadow={false}>
        <boxGeometry args={[7.6, 0.54, 0.1]} />
        <meshBasicMaterial color="#fde68a" transparent opacity={0.92} />
      </mesh>
      <mesh position={[0, -5.8, -0.58]} castShadow={false}>
        <boxGeometry args={[7.6, 0.54, 0.1]} />
        <meshBasicMaterial color="#fde68a" transparent opacity={0.92} />
      </mesh>
      <mesh position={[0, 0, -0.6]} castShadow={false}>
        <boxGeometry args={[0.54, 17.4, 0.1]} />
        <meshBasicMaterial color="#fde68a" transparent opacity={0.92} />
      </mesh>
    </group>
  );
}

function makeChapelGothicArchShape(width: number, height: number) {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const springY = halfHeight * 0.2;
  const apexY = halfHeight;

  const shape = new THREE.Shape();
  shape.moveTo(-halfWidth, -halfHeight);
  shape.lineTo(halfWidth, -halfHeight);
  shape.lineTo(halfWidth, springY);
  shape.quadraticCurveTo(halfWidth * 0.84, apexY * 0.74, 0, apexY);
  shape.quadraticCurveTo(-halfWidth * 0.84, apexY * 0.74, -halfWidth, springY);
  shape.lineTo(-halfWidth, -halfHeight);
  return shape;
}

function ChapelGiantGothicWindow({
  position,
  rotation = [0, 0, 0],
  scale = 1,
  variant = 0,
}: {
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
  variant?: number;
}) {
  const outerShape = useMemo(() => makeChapelGothicArchShape(13.4, 26.8), []);
  const innerShape = useMemo(() => makeChapelGothicArchShape(10.4, 23.2), []);
  const glowColor = variant % 3 === 0 ? "#38bdf8" : variant % 3 === 1 ? "#a78bfa" : "#f472b6";
  const accentColor = variant % 2 === 0 ? "#fde68a" : "#e9d5ff";

  return (
    <group name="chapel-giant-gothic-window" position={position} rotation={rotation} scale={[scale, scale, scale]}>
      <mesh position={[0, 0, 0]} castShadow={false} renderOrder={2}>
        <shapeGeometry args={[outerShape]} />
        <meshBasicMaterial color="#121019" side={THREE.DoubleSide} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
      </mesh>
      <mesh position={[0, -0.35, 0.08]} castShadow={false} renderOrder={3}>
        <shapeGeometry args={[innerShape]} />
        <meshBasicMaterial color="#1d4ed8" transparent opacity={0.74} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh position={[0, -0.35, 0.12]} castShadow={false} renderOrder={4}>
        <shapeGeometry args={[innerShape]} />
        <meshBasicMaterial color={glowColor} transparent opacity={0.48} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {[-3.15, 0, 3.15].map((x) => (
        <mesh key={`chapel-gothic-window-mullion-${x}`} position={[x, -1.95, 0.2]} castShadow={false} renderOrder={5}>
          <boxGeometry args={[0.42, 17.4, 0.22]} />
          <meshBasicMaterial color="#efe5c7" />
        </mesh>
      ))}
      {[-4.8, 4.8].map((x) => (
        <mesh key={`chapel-gothic-window-side-rib-${x}`} position={[x, -1.1, 0.18]} castShadow={false} renderOrder={5}>
          <boxGeometry args={[0.36, 19.2, 0.22]} />
          <meshBasicMaterial color="#b8ad99" />
        </mesh>
      ))}
      {[-6.15, 6.15].map((x) => (
        <mesh key={`chapel-gothic-window-outer-pier-${x}`} position={[x, -1.4, 0.16]} castShadow={false} renderOrder={5}>
          <boxGeometry args={[0.62, 21.8, 0.28]} />
          <meshBasicMaterial color="#8f897f" />
        </mesh>
      ))}
      <mesh position={[0, -8.95, 0.22]} castShadow={false} renderOrder={5}>
        <boxGeometry args={[11.8, 0.62, 0.26]} />
        <meshBasicMaterial color="#d8cbb1" />
      </mesh>
      <mesh position={[0, -2.25, 0.24]} castShadow={false} renderOrder={5}>
        <boxGeometry args={[10.2, 0.46, 0.22]} />
        <meshBasicMaterial color="#b8ad99" />
      </mesh>
      {[-2.6, 2.6].map((x) => (
        <Fragment key={`chapel-gothic-window-lancet-${x}`}>
          <mesh position={[x, 5.25, 0.28]} rotation={[0, 0, x > 0 ? -0.44 : 0.44]} castShadow={false} renderOrder={6}>
            <boxGeometry args={[0.36, 8.2, 0.2]} />
            <meshBasicMaterial color={accentColor} transparent opacity={0.88} />
          </mesh>
          <mesh position={[x * 0.58, 7.7, 0.3]} rotation={[0, 0, x > 0 ? -0.78 : 0.78]} castShadow={false} renderOrder={6}>
            <boxGeometry args={[0.28, 5.6, 0.18]} />
            <meshBasicMaterial color="#d7d0bd" transparent opacity={0.9} />
          </mesh>
        </Fragment>
      ))}
      <mesh position={[0, 7.25, 0.32]} castShadow={false} renderOrder={6}>
        <circleGeometry args={[1.55, 14]} />
        <meshBasicMaterial color={accentColor} transparent opacity={0.72} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 7.25, 0.36]} castShadow={false} renderOrder={7}>
        <circleGeometry args={[0.72, 10]} />
        <meshBasicMaterial color="#070810" transparent opacity={0.82} side={THREE.DoubleSide} />
      </mesh>
      {[-4.2, -1.4, 1.4, 4.2].map((x, index) => (
        <mesh key={`chapel-gothic-window-glass-strip-${index}`} position={[x, -4.85, 0.34]} castShadow={false} renderOrder={6}>
          <boxGeometry args={[1.15, 6.8, 0.12]} />
          <meshBasicMaterial color={index % 2 === 0 ? "#38bdf8" : "#a78bfa"} transparent opacity={0.76} />
        </mesh>
      ))}
    </group>
  );
}

type ChapelStoneBrickTextureOptions = {
  base: string;
  mid: string;
  light: string;
  mortar: string;
  highlight: string;
  shadow: string;
  chip: string;
  repeatX: number;
  repeatY: number;
};

function createChapelStoneBrickTexture({
  base,
  mid,
  light,
  mortar,
  highlight,
  shadow,
  chip,
  repeatX,
  repeatY,
}: ChapelStoneBrickTextureOptions) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = mortar;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const brickHeights = [54, 58, 50, 62];
    const brickWidths = [124, 152, 108, 176, 136, 164];
    let y = -8;

    for (let row = 0; y < canvas.height + 64; row++) {
      const brickHeight = brickHeights[row % brickHeights.length];
      let x = row % 2 === 0 ? -34 : -108;
      let col = 0;

      while (x < canvas.width + 190) {
        const brickWidth = brickWidths[(row + col) % brickWidths.length];
        const inset = 5;
        const shade = row % 3 === 0 ? base : row % 3 === 1 ? mid : light;

        ctx.fillStyle = shade;
        ctx.fillRect(x + inset, y + inset, brickWidth - inset * 2, brickHeight - inset * 2);
        ctx.fillStyle = highlight;
        ctx.fillRect(x + inset + 4, y + inset + 4, brickWidth - inset * 2 - 12, 5);
        ctx.fillRect(x + inset + 4, y + inset + 12, 6, brickHeight - inset * 2 - 20);
        ctx.fillStyle = shadow;
        ctx.fillRect(x + inset + 5, y + brickHeight - inset - 8, brickWidth - inset * 2 - 10, 7);
        ctx.fillRect(x + brickWidth - inset - 9, y + inset + 9, 6, brickHeight - inset * 2 - 18);

        if ((row + col) % 2 === 0) {
          ctx.fillStyle = chip;
          ctx.fillRect(x + brickWidth * 0.42, y + brickHeight * 0.35, 16, 7);
          ctx.fillRect(x + brickWidth * 0.66, y + brickHeight * 0.66, 10, 5);
        } else {
          ctx.fillStyle = shadow;
          ctx.fillRect(x + brickWidth * 0.24, y + brickHeight * 0.56, 13, 5);
        }

        x += brickWidth;
        col++;
      }

      y += brickHeight;
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.needsUpdate = true;
  return texture;
}

function ChapelCrack({ position, rotation = [0, 0, 0], scale = 1 }: { position: [number, number, number]; rotation?: [number, number, number]; scale?: number }) {
  return (
    <group position={position} rotation={rotation} scale={[scale, scale, scale]}>
      <mesh position={[0, 0, 0]} rotation={[0, 0, 0.62]} castShadow={false}>
        <boxGeometry args={[0.34, 5.6, 0.18]} />
        <meshBasicMaterial color="#151319" />
      </mesh>
      <mesh position={[1.1, -1.7, -0.04]} rotation={[0, 0, -0.9]} castShadow={false}>
        <boxGeometry args={[0.28, 3.2, 0.16]} />
        <meshBasicMaterial color="#17151b" />
      </mesh>
      <mesh position={[-0.9, 1.9, -0.04]} rotation={[0, 0, -0.72]} castShadow={false}>
        <boxGeometry args={[0.26, 2.7, 0.16]} />
        <meshBasicMaterial color="#17151b" />
      </mesh>
    </group>
  );
}

function ChapelEntranceStairs({
  axisDistance = CHAPEL_CENTER_HALF_DEPTH,
  width = 48,
  top = CHAPEL_STAIR_RAMP_CENTER_TOP,
  outset = 2,
}: {
  axisDistance?: number;
  width?: number;
  top?: number;
  outset?: number;
}) {
  const slope = Math.atan2(top - CHAPEL_STAIR_RAMP_LOW_TOP, CHAPEL_STAIR_RAMP_LENGTH);
  const halfThickness = CHAPEL_STAIR_RAMP_THICKNESS / 2;
  const midTop = (top + CHAPEL_STAIR_RAMP_LOW_TOP) / 2;
  const centerY = midTop - halfThickness * Math.cos(slope);
  const centerZ = axisDistance + outset + CHAPEL_STAIR_RAMP_LENGTH / 2 - 0.25;

  return (
    <group name="chapel-entry-smooth-ramp">
      <mesh position={[0, centerY, centerZ]} rotation={[slope, 0, 0]} castShadow={false} receiveShadow>
        <boxGeometry args={[width, CHAPEL_STAIR_RAMP_THICKNESS, CHAPEL_STAIR_RAMP_LENGTH]} />
        <meshBasicMaterial color="#3a3530" />
      </mesh>
      <mesh position={[0, CHAPEL_STAIR_RAMP_LOW_TOP * 0.5, centerZ + CHAPEL_STAIR_RAMP_LENGTH * 0.5 + 1.2]} castShadow={false} receiveShadow>
        <boxGeometry args={[width + 4, CHAPEL_STAIR_RAMP_LOW_TOP, 5.2]} />
        <meshBasicMaterial color="#302b26" />
      </mesh>
    </group>
  );
}

function ChapelPew({ z, side }: { z: number; side: -1 | 1 }) {
  const x = side * CHAPEL_CENTER_PEW_X;
  return (
    <group position={[x, 0.96, z]}>
      <mesh position={[0, 1.15, 0]} castShadow={false}>
        <boxGeometry args={[18, 1.2, 3.8]} />
        <meshBasicMaterial color="#5a321c" />
      </mesh>
      {[-5.6, 0, 5.6].map((grainX, index) => (
        <mesh key={`chapel-pew-seat-grain-${grainX}`} position={[grainX, 1.78, 0.2 - index * 0.28]} castShadow={false}>
          <boxGeometry args={[3.7, 0.12, 0.18]} />
          <meshBasicMaterial color={index % 2 === 0 ? "#9a6132" : "#2b160b"} transparent opacity={0.68} />
        </mesh>
      ))}
      <mesh position={[0, 2.32, 1.35]} rotation={[-0.14, 0, 0]} castShadow={false}>
        <boxGeometry args={[18.4, 2.05, 0.9]} />
        <meshBasicMaterial color="#3a2115" />
      </mesh>
      {[-6.5, 0, 6.5].map((grainX) => (
        <mesh key={`chapel-pew-back-grain-${grainX}`} position={[grainX, 2.64, 1.95]} rotation={[-0.14, 0, 0]} castShadow={false}>
          <boxGeometry args={[4.2, 0.18, 0.16]} />
          <meshBasicMaterial color="#8d552c" transparent opacity={0.58} />
        </mesh>
      ))}
      {[-7.2, 7.2].map((legX) => (
        <Fragment key={`pew-leg-${legX}`}>
          <mesh position={[legX, 0.55, -1.1]} castShadow={false}>
            <boxGeometry args={[0.78, 1.1, 0.78]} />
            <meshBasicMaterial color="#2a160d" />
          </mesh>
          <mesh position={[legX, 0.55, 1.1]} castShadow={false}>
            <boxGeometry args={[0.78, 1.1, 0.78]} />
            <meshBasicMaterial color="#2a160d" />
          </mesh>
        </Fragment>
      ))}
    </group>
  );
}

function getYawForPewFacingTarget(x: number, z: number, targetX: number, targetZ: number) {
  return Math.atan2(-(targetX - x), -(targetZ - z));
}

function getAvatarYawFacingTarget(x: number, z: number, targetX: number, targetZ: number) {
  return Math.atan2(targetX - x, -(targetZ - z));
}

type ChapelSideWingPewPlacement = {
  key: string;
  x: number;
  z: number;
  width: number;
};

const CHAPEL_POPE_TARGET = { x: 0, z: -68.6 };
const CHAPEL_CENTER_PEW_X = 17.2;
const CHAPEL_CENTER_PEW_SEATS = [12.1, 19.2];
const CHAPEL_CENTER_PEW_ROWS = [-32, -20, -8, 4, 16];

function getChapelSideWingPewLayout(): ChapelSideWingPewPlacement[] {
  return [-1, 1].flatMap((side) => ([
    { key: `${side}-rear-outer`, x: side * 94, z: -44, width: 16 },
    { key: `${side}-rear-inner`, x: side * 76, z: -34, width: 18 },
    { key: `${side}-rear-mid`, x: side * 94, z: -22, width: 16 },
    { key: `${side}-front-mid`, x: side * 94, z: 22, width: 16 },
    { key: `${side}-front-inner`, x: side * 76, z: 34, width: 18 },
    { key: `${side}-front-outer`, x: side * 94, z: 44, width: 16 },
  ]));
}

function ChapelDiagonalPew({
  position,
  yaw,
  width = 20,
}: {
  position: [number, number, number];
  yaw: number;
  width?: number;
}) {
  return (
    <group position={position} rotation={[0, yaw, 0]}>
      <mesh position={[0, 1.08, 0]} castShadow={false}>
        <boxGeometry args={[width, 1.08, 3.5]} />
        <meshBasicMaterial color="#5a321c" />
      </mesh>
      <mesh position={[0, 2.12, 1.22]} rotation={[-0.14, 0, 0]} castShadow={false}>
        <boxGeometry args={[width + 0.5, 1.8, 0.78]} />
        <meshBasicMaterial color="#321d12" />
      </mesh>
      {[-0.28, 0.28].map((offset, index) => (
        <mesh key={`chapel-diagonal-pew-plank-${offset}`} position={[0, 1.62, offset]} castShadow={false}>
          <boxGeometry args={[width - 1.7, 0.11, 0.16]} />
          <meshBasicMaterial color={index % 2 === 0 ? "#9a6132" : "#2b160b"} transparent opacity={0.62} />
        </mesh>
      ))}
      {[-0.38, 0, 0.38].map((offset) => (
        <mesh key={`chapel-diagonal-pew-back-grain-${offset}`} position={[offset * width, 2.44, 1.74]} rotation={[-0.14, 0, 0]} castShadow={false}>
          <boxGeometry args={[width * 0.22, 0.15, 0.14]} />
          <meshBasicMaterial color="#8d552c" transparent opacity={0.56} />
        </mesh>
      ))}
      {[-0.42, 0.42].map((offset) => (
        <Fragment key={`chapel-diagonal-pew-leg-${offset}`}>
          <mesh position={[offset * width, 0.48, -0.95]} castShadow={false}>
            <boxGeometry args={[0.7, 0.96, 0.7]} />
            <meshBasicMaterial color="#2a160d" />
          </mesh>
          <mesh position={[offset * width, 0.48, 0.95]} castShadow={false}>
            <boxGeometry args={[0.7, 0.96, 0.7]} />
            <meshBasicMaterial color="#2a160d" />
          </mesh>
        </Fragment>
      ))}
    </group>
  );
}

function getRotatedChapelSeatPosition(x: number, z: number, localX: number, localZ: number, yaw: number): [number, number] {
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  return [
    x + localX * cos + localZ * sin,
    z - localX * sin + localZ * cos,
  ];
}

function clampChapelNpcSeatPosition(x: number, z: number): [number, number] {
  if (Math.abs(x) > CHAPEL_CENTER_HALF_WIDTH) {
    const side = x < 0 ? -1 : 1;
    const safeAbsX = THREE.MathUtils.clamp(
      Math.abs(x),
      CHAPEL_CENTER_HALF_WIDTH + CHAPEL_SEATED_NPC_WALL_CLEARANCE,
      CHAPEL_OUTER_HALF_WIDTH - CHAPEL_SEATED_NPC_WALL_CLEARANCE,
    );
    return [
      side * safeAbsX,
      THREE.MathUtils.clamp(
        z,
        -CHAPEL_SIDE_WING_HALF_DEPTH + CHAPEL_SEATED_NPC_WALL_CLEARANCE,
        CHAPEL_SIDE_WING_HALF_DEPTH - CHAPEL_SEATED_NPC_WALL_CLEARANCE,
      ),
    ];
  }

  return [
    THREE.MathUtils.clamp(
      x,
      -CHAPEL_CENTER_HALF_WIDTH + CHAPEL_SEATED_NPC_WALL_CLEARANCE,
      CHAPEL_CENTER_HALF_WIDTH - CHAPEL_SEATED_NPC_WALL_CLEARANCE,
    ),
    THREE.MathUtils.clamp(
      z,
      -CHAPEL_CENTER_HALF_DEPTH + CHAPEL_SEATED_NPC_WALL_CLEARANCE,
      CHAPEL_CENTER_HALF_DEPTH - CHAPEL_SEATED_NPC_WALL_CLEARANCE,
    ),
  ];
}

const CHAPEL_NPC_CHARACTERS: CharacterCustomization[] = [
  {
    skinColor: "#c68a5c",
    topColor: "#5b2f2a",
    pantsColor: "#242126",
    shoesColor: "#2c2116",
    hatColor: "#5b2f2a",
    hairColor: "#2b160d",
    facialHairColor: "#2b160d",
    topStyle: "tunic",
    pantsStyle: "pants",
    shoesStyle: "boots",
    hatStyle: "none",
    hairStyle: "short",
    facialHairStyle: "none",
    eyeStyle: "calm",
    mouthStyle: "neutral",
  },
  {
    skinColor: "#8f5f3f",
    topColor: "#2e4a63",
    pantsColor: "#334155",
    shoesColor: "#1f2937",
    hatColor: "#2e4a63",
    hairColor: "#1b130d",
    facialHairColor: "#1b130d",
    topStyle: "vest",
    pantsStyle: "skirt",
    shoesStyle: "shoes",
    hatStyle: "none",
    hairStyle: "bob",
    facialHairStyle: "none",
    eyeStyle: "content",
    mouthStyle: "smile",
  },
  {
    skinColor: "#d39a6b",
    topColor: "#4f5830",
    pantsColor: "#3f3f2b",
    shoesColor: "#2a1f16",
    hatColor: "#4f5830",
    hairColor: "#4a2b18",
    facialHairColor: "#4a2b18",
    topStyle: "simple",
    pantsStyle: "pants",
    shoesStyle: "boots",
    hatStyle: "none",
    hairStyle: "long",
    facialHairStyle: "mustache",
    eyeStyle: "dull",
    mouthStyle: "neutral",
  },
  {
    skinColor: "#b97850",
    topColor: "#51365f",
    pantsColor: "#312e42",
    shoesColor: "#27212f",
    hatColor: "#51365f",
    hairColor: "#24160f",
    facialHairColor: "#24160f",
    topStyle: "tunic",
    pantsStyle: "robe",
    shoesStyle: "sandals",
    hatStyle: "none",
    hairStyle: "spikes",
    facialHairStyle: "goatee",
    eyeStyle: "sus",
    mouthStyle: "frown",
  },
  {
    skinColor: "#e0aa79",
    topColor: "#6a4a30",
    pantsColor: "#4b3b24",
    shoesColor: "#2c2116",
    hatColor: "#6a4a30",
    hairColor: "#5d351e",
    facialHairColor: "#5d351e",
    topStyle: "vest",
    pantsStyle: "shorts",
    shoesStyle: "boots",
    hatStyle: "none",
    hairStyle: "short",
    facialHairStyle: "beard",
    eyeStyle: "happy",
    mouthStyle: "smile",
  },
  {
    skinColor: "#9f6d4b",
    topColor: "#273f35",
    pantsColor: "#1f2f25",
    shoesColor: "#161d18",
    hatColor: "#273f35",
    hairColor: "#19110b",
    facialHairColor: "#19110b",
    topStyle: "simple",
    pantsStyle: "skirt",
    shoesStyle: "barefoot",
    hatStyle: "none",
    hairStyle: "bob",
    facialHairStyle: "none",
    eyeStyle: "nervous",
    mouthStyle: "neutral",
  },
];

const CHAPEL_POPE_CHARACTER: CharacterCustomization = {
  skinColor: "#f5d0a8",
  topColor: "#fff8e7",
  pantsColor: "#f5f0dc",
  shoesColor: "#d4af37",
  hatColor: "#f4f1e8",
  hairColor: "#f8fafc",
  facialHairColor: "#f8fafc",
  topStyle: "robe",
  pantsStyle: "robe",
  shoesStyle: "shoes",
  hatStyle: "none",
  hairStyle: "short",
  facialHairStyle: "none",
  eyeStyle: "calm",
  mouthStyle: "neutral",
};

function ChapelSeatedNpc({
  position,
  yaw,
  character,
}: {
  position: [number, number, number];
  yaw: number;
  character: CharacterCustomization;
}) {
  return (
    <group position={position} scale={[NPC_AVATAR_SCALE, NPC_AVATAR_SCALE, NPC_AVATAR_SCALE]} name="chapel-pew-npc">
      <AvatarWorldFacingPlane character={character} animation="idle" yaw={yaw} health={100} />
    </group>
  );
}

function ChapelPewNpcs() {
  const seatY = 2.98 + NPC_AVATAR_GROUND_LIFT;
  const seatPlacements = [
    { x: CHAPEL_CENTER_PEW_SEATS[0], y: seatY, z: -0.92 },
    { x: CHAPEL_CENTER_PEW_SEATS[1], y: seatY, z: -0.22 },
  ];

  return (
    <group name="chapel-pew-npcs">
      {CHAPEL_CENTER_PEW_ROWS.flatMap((z, rowIndex) => (
        [-1, 1].flatMap((side) => (
          seatPlacements.map((seat, seatIndex) => {
            const character = CHAPEL_NPC_CHARACTERS[(rowIndex * 4 + (side > 0 ? 2 : 0) + seatIndex) % CHAPEL_NPC_CHARACTERS.length];
            const [seatX, seatZ] = clampChapelNpcSeatPosition(side * seat.x, z + seat.z);
            return (
              <ChapelSeatedNpc
                key={`chapel-pew-npc-${rowIndex}-${side}-${seatIndex}`}
                position={[seatX, seat.y, seatZ]}
                yaw={getAvatarYawFacingTarget(seatX, seatZ, CHAPEL_POPE_TARGET.x, CHAPEL_POPE_TARGET.z)}
                character={character}
              />
            );
          })
        ))
      ))}
    </group>
  );
}

function ChapelSideWingPewNpcs({ pews }: { pews: ChapelSideWingPewPlacement[] }) {
  const seatY = 2.78 + NPC_AVATAR_GROUND_LIFT;
  const seatOffsets = [-0.24, 0.24];

  return (
    <group name="chapel-side-wing-pew-npcs">
      {pews.flatMap((pew, pewIndex) => {
        const yaw = getYawForPewFacingTarget(pew.x, pew.z, CHAPEL_POPE_TARGET.x, CHAPEL_POPE_TARGET.z);
        return seatOffsets.map((offset, seatIndex) => {
          const [rawSeatX, rawSeatZ] = getRotatedChapelSeatPosition(pew.x, pew.z, offset * pew.width, -0.42, yaw);
          const [seatX, seatZ] = clampChapelNpcSeatPosition(rawSeatX, rawSeatZ);
          const character = CHAPEL_NPC_CHARACTERS[(pewIndex * 3 + seatIndex + 7) % CHAPEL_NPC_CHARACTERS.length];

          return (
            <ChapelSeatedNpc
              key={`chapel-side-pew-npc-${pew.key}-${seatIndex}`}
              position={[seatX, seatY, seatZ]}
              yaw={getAvatarYawFacingTarget(seatX, seatZ, CHAPEL_POPE_TARGET.x, CHAPEL_POPE_TARGET.z)}
              character={character}
            />
          );
        });
      })}
    </group>
  );
}

function createChapelPopeMiterTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 96;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#f4f1e8";
    ctx.fillRect(24, 6, 16, 6);
    ctx.fillRect(20, 12, 24, 8);
    ctx.fillRect(16, 20, 32, 8);
    ctx.fillRect(12, 28, 40, 10);
    ctx.fillRect(16, 38, 32, 8);
    ctx.fillRect(22, 46, 20, 6);
    ctx.fillStyle = "#c8c1b4";
    ctx.fillRect(12, 36, 40, 4);
    ctx.fillRect(18, 44, 28, 4);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(18, 22, 24, 4);
    ctx.fillRect(22, 14, 14, 4);
    ctx.fillStyle = "#d4af37";
    ctx.fillRect(30, 11, 4, 31);
    ctx.fillRect(24, 22, 16, 4);
    ctx.fillRect(28, 6, 8, 4);
    ctx.fillStyle = "#7a5328";
    ctx.fillRect(35, 15, 3, 25);
    ctx.fillRect(26, 27, 15, 3);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.needsUpdate = true;
  return texture;
}

function ChapelPopeMiter() {
  const texture = useMemo(() => createChapelPopeMiterTexture(), []);

  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <sprite position={[0, 2.08, 0.08]} scale={[1.36, 1.36, 1]}>
      <spriteMaterial map={texture} transparent alphaTest={0.04} depthWrite={false} toneMapped={false} />
    </sprite>
  );
}

function ChapelPopeAtPulpit() {
  return (
    <group name="chapel-pope-at-pulpit" position={[CHAPEL_POPE_TARGET.x, 7.1, CHAPEL_POPE_TARGET.z]} scale={[NPC_AVATAR_SCALE, NPC_AVATAR_SCALE, NPC_AVATAR_SCALE]}>
      <AvatarBillboard character={CHAPEL_POPE_CHARACTER} animation="idle" yaw={Math.PI} health={100} staticFrame fixedDirection={0} />
      <ChapelPopeMiter />
    </group>
  );
}

function ChapelWallCross() {
  return (
    <group name="chapel-wall-cross-behind-pope" position={[0, 18.2, -(CHAPEL_CENTER_HALF_DEPTH - 1.4)]}>
      <mesh position={[0.35, -0.35, -0.06]} castShadow={false}>
        <boxGeometry args={[2.7, 19.8, 0.34]} />
        <meshBasicMaterial color="#120d08" transparent opacity={0.72} />
      </mesh>
      <mesh position={[0.35, 2.8, -0.08]} castShadow={false}>
        <boxGeometry args={[13.6, 2.7, 0.34]} />
        <meshBasicMaterial color="#120d08" transparent opacity={0.72} />
      </mesh>
      <mesh castShadow={false}>
        <boxGeometry args={[2.25, 19.2, 0.46]} />
        <meshBasicMaterial color="#d7b46a" />
      </mesh>
      <mesh position={[0, 3.05, 0.03]} castShadow={false}>
        <boxGeometry args={[13.2, 2.25, 0.52]} />
        <meshBasicMaterial color="#d7b46a" />
      </mesh>
      <mesh position={[-0.34, 0.6, 0.08]} castShadow={false}>
        <boxGeometry args={[0.36, 16.8, 0.12]} />
        <meshBasicMaterial color="#f5d990" transparent opacity={0.72} />
      </mesh>
      <mesh position={[-0.55, 3.55, 0.1]} castShadow={false}>
        <boxGeometry args={[10.6, 0.34, 0.12]} />
        <meshBasicMaterial color="#f5d990" transparent opacity={0.7} />
      </mesh>
      <mesh position={[0.62, -0.5, 0.09]} castShadow={false}>
        <boxGeometry args={[0.34, 15.6, 0.12]} />
        <meshBasicMaterial color="#7a5328" transparent opacity={0.62} />
      </mesh>
      <mesh position={[0.66, 2.35, 0.11]} castShadow={false}>
        <boxGeometry args={[10.8, 0.34, 0.12]} />
        <meshBasicMaterial color="#7a5328" transparent opacity={0.56} />
      </mesh>
    </group>
  );
}

function ChapelCandle({ position, scale = 1, light = false }: { position: [number, number, number]; scale?: number; light?: boolean }) {
  const dripAngles = [0.2, 2.45, 4.1];

  return (
    <group position={position} scale={[scale, scale, scale]}>
      <mesh position={[0, 0.12, 0]} castShadow={false}>
        <cylinderGeometry args={[0.7, 0.82, 0.24, 10]} />
        <meshBasicMaterial color="#3a2a1b" />
      </mesh>
      <mesh position={[0, 0.28, 0]} castShadow={false}>
        <cylinderGeometry args={[0.44, 0.56, 0.3, 10]} />
        <meshBasicMaterial color="#7f6035" />
      </mesh>
      <mesh position={[0, 0.98, 0]} castShadow={false}>
        <cylinderGeometry args={[0.33, 0.38, 1.38, 12]} />
        <meshBasicMaterial color="#f0e2bd" />
      </mesh>
      <mesh position={[0, 1.69, 0]} castShadow={false}>
        <cylinderGeometry args={[0.32, 0.34, 0.12, 12]} />
        <meshBasicMaterial color="#fff1ca" />
      </mesh>
      {dripAngles.map((angle, index) => (
        <mesh key={`chapel-candle-drip-${index}`} position={[Math.cos(angle) * 0.3, 1.24 - index * 0.14, Math.sin(angle) * 0.3]} rotation={[0, angle, 0]} castShadow={false}>
          <boxGeometry args={[0.1, 0.44 + index * 0.08, 0.08]} />
          <meshBasicMaterial color="#fff3cf" />
        </mesh>
      ))}
      <mesh position={[0, 1.9, 0]} castShadow={false}>
        <cylinderGeometry args={[0.035, 0.045, 0.44, 5]} />
        <meshBasicMaterial color="#18110a" />
      </mesh>
      <mesh position={[0, 2.24, 0]} castShadow={false}>
        <coneGeometry args={[0.38, 0.92, 8]} />
        <meshBasicMaterial color="#ff9d1f" transparent opacity={0.94} />
      </mesh>
      <mesh position={[0, 2.32, 0]} castShadow={false}>
        <coneGeometry args={[0.18, 0.52, 8]} />
        <meshBasicMaterial color="#fff4a8" transparent opacity={0.96} />
      </mesh>
      <mesh position={[0, 2.28, 0]} castShadow={false}>
        <sphereGeometry args={[0.72, 10, 8]} />
        <meshBasicMaterial color="#ffb347" transparent opacity={0.18} depthWrite={false} />
      </mesh>
      {light && <pointLight color="#ffd27a" intensity={4.4} distance={32} decay={2} position={[0, 2.22, 0]} />}
    </group>
  );
}

function ChapelChandelier({ z, light = false }: { z: number; light?: boolean }) {
  return (
    <group position={[0, 23.4, z]}>
      <mesh position={[0, 7.3, 0]} castShadow={false}>
        <cylinderGeometry args={[0.16, 0.16, 14.6, 5]} />
        <meshBasicMaterial color="#15110c" />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow={false}>
        <torusGeometry args={[6.2, 0.24, 6, 24]} />
        <meshBasicMaterial color="#24180c" />
      </mesh>
      {CHAPEL_CHANDELIER_CANDLE_POSITIONS.map(([x, y, zOffset], index) => (
        <Fragment key={`chapel-chandelier-candle-${index}`}>
          <mesh position={[x * 0.5, 0, zOffset * 0.5]} rotation={[0, 0, Math.atan2(zOffset, x)]} castShadow={false}>
            <boxGeometry args={[6.2, 0.16, 0.16]} />
            <meshBasicMaterial color="#2f1e0f" />
          </mesh>
          <ChapelCandle position={[x, y - 0.15, zOffset]} scale={0.86} light={false} />
        </Fragment>
      ))}
      <mesh position={[0, 0.9, 0]} castShadow={false}>
        <sphereGeometry args={[8.6, 14, 10]} />
        <meshBasicMaterial color="#ffbf5a" transparent opacity={0.14} depthWrite={false} />
      </mesh>
      {light && <pointLight color="#ffd27a" intensity={4.2} distance={58} decay={2} position={[0, 1.4, 0]} />}
    </group>
  );
}

function ChapelInterior({ showDetails }: { showDetails: boolean }) {
  const candleSpots: Array<[number, number, number]> = [
    [-45, 0.9, 54], [45, 0.9, 54], [-45, 0.9, 18], [45, 0.9, 18],
    [-45, 0.9, -18], [45, 0.9, -18], [-28, 0.9, -66], [28, 0.9, -66],
    [-104, 0.9, 34], [104, 0.9, 34], [-104, 0.9, -34], [104, 0.9, -34],
    [-6, 1.3, -66], [6, 1.3, -66],
  ];
  const sideWingPews = getChapelSideWingPewLayout();

  return (
    <group name="graveyard-chapel-interior">
      <mesh position={[0, 1.02, 0]} castShadow={false} receiveShadow>
        <boxGeometry args={[CHAPEL_CENTER_HALF_WIDTH * 2 + 8, 0.18, CHAPEL_CENTER_HALF_DEPTH * 2 - 12]} />
        <meshBasicMaterial color="#242019" />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={`chapel-wing-floor-${side}`} position={[side * CHAPEL_SIDE_WING_CENTER_X, 1.02, 0]} castShadow={false} receiveShadow>
          <boxGeometry args={[CHAPEL_SIDE_WING_HALF_WIDTH * 2 + 6, 0.18, CHAPEL_SIDE_WING_HALF_DEPTH * 2 - 6]} />
          <meshBasicMaterial color="#211d17" />
        </mesh>
      ))}
      {CHAPEL_CENTER_PEW_ROWS.map((z) => (
        <Fragment key={`chapel-pews-${z}`}>
          <ChapelPew side={-1} z={z} />
          <ChapelPew side={1} z={z} />
        </Fragment>
      ))}
      <group name="chapel-side-wing-diagonal-pews">
        {sideWingPews.map((pew) => (
          <ChapelDiagonalPew
            key={`chapel-side-wing-diagonal-pew-${pew.key}`}
            position={[pew.x, 0.96, pew.z]}
            yaw={getYawForPewFacingTarget(pew.x, pew.z, CHAPEL_POPE_TARGET.x, CHAPEL_POPE_TARGET.z)}
            width={pew.width}
          />
        ))}
      </group>
      <group position={[0, 1, -68]}>
        <mesh position={[0, 2.1, 0]} castShadow={false}>
          <boxGeometry args={[18, 3.2, 7.5]} />
          <meshBasicMaterial color="#5b351f" />
        </mesh>
        <mesh position={[0, 4, -0.2]} castShadow={false}>
          <boxGeometry args={[21, 1.2, 8.6]} />
          <meshBasicMaterial color="#7a4928" />
        </mesh>
        {[-7.2, 0, 7.2].map((x, index) => (
          <mesh key={`chapel-altar-grain-${x}`} position={[x, 4.7, 4.18]} castShadow={false}>
            <boxGeometry args={[4.2, 0.22, 0.2]} />
            <meshBasicMaterial color={index % 2 === 0 ? "#b06d36" : "#2a170e"} transparent opacity={0.66} />
          </mesh>
        ))}
        <mesh position={[0, 5.15, 2.2]} rotation={[-0.28, 0, 0]} castShadow={false}>
          <boxGeometry args={[11.5, 0.7, 5.2]} />
          <meshBasicMaterial color="#3c2416" />
        </mesh>
      </group>
      <ChapelWallCross />
      <group position={[30, 1, -54]}>
        <mesh position={[0, 2.0, 0]} castShadow={false}>
          <boxGeometry args={[7.4, 4, 6.4]} />
          <meshBasicMaterial color="#4b2c1a" />
        </mesh>
        <mesh position={[0, 4.5, -0.6]} rotation={[-0.35, 0, 0]} castShadow={false}>
          <boxGeometry args={[8.2, 1, 5.6]} />
          <meshBasicMaterial color="#724526" />
        </mesh>
        {[-2.4, 0, 2.4].map((x) => (
          <mesh key={`chapel-pulpit-grain-${x}`} position={[x, 4.96, 2.02]} castShadow={false}>
            <boxGeometry args={[1.6, 0.18, 0.18]} />
            <meshBasicMaterial color="#af7038" transparent opacity={0.64} />
          </mesh>
        ))}
        <mesh position={[0, 5.25, 1.9]} castShadow={false}>
          <boxGeometry args={[4.2, 0.42, 2.4]} />
          <meshBasicMaterial color="#d6c28a" />
        </mesh>
      </group>
      {showDetails && (
        <>
          <ChapelPewNpcs />
          <ChapelSideWingPewNpcs pews={sideWingPews} />
          <ChapelPopeAtPulpit />
          {candleSpots.map((position, index) => (
            <ChapelCandle key={`chapel-candle-${index}`} position={position} scale={index > 7 ? 1.28 : 1} light={false} />
          ))}
          <ChapelChandelier z={-48} />
          <ChapelChandelier z={0} light />
          <ChapelChandelier z={42} />
        </>
      )}
    </group>
  );
}

function ChapelWatchTower({
  position,
  stoneMap,
  darkStoneMap,
}: {
  position: [number, number, number];
  stoneMap: THREE.Texture;
  darkStoneMap: THREE.Texture;
}) {
  return (
    <group name="chapel-corner-watch-tower" position={position}>
      <mesh castShadow={false} receiveShadow>
        <cylinderGeometry args={[CHAPEL_WATCH_TOWER_RADIUS, CHAPEL_WATCH_TOWER_RADIUS + 1.4, CHAPEL_WATCH_TOWER_HEIGHT, 8]} />
        <meshBasicMaterial map={stoneMap} />
      </mesh>
      <mesh position={[0, CHAPEL_WATCH_TOWER_HEIGHT * 0.5 + 1.65, 0]} castShadow={false} receiveShadow>
        <cylinderGeometry args={[CHAPEL_WATCH_TOWER_RADIUS + 2.2, CHAPEL_WATCH_TOWER_RADIUS + 2.2, 3.3, 8]} />
        <meshBasicMaterial map={darkStoneMap} />
      </mesh>
      {getCachedIndexRange(8).map((index) => {
        const angle = (index / 8) * Math.PI * 2;
        return (
          <mesh
            key={`chapel-watch-tower-crenel-${index}`}
            position={[
              Math.sin(angle) * (CHAPEL_WATCH_TOWER_RADIUS + 1.9),
              CHAPEL_WATCH_TOWER_HEIGHT * 0.5 + 5.4,
              Math.cos(angle) * (CHAPEL_WATCH_TOWER_RADIUS + 1.9),
            ]}
            rotation={[0, angle, 0]}
            castShadow={false}
            receiveShadow
          >
            <boxGeometry args={[3.1, 4.7, 2.4]} />
            <meshBasicMaterial map={darkStoneMap} />
          </mesh>
        );
      })}
      <mesh position={[0, CHAPEL_WATCH_TOWER_HEIGHT * 0.5 + 12, 0]} rotation={[0, Math.PI / 4, 0]} castShadow={false}>
        <coneGeometry args={[CHAPEL_WATCH_TOWER_RADIUS + 1.2, 12.8, 4]} />
        <meshBasicMaterial color="#0d0a0f" />
      </mesh>
      {[-1, 1].map((side) => (
        <Fragment key={`chapel-watch-tower-arrow-slit-${side}`}>
          <mesh position={[side * 5.2, 4.8, CHAPEL_WATCH_TOWER_RADIUS + 0.08]} castShadow={false}>
            <boxGeometry args={[1.2, 9.8, 0.22]} />
            <meshBasicMaterial color="#09070a" />
          </mesh>
          <mesh position={[CHAPEL_WATCH_TOWER_RADIUS + 0.08, 4.8, side * 5.2]} castShadow={false}>
            <boxGeometry args={[0.22, 9.8, 1.2]} />
            <meshBasicMaterial color="#09070a" />
          </mesh>
        </Fragment>
      ))}
    </group>
  );
}

function ChapelGargoyle({
  position,
  yaw,
  scale = 1,
}: {
  position: [number, number, number];
  yaw: number;
  scale?: number;
}) {
  return (
    <group name="chapel-roof-gargoyle" position={position} rotation={[0, yaw, 0]} scale={[scale, scale, scale]}>
      <mesh position={[0, 0.7, 0]} rotation={[-0.18, 0, 0]} castShadow={false}>
        <boxGeometry args={[2.3, 1.65, 3]} />
        <meshBasicMaterial color="#313039" />
      </mesh>
      <mesh position={[0, 1.72, 1.26]} castShadow={false}>
        <boxGeometry args={[1.55, 1.25, 1.45]} />
        <meshBasicMaterial color="#3c3a43" />
      </mesh>
      <mesh position={[0, 1.58, 2.1]} castShadow={false}>
        <boxGeometry args={[0.9, 0.55, 1]} />
        <meshBasicMaterial color="#232129" />
      </mesh>
      {[-1, 1].map((side) => (
        <Fragment key={`chapel-gargoyle-side-${side}`}>
          <mesh position={[side * 1.38, 1.05, -0.24]} rotation={[0.18, 0, side * 0.72]} castShadow={false}>
            <boxGeometry args={[0.42, 2.5, 2.6]} />
            <meshBasicMaterial color="#27262e" />
          </mesh>
          <mesh position={[side * 0.54, 2.42, 1.45]} rotation={[0, 0, side * 0.58]} castShadow={false}>
            <coneGeometry args={[0.34, 1.15, 4]} />
            <meshBasicMaterial color="#191820" />
          </mesh>
          <mesh position={[side * 0.66, -0.16, 0.96]} rotation={[0.28, 0, side * 0.2]} castShadow={false}>
            <boxGeometry args={[0.52, 1.2, 0.5]} />
            <meshBasicMaterial color="#1f1e25" />
          </mesh>
        </Fragment>
      ))}
      <mesh position={[0, 0.38, -1.96]} rotation={[-0.55, 0, 0]} castShadow={false}>
        <coneGeometry args={[0.42, 2.4, 5]} />
        <meshBasicMaterial color="#24232b" />
      </mesh>
      <mesh position={[0, 2.04, 2.85]} rotation={[Math.PI / 2, 0, 0]} castShadow={false}>
        <coneGeometry args={[0.28, 1.5, 6]} />
        <meshBasicMaterial color="#18171d" />
      </mesh>
    </group>
  );
}

function ChapelDoorKnocker({ x = 0 }: { x?: number }) {
  return (
    <group position={[x, 1.4, 0.68]}>
      <mesh position={[0, 1.34, 0]} scale={[1.05, 0.82, 0.2]} castShadow={false}>
        <sphereGeometry args={[0.78, 12, 8]} />
        <meshBasicMaterial color="#a66f2f" />
      </mesh>
      <mesh position={[0, 1.36, 0.16]} scale={[0.58, 0.36, 0.16]} castShadow={false}>
        <sphereGeometry args={[0.7, 10, 6]} />
        <meshBasicMaterial color="#d19a45" />
      </mesh>
      <mesh position={[0, 0.9, 0.22]} scale={[0.5, 0.22, 0.12]} castShadow={false}>
        <sphereGeometry args={[0.62, 10, 6]} />
        <meshBasicMaterial color="#6b421e" />
      </mesh>
      {[-1, 1].map((side) => (
        <Fragment key={`chapel-lion-knocker-ear-${side}`}>
          <mesh position={[side * 0.52, 1.88, 0.08]} rotation={[0, 0, side * 0.46]} castShadow={false}>
            <coneGeometry args={[0.24, 0.7, 4]} />
            <meshBasicMaterial color="#7e5228" />
          </mesh>
          <mesh position={[side * 0.22, 1.48, 0.34]} castShadow={false}>
            <boxGeometry args={[0.12, 0.12, 0.08]} />
            <meshBasicMaterial color="#1b1008" />
          </mesh>
        </Fragment>
      ))}
      <mesh position={[0, -0.36, 0.14]} rotation={[0, 0, Math.PI]} castShadow={false}>
        <torusGeometry args={[1.02, 0.12, 8, 18, Math.PI]} />
        <meshBasicMaterial color="#c68a35" />
      </mesh>
      <mesh position={[0, 0.2, 0.17]} castShadow={false}>
        <boxGeometry args={[0.42, 0.34, 0.16]} />
        <meshBasicMaterial color="#7a4b21" />
      </mesh>
    </group>
  );
}

function ChapelDoubleDoor({
  position,
  yaw,
  width,
  height = 22,
}: {
  position: [number, number, number];
  yaw: number;
  width: number;
  height?: number;
}) {
  const panelWidth = width * 0.48;
  const panelHeight = height;
  const hingeInset = panelWidth * 0.5;

  return (
    <group name="chapel-open-double-door" position={position} rotation={[0, yaw, 0]}>
      {[-1, 1].map((side) => (
        <group
          key={`chapel-door-panel-${side}`}
          position={[side * (width * 0.5 - 0.7), 1.2 + panelHeight * 0.5, 0.65]}
          rotation={[0, side * -0.44, 0]}
        >
          <mesh position={[side * -hingeInset * 0.45, 0, 0]} castShadow={false} receiveShadow>
            <boxGeometry args={[panelWidth, panelHeight, 1.05]} />
            <meshBasicMaterial color="#5b351f" />
          </mesh>
          {[-0.24, 0.24].map((offset) => (
            <mesh key={`chapel-door-plank-${offset}`} position={[side * (-hingeInset * 0.45 + offset * panelWidth), 0, 0.58]} castShadow={false}>
              <boxGeometry args={[0.28, panelHeight - 1.8, 0.18]} />
              <meshBasicMaterial color="#7a4928" transparent opacity={0.76} />
            </mesh>
          ))}
          {[-0.34, 0.34].map((yOffset) => (
            <mesh key={`chapel-door-strap-${yOffset}`} position={[side * -hingeInset * 0.45, yOffset * panelHeight, 0.7]} castShadow={false}>
              <boxGeometry args={[panelWidth - 1.5, 0.52, 0.24]} />
              <meshBasicMaterial color="#1c1410" />
            </mesh>
          ))}
          <mesh position={[side * -hingeInset * 0.9, 0, 0.78]} castShadow={false}>
            <boxGeometry args={[0.5, panelHeight + 1.2, 0.34]} />
            <meshBasicMaterial color="#24150d" />
          </mesh>
          <ChapelDoorKnocker x={side * -hingeInset * 0.42} />
        </group>
      ))}
    </group>
  );
}

function ChapelCeiling({ darkStoneMap }: { darkStoneMap: THREE.Texture }) {
  const naveBeamRows = [-66, -44, -22, 0, 22, 44, 66];
  const wingBeamRows = [-42, -21, 0, 21, 42];

  return (
    <group name="chapel-roof-and-ceiling-fill">
      <mesh position={[0, CHAPEL_WALL_HEIGHT + 0.6, 0]} castShadow={false} receiveShadow>
        <boxGeometry args={[CHAPEL_CENTER_HALF_WIDTH * 2 - 5, 2.4, CHAPEL_CENTER_HALF_DEPTH * 2 - 6]} />
        <meshBasicMaterial map={darkStoneMap} side={THREE.DoubleSide} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={`chapel-wing-ceiling-${side}`} position={[side * CHAPEL_SIDE_WING_CENTER_X, CHAPEL_WALL_HEIGHT + 0.3, 0]} castShadow={false} receiveShadow>
          <boxGeometry args={[CHAPEL_SIDE_WING_HALF_WIDTH * 2 - 4, 2.1, CHAPEL_SIDE_WING_HALF_DEPTH * 2 - 5]} />
          <meshBasicMaterial map={darkStoneMap} side={THREE.DoubleSide} />
        </mesh>
      ))}
      {naveBeamRows.map((z, index) => (
        <mesh key={`chapel-nave-ceiling-beam-${z}`} position={[0, CHAPEL_WALL_HEIGHT - 1.15, z]} castShadow={false}>
          <boxGeometry args={[CHAPEL_CENTER_HALF_WIDTH * 2 - 8, 2.1, 1.8]} />
          <meshBasicMaterial color={index % 2 === 0 ? "#171017" : "#241821"} />
        </mesh>
      ))}
      {[-1, 1].flatMap((side) => wingBeamRows.map((z, index) => (
        <mesh key={`chapel-wing-ceiling-beam-${side}-${z}`} position={[side * CHAPEL_SIDE_WING_CENTER_X, CHAPEL_WALL_HEIGHT - 1.35, z]} castShadow={false}>
          <boxGeometry args={[CHAPEL_SIDE_WING_HALF_WIDTH * 2 - 8, 1.7, 1.55]} />
          <meshBasicMaterial color={index % 2 === 0 ? "#171017" : "#241821"} />
        </mesh>
      )))}
      <mesh position={[0, CHAPEL_WALL_HEIGHT - 0.2, 0]} castShadow={false}>
        <boxGeometry args={[3.4, 3, CHAPEL_CENTER_HALF_DEPTH * 2 - 10]} />
        <meshBasicMaterial color="#100b10" />
      </mesh>
      <mesh position={[0, CHAPEL_WALL_HEIGHT - 0.35, 0]} castShadow={false}>
        <boxGeometry args={[CHAPEL_OUTER_HALF_WIDTH * 2 - 18, 2.6, 3.2]} />
        <meshBasicMaterial color="#100b10" />
      </mesh>
    </group>
  );
}

function GraveyardCatholicChapel({ baseHeight, showDetails }: { baseHeight: number; showDetails: boolean }) {
  const roof = "#171319";
  const chapelStoneTexture = useMemo(
    () => createChapelStoneBrickTexture({
      base: "#46454d",
      mid: "#535159",
      light: "#5d5a63",
      mortar: "#1b1a20",
      highlight: "#8d8780",
      shadow: "#2b2a30",
      chip: "#706b67",
      repeatX: 3,
      repeatY: 2,
    }),
    [],
  );
  const chapelDarkStoneTexture = useMemo(
    () => createChapelStoneBrickTexture({
      base: "#292830",
      mid: "#33323a",
      light: "#3b3942",
      mortar: "#0f0e13",
      highlight: "#625e5a",
      shadow: "#16151b",
      chip: "#4a4744",
      repeatX: 2,
      repeatY: 3,
    }),
    [],
  );
  useEffect(() => () => {
    chapelStoneTexture.dispose();
    chapelDarkStoneTexture.dispose();
  }, [chapelDarkStoneTexture, chapelStoneTexture]);

  return (
    <group name="giant-catholic-chapel" position={[0, baseHeight, 0]}>
      <mesh position={[0, 0.48, 0]} castShadow={false} receiveShadow>
        <boxGeometry args={[CHAPEL_CENTER_HALF_WIDTH * 2 + 10, 0.96, CHAPEL_CENTER_HALF_DEPTH * 2 + 8]} />
        <meshBasicMaterial color="#17141a" />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={`chapel-wing-foundation-${side}`} position={[side * CHAPEL_SIDE_WING_CENTER_X, 0.44, 0]} castShadow={false} receiveShadow>
          <boxGeometry args={[CHAPEL_SIDE_WING_HALF_WIDTH * 2 + 10, 0.88, CHAPEL_SIDE_WING_HALF_DEPTH * 2 + 8]} />
          <meshBasicMaterial color="#161319" />
        </mesh>
      ))}
      <ChapelInterior showDetails={showDetails} />
      {getChapelWallSegments().map((wall) => (
        <mesh key={`chapel-wall-${wall.key}`} position={wall.position} castShadow={false} receiveShadow>
          <boxGeometry args={wall.size} />
          <meshBasicMaterial map={chapelStoneTexture} />
        </mesh>
      ))}
      <ChapelCeiling darkStoneMap={chapelDarkStoneTexture} />
      <mesh position={[0, 39.2, 0]} rotation={[0, Math.PI / 4, 0]} castShadow={false}>
        <coneGeometry args={[82, 23, 4]} />
        <meshBasicMaterial color={roof} side={THREE.DoubleSide} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={`chapel-wing-roof-${side}`} position={[side * CHAPEL_SIDE_WING_CENTER_X, 31.8, 0]} rotation={[0, Math.PI / 4, 0]} castShadow={false}>
          <coneGeometry args={[49, 16, 4]} />
          <meshBasicMaterial color="#141016" side={THREE.DoubleSide} />
        </mesh>
      ))}
      {CHAPEL_WATCH_TOWER_POSITIONS.map((position, index) => (
        <ChapelWatchTower
          key={`chapel-corner-watch-tower-${index}`}
          position={position}
          stoneMap={chapelStoneTexture}
          darkStoneMap={chapelDarkStoneTexture}
        />
      ))}
      {[-1, 1].map((side) => (
        <Fragment key={`chapel-tower-side-${side}`}>
          <mesh position={[side * 17.3, 33.2, CHAPEL_CENTER_HALF_DEPTH - 20]} castShadow={false} receiveShadow>
            <boxGeometry args={[2.6, 66.4, 42]} />
            <meshBasicMaterial map={chapelDarkStoneTexture} />
          </mesh>
          <mesh position={[side * 13.7, 33.2, CHAPEL_CENTER_HALF_DEPTH - 3.5]} castShadow={false} receiveShadow>
            <boxGeometry args={[5.4, 66.4, 2.6]} />
            <meshBasicMaterial map={chapelDarkStoneTexture} />
          </mesh>
        </Fragment>
      ))}
      <mesh position={[0, 46.4, CHAPEL_CENTER_HALF_DEPTH - 3.5]} castShadow={false} receiveShadow>
        <boxGeometry args={[22, 40, 2.6]} />
        <meshBasicMaterial map={chapelDarkStoneTexture} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={`chapel-tower-rear-pier-${side}`} position={[side * 13.7, 33.2, CHAPEL_CENTER_HALF_DEPTH - 40.5]} castShadow={false} receiveShadow>
          <boxGeometry args={[5.4, 66.4, 2.4]} />
          <meshBasicMaterial map={chapelDarkStoneTexture} />
        </mesh>
      ))}
      <mesh position={[0, 46.4, CHAPEL_CENTER_HALF_DEPTH - 40.5]} castShadow={false} receiveShadow>
        <boxGeometry args={[22, 40, 2.4]} />
        <meshBasicMaterial map={chapelDarkStoneTexture} />
      </mesh>
      <mesh position={[0, 72.5, CHAPEL_CENTER_HALF_DEPTH - 20]} rotation={[0, Math.PI / 4, 0]} castShadow={false}>
        <coneGeometry args={[22, 34, 4]} />
        <meshBasicMaterial color="#0e0b10" />
      </mesh>
      <mesh position={[0, 96.2, CHAPEL_CENTER_HALF_DEPTH - 20]} castShadow={false}>
        <boxGeometry args={[2.4, 22, 2.4]} />
        <meshBasicMaterial color="#050505" />
      </mesh>
      <mesh position={[0, 100.8, CHAPEL_CENTER_HALF_DEPTH - 20]} castShadow={false}>
        <boxGeometry args={[13.5, 2.4, 2.4]} />
        <meshBasicMaterial color="#050505" />
      </mesh>
      {[
        { key: "south", position: [0, 12.4, CHAPEL_CENTER_HALF_DEPTH + 0.85] as [number, number, number], rotation: [0, 0, 0] as [number, number, number], size: [CHAPEL_EXIT_HALF_WIDTH * 2 - 3, 24, 0.32] as [number, number, number] },
        { key: "north-west", position: [-CHAPEL_REAR_EXIT_CENTER_X, 12.4, -(CHAPEL_CENTER_HALF_DEPTH + 0.85)] as [number, number, number], rotation: [0, Math.PI, 0] as [number, number, number], size: [CHAPEL_REAR_EXIT_HALF_WIDTH * 2, 21, 0.32] as [number, number, number] },
        { key: "north-east", position: [CHAPEL_REAR_EXIT_CENTER_X, 12.4, -(CHAPEL_CENTER_HALF_DEPTH + 0.85)] as [number, number, number], rotation: [0, Math.PI, 0] as [number, number, number], size: [CHAPEL_REAR_EXIT_HALF_WIDTH * 2, 21, 0.32] as [number, number, number] },
        { key: "east", position: [CHAPEL_OUTER_HALF_WIDTH + 0.85, 12.4, 0] as [number, number, number], rotation: [0, Math.PI / 2, 0] as [number, number, number], size: [CHAPEL_SIDE_EXIT_HALF_WIDTH * 2 - 2, 20, 0.32] as [number, number, number] },
        { key: "west", position: [-(CHAPEL_OUTER_HALF_WIDTH + 0.85), 12.4, 0] as [number, number, number], rotation: [0, -Math.PI / 2, 0] as [number, number, number], size: [CHAPEL_SIDE_EXIT_HALF_WIDTH * 2 - 2, 20, 0.32] as [number, number, number] },
      ].map((door) => (
        <mesh key={`chapel-exit-shadow-${door.key}`} position={door.position} rotation={door.rotation} castShadow={false} renderOrder={2}>
          <boxGeometry args={door.size} />
          <meshBasicMaterial color="#050403" transparent opacity={0.16} depthWrite={false} />
        </mesh>
      ))}
      <ChapelDoubleDoor
        position={[0, 0, CHAPEL_CENTER_HALF_DEPTH + 1.35]}
        yaw={0}
        width={CHAPEL_EXIT_HALF_WIDTH * 2 + 2}
        height={23}
      />
      <ChapelDoubleDoor
        position={[-CHAPEL_REAR_EXIT_CENTER_X, 0, -(CHAPEL_CENTER_HALF_DEPTH + 1.35)]}
        yaw={Math.PI}
        width={CHAPEL_REAR_EXIT_HALF_WIDTH * 2 + 2}
        height={21}
      />
      <ChapelDoubleDoor
        position={[CHAPEL_REAR_EXIT_CENTER_X, 0, -(CHAPEL_CENTER_HALF_DEPTH + 1.35)]}
        yaw={Math.PI}
        width={CHAPEL_REAR_EXIT_HALF_WIDTH * 2 + 2}
        height={21}
      />
      <ChapelDoubleDoor
        position={[CHAPEL_OUTER_HALF_WIDTH + 1.35, 0, 0]}
        yaw={Math.PI / 2}
        width={CHAPEL_SIDE_EXIT_HALF_WIDTH * 2 + 1}
        height={21}
      />
      <ChapelDoubleDoor
        position={[-(CHAPEL_OUTER_HALF_WIDTH + 1.35), 0, 0]}
        yaw={-Math.PI / 2}
        width={CHAPEL_SIDE_EXIT_HALF_WIDTH * 2 + 1}
        height={21}
      />
      {CHAPEL_EXIT_RAMP_DEFINITIONS.map((exit) => (
        <group key={`chapel-entry-ramp-${exit.key}`} position={exit.position} rotation={[0, exit.rotation, 0]}>
          <ChapelEntranceStairs axisDistance={exit.distance} width={exit.width} top={exit.top} outset={exit.outset} />
        </group>
      ))}
      <ChapelGiantGothicWindow position={[0, 42.2, CHAPEL_CENTER_HALF_DEPTH + 1.55]} scale={1.2} variant={0} />
      {[-1, 1].map((side) => (
        <ChapelGiantGothicWindow
          key={`chapel-front-giant-window-${side}`}
          position={[side * 35.5, 23.4, CHAPEL_CENTER_HALF_DEPTH + 1.5]}
          scale={0.74}
          variant={side > 0 ? 1 : 2}
        />
      ))}
      <mesh position={[0, 54.8, CHAPEL_CENTER_HALF_DEPTH + 1.36]} castShadow={false}>
        <circleGeometry args={[7.4, 16]} />
        <meshBasicMaterial color="#0f172a" />
      </mesh>
      <mesh position={[0, 54.8, CHAPEL_CENTER_HALF_DEPTH + 1.18]} castShadow={false}>
        <circleGeometry args={[5.6, 16]} />
        <meshBasicMaterial color="#a855f7" transparent opacity={0.84} />
      </mesh>
      <mesh position={[0, 54.8, CHAPEL_CENTER_HALF_DEPTH + 0.94]} castShadow={false}>
        <boxGeometry args={[10.2, 0.62, 0.14]} />
        <meshBasicMaterial color="#fde68a" />
      </mesh>
      <mesh position={[0, 54.8, CHAPEL_CENTER_HALF_DEPTH + 0.9]} castShadow={false}>
        <boxGeometry args={[0.62, 10.2, 0.14]} />
        <meshBasicMaterial color="#fde68a" />
      </mesh>
      <ChapelGiantGothicWindow position={[0, 25.8, -(CHAPEL_CENTER_HALF_DEPTH + 1.5)]} rotation={[0, Math.PI, 0]} scale={1.05} variant={2} />
      {[-1, 1].map((side) => (
        <Fragment key={`chapel-side-${side}`}>
          {[-34, 34].map((z, index) => (
            <ChapelGiantGothicWindow
              key={`chapel-wing-giant-window-${side}-${index}`}
              position={[side * (CHAPEL_OUTER_HALF_WIDTH + 1.55), 24.2, z]}
              rotation={[0, side * Math.PI / 2, 0]}
              scale={0.98}
              variant={index + (side > 0 ? 1 : 0)}
            />
          ))}
          {[-68, 68].map((z, index) => (
            <ChapelGiantGothicWindow
              key={`chapel-nave-giant-window-${side}-${index}`}
              position={[side * (CHAPEL_CENTER_HALF_WIDTH + 1.48), 24.6, z]}
              rotation={[0, side * Math.PI / 2, 0]}
              scale={0.9}
              variant={index + 2}
            />
          ))}
          {[-46, -18, 18, 46].map((z) => (
            <mesh key={`chapel-wing-buttress-${side}-${z}`} position={[side * (CHAPEL_OUTER_HALF_WIDTH + 4), 12.8, z]} castShadow={false}>
              <boxGeometry args={[4.2, 25.6, 6.2]} />
              <meshBasicMaterial map={chapelDarkStoneTexture} />
            </mesh>
          ))}
          {[-72, 72].map((z) => (
            <mesh key={`chapel-central-buttress-${side}-${z}`} position={[side * (CHAPEL_CENTER_HALF_WIDTH + 4), 12.8, z]} castShadow={false}>
              <boxGeometry args={[4.2, 25.6, 6.2]} />
              <meshBasicMaterial map={chapelDarkStoneTexture} />
            </mesh>
          ))}
        </Fragment>
      ))}
      {showDetails && (
        <>
          {CHAPEL_GARGOYLE_POSITIONS.map((gargoyle) => (
            <ChapelGargoyle
              key={`chapel-gargoyle-${gargoyle.key}`}
              position={gargoyle.position}
              yaw={gargoyle.yaw}
              scale={gargoyle.scale}
            />
          ))}
          <ChapelCrack position={[-32, 24, CHAPEL_CENTER_HALF_DEPTH - 3.8]} scale={1.12} />
          <ChapelCrack position={[28, 18, CHAPEL_CENTER_HALF_DEPTH + 1.92]} scale={0.86} />
          <pointLight color="#f8d477" intensity={2.6} distance={52} decay={2} position={[0, 18, CHAPEL_CENTER_HALF_DEPTH - 4]} />
          <pointLight color="#f9cf71" intensity={2.4} distance={64} decay={2} position={[0, 18, -36]} />
        </>
      )}
    </group>
  );
}

function GraveyardVillageColliders({
  chunk,
  baseHeight,
  groundGeometry,
  fenceSegments,
}: {
  chunk: SurvivalChunkInfo;
  baseHeight: number;
  groundGeometry: THREE.BufferGeometry;
  fenceSegments: GraveyardFenceSegment[];
}) {
  const rampColliderGeometry = useMemo(() => makeChapelRampColliderGeometry(baseHeight), [baseHeight]);
  const sideWingPews = useMemo(() => getChapelSideWingPewLayout(), []);
  if (!shouldBuildSurvivalChunkColliders(chunk)) return null;

  return (
    <>
      <RigidBody type="fixed" colliders="trimesh" friction={0.5} restitution={0} position={[chunk.x, 0, chunk.z]}>
        <mesh geometry={groundGeometry} dispose={null}>
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </RigidBody>
      <RigidBody type="fixed" colliders="trimesh" friction={0.82} restitution={0} position={[chunk.x, 0, chunk.z]}>
        <mesh geometry={rampColliderGeometry} dispose={null}>
          <meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      </RigidBody>
      <RigidBody type="fixed" colliders={false} friction={0.55} restitution={0} position={[chunk.x, 0, chunk.z]}>
        <CuboidCollider args={[CHAPEL_CENTER_HALF_WIDTH, 0.58, CHAPEL_CENTER_HALF_DEPTH]} position={[0, baseHeight + 0.56, 0]} />
        <CuboidCollider args={[CHAPEL_SIDE_WING_HALF_WIDTH, 0.56, CHAPEL_SIDE_WING_HALF_DEPTH]} position={[-CHAPEL_SIDE_WING_CENTER_X, baseHeight + 0.54, 0]} />
        <CuboidCollider args={[CHAPEL_SIDE_WING_HALF_WIDTH, 0.56, CHAPEL_SIDE_WING_HALF_DEPTH]} position={[CHAPEL_SIDE_WING_CENTER_X, baseHeight + 0.54, 0]} />
        {CHAPEL_CENTER_PEW_ROWS.flatMap((z) => (
          [-1, 1].map((side) => (
            <CuboidCollider
              key={`chapel-center-pew-collider-${side}-${z}`}
              args={[9.5, 1.75, 2.55]}
              position={[side * CHAPEL_CENTER_PEW_X, baseHeight + 2.65, z + 0.45]}
            />
          ))
        ))}
        {sideWingPews.map((pew) => (
          <CuboidCollider
            key={`chapel-side-pew-collider-${pew.key}`}
            args={[pew.width / 2 + 0.9, 1.75, 2.65]}
            position={[pew.x, baseHeight + 2.65, pew.z]}
            rotation={[0, getYawForPewFacingTarget(pew.x, pew.z, CHAPEL_POPE_TARGET.x, CHAPEL_POPE_TARGET.z), 0]}
          />
        ))}
        <CuboidCollider args={[11.2, 2.9, 4.7]} position={[0, baseHeight + 3.9, -68]} />
        <CuboidCollider args={[4.35, 3.05, 3.45]} position={[30, baseHeight + 4.05, -54]} />
        {getChapelWallSegments().map((wall) => (
          <CuboidCollider
            key={`chapel-wall-collider-${wall.key}`}
            args={[wall.size[0] / 2, wall.size[1] / 2, wall.size[2] / 2]}
            position={[wall.position[0], baseHeight + wall.position[1], wall.position[2]]}
          />
        ))}
        <CuboidCollider args={[1.3, 33.2, 21]} position={[-17.3, baseHeight + 33.2, CHAPEL_CENTER_HALF_DEPTH - 20]} />
        <CuboidCollider args={[1.3, 33.2, 21]} position={[17.3, baseHeight + 33.2, CHAPEL_CENTER_HALF_DEPTH - 20]} />
        <CuboidCollider args={[2.7, 33.2, 1.3]} position={[-13.7, baseHeight + 33.2, CHAPEL_CENTER_HALF_DEPTH - 3.5]} />
        <CuboidCollider args={[2.7, 33.2, 1.3]} position={[13.7, baseHeight + 33.2, CHAPEL_CENTER_HALF_DEPTH - 3.5]} />
        <CuboidCollider args={[2.7, 33.2, 1.2]} position={[-13.7, baseHeight + 33.2, CHAPEL_CENTER_HALF_DEPTH - 40.5]} />
        <CuboidCollider args={[2.7, 33.2, 1.2]} position={[13.7, baseHeight + 33.2, CHAPEL_CENTER_HALF_DEPTH - 40.5]} />
        <CuboidCollider args={[11, 20, 1.3]} position={[0, baseHeight + 46.4, CHAPEL_CENTER_HALF_DEPTH - 3.5]} />
        <CuboidCollider args={[11, 20, 1.2]} position={[0, baseHeight + 46.4, CHAPEL_CENTER_HALF_DEPTH - 40.5]} />
        {fenceSegments.map((segment) => (
          <group key={`${segment.key}-collider`} position={[segment.localX, 0, segment.localZ]} rotation={[0, segment.rotation, 0]}>
            <CuboidCollider args={[(segment.length + 3.2) / 2, 7.2, 1.8]} position={[0, segment.localY + 5.6, 0]} />
          </group>
        ))}
      </RigidBody>
    </>
  );
}

export function SurvivalGraveyardVillage({
  chunk,
  terrainHeightForChunk,
  terrainColorAtWorld,
  villageBaseHeightForChunk,
}: {
  chunk: SurvivalChunkInfo;
  terrainHeightForChunk: SurvivalTerrainHeightForChunk;
  terrainColorAtWorld: SurvivalTerrainColorAtWorld;
  villageBaseHeightForChunk: SurvivalVillageBaseHeightForChunk;
}) {
  const graveyardLoadStage = useGraveyardLoadStage(chunk);
  const baseHeight = useMemo(() => villageBaseHeightForChunk(chunk), [chunk, villageBaseHeightForChunk]);
  const terrainGeometry = useMemo(
    () => makeGraveyardVillageTerrainGeometry(chunk, terrainHeightForChunk, terrainColorAtWorld, villageBaseHeightForChunk),
    [chunk, terrainColorAtWorld, terrainHeightForChunk, villageBaseHeightForChunk],
  );
  const hasTerrainSkirt = shouldRenderSurvivalChunkSkirt(chunk);
  const terrainSkirtGeometry = useMemo(
    () => hasTerrainSkirt
      ? makeGraveyardVillageTerrainSkirtGeometry(chunk, terrainHeightForChunk, terrainColorAtWorld, villageBaseHeightForChunk)
      : null,
    [chunk, hasTerrainSkirt, terrainColorAtWorld, terrainHeightForChunk, villageBaseHeightForChunk],
  );
  const terrainDetailTexture = useMemo(() => getSurvivalTerrainDetailTexture(), []);
  const showNearDetails = chunk.distance === 0;
  const showPathStones = showNearDetails && graveyardLoadStage >= 1;
  const showFenceDetails = showNearDetails && graveyardLoadStage >= 2;
  const showTombDetails = showNearDetails && graveyardLoadStage >= 3;
  const showChapelDetails = showNearDetails && graveyardLoadStage >= 4;
  const showChapelShell = !showNearDetails || graveyardLoadStage >= 2;
  const layout = useMemo(
    () => makeGraveyardLayout(chunk, baseHeight, showPathStones, terrainHeightForChunk),
    [chunk, baseHeight, showPathStones, terrainHeightForChunk],
  );

  useSurvivalFeatureCount("graveyardTombs", chunk.key, showTombDetails ? layout.tombs.length : Math.ceil(layout.tombs.length / 4));
  useSurvivalFeatureCount("graveyardFenceSegments", chunk.key, layout.fenceSegments.length);
  useSurvivalFeatureCount("graveyardPathStones", chunk.key, showPathStones ? layout.pathStones.length : 0);

  return (
    <>
      <GraveyardVillageColliders chunk={chunk} baseHeight={baseHeight} groundGeometry={terrainGeometry} fenceSegments={layout.fenceSegments} />
      <group name={`survival-graveyard-village-${chunk.key}`} position={[chunk.x, 0, chunk.z]}>
        {terrainSkirtGeometry && (
          <mesh geometry={terrainSkirtGeometry} dispose={null}>
            <meshBasicMaterial vertexColors side={THREE.DoubleSide} />
          </mesh>
        )}
        <mesh geometry={terrainGeometry} dispose={null} receiveShadow={showNearDetails}>
          <meshStandardMaterial vertexColors map={terrainDetailTexture} roughness={1} metalness={0} />
        </mesh>
        <GraveyardPathStones stones={layout.pathStones} showDetails={showPathStones} />
        <GraveyardSpikedFence segments={layout.fenceSegments} showDetails={showFenceDetails} />
        <GraveyardTombs tombs={layout.tombs} showDetails={showTombDetails} />
        {showChapelShell && <GraveyardCatholicChapel baseHeight={baseHeight} showDetails={showChapelDetails} />}
      </group>
    </>
  );
}

