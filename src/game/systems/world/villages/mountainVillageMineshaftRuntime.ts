import {
  MOUNTAIN_VILLAGE_MINESHAFT_EXIT_BRIDGE_END_RADIUS,
  MOUNTAIN_VILLAGE_MINESHAFT_EXIT_BRIDGE_START_RADIUS,
  MOUNTAIN_VILLAGE_MINESHAFT_GOLDEN_ANGLE,
  MOUNTAIN_VILLAGE_MINESHAFT_HOLE_RADIUS,
  MOUNTAIN_VILLAGE_MINESHAFT_BANQUET_CHAIR_ANGLES,
  MOUNTAIN_VILLAGE_MINESHAFT_BANQUET_CHAIR_RADIUS,
  MOUNTAIN_VILLAGE_MINESHAFT_BANQUET_TABLE_RADIUS,
  MOUNTAIN_VILLAGE_MINESHAFT_BOTTOM_LIGHT_COUNT,
  MOUNTAIN_VILLAGE_MINESHAFT_BOTTOM_LIGHT_RADIUS,
  MOUNTAIN_VILLAGE_MINESHAFT_RIM_OUTER_RADIUS,
  MOUNTAIN_VILLAGE_MINESHAFT_WALL_FIBONACCI_SEQUENCE,
  MOUNTAIN_VILLAGE_MINESHAFT_WALL_LANTERN_COUNT,
  MOUNTAIN_VILLAGE_MINESHAFT_WALL_PAINTING_COUNT,
} from "./mountainVillageTerrain";
import { lerpNumber, survivalHash01 } from "../survival/survivalMath";

type MountainMineshaftLandingHut = {
  localX: number;
  localZ: number;
  rotation: number;
};

type MountainMineshaftLandingLadder = {
  localX: number;
  localZ: number;
};

export type MountainMineshaftPlatformPiece = {
  key: string;
  centerX: number;
  width: number;
};

export type MountainMineshaftExitBridgeFrame = {
  angle: number;
  length: number;
  x: number;
  z: number;
};

export type MountainMineshaftExitBridgeEdgeShadow = {
  side: -1 | 1;
  position: [number, number, number];
};

export type MountainMineshaftExitBridgeGap = {
  index: number;
  z: number;
};

export type MountainMineshaftExitBridgePlank = {
  index: number;
  z: number;
  color: string;
};

export type MountainMineshaftExitBridgePost = {
  index: number;
  side: -1 | 1;
  position: [number, number, number];
  color: string;
};

export type MountainMineshaftExitBridgeSideRail = {
  side: -1 | 1;
  position: [number, number, number];
  posts: MountainMineshaftExitBridgePost[];
};

export type MountainMineshaftExitBridgeSupport = {
  key: string;
  position: [number, number, number];
  rotation: [number, number, number];
};

export type MountainMineshaftExitBridgeDetails = {
  supportLength: number;
  edgeShadows: MountainMineshaftExitBridgeEdgeShadow[];
  darkGaps: MountainMineshaftExitBridgeGap[];
  planks: MountainMineshaftExitBridgePlank[];
  sideRails: MountainMineshaftExitBridgeSideRail[];
  supports: MountainMineshaftExitBridgeSupport[];
  lanternPosition: [number, number, number];
};

export type MountainMineshaftLadderRung = {
  index: number;
  position: [number, number, number];
  color: string;
};

export type MountainMineshaftLadderWrap = {
  index: number;
  leftPosition: [number, number, number];
  rightPosition: [number, number, number];
  color: string;
};

export type MountainMineshaftLadderEdge = {
  index: number;
  position: [number, number, number];
};

export type MountainMineshaftLadderDetails = {
  rungCount: number;
  wrapCount: number;
  rungs: MountainMineshaftLadderRung[];
  wraps: MountainMineshaftLadderWrap[];
  brightEdges: MountainMineshaftLadderEdge[];
  darkEdges: MountainMineshaftLadderEdge[];
};

export type MountainMineshaftSummitSnowDrift = {
  index: number;
  positionXZ: [number, number];
  yOffset: number;
  rotation: [number, number, number];
  scale: [number, number, number];
  color: string;
};

export type MountainMineshaftCatwalkRingPoint = {
  index: number;
  angle: number;
  position: [number, number, number];
  rotation: [number, number, number];
};

export type MountainMineshaftCatwalkLightPole = MountainMineshaftCatwalkRingPoint;

export type MountainMineshaftRimBeam = {
  index: number;
  angle: number;
  x: number;
  z: number;
  rotation: [number, number, number];
};

export type MountainMineshaftBottomRock = {
  index: number;
  angle: number;
  x: number;
  z: number;
  rotation: [number, number, number];
  scale: [number, number, number];
  color: string;
};

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

export type MountainMineshaftBottomLightDescriptor = {
  index: number;
  position: [number, number, number];
  rotation: [number, number, number];
  bodyColor: string;
  withLight: boolean;
};

export type MountainMineshaftBanquetChairDescriptor = {
  index: number;
  position: [number, number, number];
  rotation: [number, number, number];
  seatColor: string;
};

export type MountainMineshaftTablePlankDescriptor = {
  index: number;
  z: number;
  width: number;
  color: string;
};

export type MountainMineshaftTableLegDescriptor = {
  index: number;
  position: [number, number, number];
};

export type MountainMineshaftBreadDescriptor = {
  index: number;
  position: [number, number, number];
  rotation: [number, number, number];
  color: string;
};

export type MountainMineshaftFruitDescriptor = {
  index: number;
  position: [number, number, number];
  color: string;
};

export type MountainMineshaftFruitBowlDescriptor = {
  index: number;
  position: [number, number, number];
  fruits: MountainMineshaftFruitDescriptor[];
};

export type MountainMineshaftPlateDescriptor = {
  index: number;
  position: [number, number, number];
  rotation: [number, number, number];
  foodColor: string;
};

export type MountainMineshaftCandleDescriptor = {
  index: number;
  position: [number, number, number];
};

export type MountainMineshaftBanquetTableDescriptors = {
  radius: number;
  planks: MountainMineshaftTablePlankDescriptor[];
  legs: MountainMineshaftTableLegDescriptor[];
  breads: MountainMineshaftBreadDescriptor[];
  fruitBowls: MountainMineshaftFruitBowlDescriptor[];
  plates: MountainMineshaftPlateDescriptor[];
  candles: MountainMineshaftCandleDescriptor[];
};

export type MountainMineshaftRoyalBanquetDescriptors = {
  bottomLights: MountainMineshaftBottomLightDescriptor[];
  chairs: MountainMineshaftBanquetChairDescriptor[];
  table: MountainMineshaftBanquetTableDescriptors;
};

export type MountainMineshaftCatwalkDescriptors = {
  centerGuardPostCount: number;
  centerGuardRailRadius: number;
  centerGuardRailSegmentLength: number;
  lightPoleRadius: number;
  planks: MountainMineshaftCatwalkRingPoint[];
  darkGaps: MountainMineshaftCatwalkRingPoint[];
  edgeBlocks: MountainMineshaftCatwalkRingPoint[];
  guardPosts: MountainMineshaftCatwalkRingPoint[];
  railSegments: MountainMineshaftCatwalkRingPoint[];
};

export type MountainMineshaftSupportPostDescriptor = {
  side: -1 | 1;
  positionOffset: [number, number, number];
  rotation: [number, number, number];
};

export type MountainMineshaftSupportSnowCapDescriptor = {
  side: -1 | 1;
  position: [number, number, number];
};

export type MountainMineshaftSupportFrame = {
  index: number;
  angle: number;
  rotation: [number, number, number];
  posts: MountainMineshaftSupportPostDescriptor[];
  topBeamPositionOffset: [number, number, number];
  snowCaps: MountainMineshaftSupportSnowCapDescriptor[];
};

const catwalkDescriptorCache = new Map<string, MountainMineshaftCatwalkDescriptors>();
const catwalkLightPoleCache = new Map<string, MountainMineshaftCatwalkLightPole[]>();
const exitBridgeDetailCache = new Map<string, MountainMineshaftExitBridgeDetails>();
const ladderDetailCache = new Map<string, MountainMineshaftLadderDetails>();
const summitSnowDriftCache = new Map<string, MountainMineshaftSummitSnowDrift[]>();
const rimBeamCache = new Map<string, MountainMineshaftRimBeam[]>();
const supportFrameCache = new Map<string, MountainMineshaftSupportFrame[]>();
const bottomRockCache = new Map<string, MountainMineshaftBottomRock[]>();
const wallDecorCache = new Map<string, MountainMineshaftWallDecorDescriptors>();
let royalBanquetDescriptorCache: MountainMineshaftRoyalBanquetDescriptors | null = null;

const MOUNTAIN_MINESHAFT_BRIDGE_SIDES = [-1, 1] as const;
const MOUNTAIN_MINESHAFT_SUPPORT_SIDES = [-1, 1] as const;
const MOUNTAIN_MINESHAFT_BOTTOM_ROCK_COLORS = ["#4b4237", "#2f2b27", "#66533c"];
const MOUNTAIN_MINESHAFT_ROPE_LIGHT_GLOW_COLORS = ["#fff0a8", "#ffd56f", "#ffb65b", "#ff8a3a"];
const MOUNTAIN_MINESHAFT_BANQUET_BREAD_POSITIONS = [
  { x: -2.9, z: -1.3 },
  { x: 2.65, z: 1.45 },
  { x: -0.9, z: 3.2 },
  { x: 1.34, z: -3.1 },
] as const;
const MOUNTAIN_MINESHAFT_FRUIT_BOWL_POSITIONS = [
  { x: -3.7, z: 1.7 },
  { x: 3.55, z: -1.55 },
  { x: 0.8, z: 3.9 },
  { x: -1.2, z: -3.75 },
] as const;
const MOUNTAIN_MINESHAFT_FRUIT_COLORS = ["#b7202e", "#d6a43e", "#7aa34b", "#8a2b5f", "#efc55b"];
const MOUNTAIN_MINESHAFT_TABLE_CANDLE_POSITIONS = [
  { x: -1.8, z: 2.2 },
  { x: 1.8, z: -2.2 },
] as const;
const MOUNTAIN_MINESHAFT_BANQUET_PLATE_ANGLES = [
  ...MOUNTAIN_VILLAGE_MINESHAFT_BANQUET_CHAIR_ANGLES,
  Math.PI,
] as const;

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getRingPoint(index: number, angle: number, radius: number, y: number): MountainMineshaftCatwalkRingPoint {
  return {
    index,
    angle,
    position: [Math.sin(angle) * radius, y, Math.cos(angle) * radius],
    rotation: [0, angle, 0],
  };
}

export function getMountainMineshaftLadderLandingLocalX(
  hut: MountainMineshaftLandingHut,
  ladder?: MountainMineshaftLandingLadder,
) {
  if (!ladder) return null;

  const dx = ladder.localX - hut.localX;
  const dz = ladder.localZ - hut.localZ;
  const cos = Math.cos(hut.rotation);
  const sin = Math.sin(hut.rotation);

  return dx * cos - dz * sin;
}

export function getMountainMineshaftPlatformPieces(
  width: number,
  gapCenterX: number | null,
  gapWidth: number,
): MountainMineshaftPlatformPiece[] {
  if (gapCenterX === null) {
    return [{ key: "full", centerX: 0, width }];
  }

  const halfWidth = width / 2;
  const halfGap = gapWidth / 2;
  const gapMin = clampNumber(gapCenterX - halfGap, -halfWidth, halfWidth);
  const gapMax = clampNumber(gapCenterX + halfGap, -halfWidth, halfWidth);
  const pieces: MountainMineshaftPlatformPiece[] = [];

  if (gapMin > -halfWidth + 0.35) {
    const pieceWidth = gapMin + halfWidth;
    pieces.push({ key: "left", centerX: -halfWidth + pieceWidth / 2, width: pieceWidth });
  }

  if (gapMax < halfWidth - 0.35) {
    const pieceWidth = halfWidth - gapMax;
    pieces.push({ key: "right", centerX: gapMax + pieceWidth / 2, width: pieceWidth });
  }

  return pieces.length > 0 ? pieces : [{ key: "full", centerX: 0, width }];
}

export function getMountainMineshaftExitBridgeFrame(ladder: { angle: number }): MountainMineshaftExitBridgeFrame {
  const startRadius = MOUNTAIN_VILLAGE_MINESHAFT_EXIT_BRIDGE_START_RADIUS;
  const endRadius = MOUNTAIN_VILLAGE_MINESHAFT_EXIT_BRIDGE_END_RADIUS;
  const centerRadius = (startRadius + endRadius) / 2;
  const length = endRadius - startRadius;

  return {
    angle: ladder.angle,
    length,
    x: Math.sin(ladder.angle) * centerRadius,
    z: Math.cos(ladder.angle) * centerRadius,
  };
}

export function getMountainMineshaftExitBridgeDetails({
  length,
  width,
  plankCount = 9,
}: {
  length: number;
  width: number;
  plankCount?: number;
}): MountainMineshaftExitBridgeDetails {
  const safePlankCount = Math.max(1, Math.floor(plankCount));
  const cacheKey = `${length}:${width}:${safePlankCount}`;
  const cached = exitBridgeDetailCache.get(cacheKey);
  if (cached) return cached;

  const supportLength = width * 0.76;
  const edgeShadows = MOUNTAIN_MINESHAFT_BRIDGE_SIDES.map((side) => ({
    side,
    position: [side * (width / 2 - 0.34), 0.72, 0] as [number, number, number],
  }));
  const darkGaps = new Array<MountainMineshaftExitBridgeGap>(6);
  for (let index = 0; index < darkGaps.length; index += 1) {
    darkGaps[index] = {
      index,
      z: -length * 0.42 + index * ((length * 0.84) / Math.max(1, darkGaps.length - 1)),
    };
  }

  const planks = new Array<MountainMineshaftExitBridgePlank>(safePlankCount);
  for (let index = 0; index < safePlankCount; index += 1) {
    planks[index] = {
      index,
      z: -length / 2 + (index + 0.5) * (length / safePlankCount),
      color: index % 2 === 0 ? "#9b7448" : "#6e4b2e",
    };
  }

  const sideRails = MOUNTAIN_MINESHAFT_BRIDGE_SIDES.map((side) => ({
    side,
    position: [side * (width / 2 + 0.36), 1.38, 0] as [number, number, number],
    posts: Array.from({ length: 5 }, (_, index) => ({
      index,
      side,
      position: [side * (width / 2 + 0.36), 0.88, -length * 0.38 + index * ((length * 0.76) / 4)] as [number, number, number],
      color: index % 2 === 0 ? "#362315" : "#4e321d",
    })),
  }));

  const supports: MountainMineshaftExitBridgeSupport[] = [
    { key: "front", position: [0, -1.12, -length * 0.26], rotation: [0, 0, 0.22] },
    { key: "back", position: [0, -1.12, length * 0.26], rotation: [0, 0, -0.22] },
  ];
  const details = {
    supportLength,
    edgeShadows,
    darkGaps,
    planks,
    sideRails,
    supports,
    lanternPosition: [0, 1.4, length / 2 - 3.0] as [number, number, number],
  };
  exitBridgeDetailCache.set(cacheKey, details);
  return details;
}

export function getMountainMineshaftLadderDetails({
  height,
  width,
}: {
  height: number;
  width: number;
}): MountainMineshaftLadderDetails {
  const safeHeight = Math.max(4, height);
  const safeWidth = Math.max(0.1, width);
  const cacheKey = `${safeHeight}:${safeWidth}`;
  const cached = ladderDetailCache.get(cacheKey);
  if (cached) return cached;

  const rungCount = Math.max(8, Math.min(48, Math.floor(safeHeight / 3.6)));
  const wrapCount = Math.max(3, Math.min(14, Math.floor(safeHeight / 7.5)));
  const rungs = new Array<MountainMineshaftLadderRung>(rungCount);

  for (let index = 0; index < rungCount; index += 1) {
    rungs[index] = {
      index,
      position: [0, 1.2 + index * ((safeHeight - 2.4) / Math.max(1, rungCount - 1)), 0.14],
      color: index % 2 === 0 ? "#4b3120" : "#5d4028",
    };
  }

  const wraps = new Array<MountainMineshaftLadderWrap>(wrapCount);
  for (let index = 0; index < wrapCount; index += 1) {
    const y = 2 + index * ((safeHeight - 4) / Math.max(1, wrapCount - 1));
    wraps[index] = {
      index,
      leftPosition: [-safeWidth / 2, y, 0.05],
      rightPosition: [safeWidth / 2, y, 0.05],
      color: index % 2 === 0 ? "#a07743" : "#c09351",
    };
  }

  const brightEdgeCount = Math.min(10, Math.floor(rungCount / 2));
  const brightEdges = new Array<MountainMineshaftLadderEdge>(brightEdgeCount);
  for (let index = 0; index < brightEdgeCount; index += 1) {
    const rungIndex = index * 2;
    brightEdges[index] = {
      index,
      position: [0, 1.2 + rungIndex * ((safeHeight - 2.4) / Math.max(1, rungCount - 1)) + 0.12, 0.36],
    };
  }

  const darkEdgeCount = Math.min(12, Math.floor(rungCount / 2));
  const darkEdges = new Array<MountainMineshaftLadderEdge>(darkEdgeCount);
  for (let index = 0; index < darkEdgeCount; index += 1) {
    const rungIndex = index * 2 + 1;
    darkEdges[index] = {
      index,
      position: [0, 1.2 + rungIndex * ((safeHeight - 2.4) / Math.max(1, rungCount - 1)) - 0.12, 0.38],
    };
  }

  const details = {
    rungCount,
    wrapCount,
    rungs,
    wraps,
    brightEdges,
    darkEdges,
  };
  ladderDetailCache.set(cacheKey, details);
  return details;
}

export function getMountainMineshaftSummitSnowDrifts({
  count = 28,
  rimOuterRadius = MOUNTAIN_VILLAGE_MINESHAFT_RIM_OUTER_RADIUS,
}: {
  count?: number;
  rimOuterRadius?: number;
} = {}) {
  const safeCount = Math.max(0, Math.floor(count));
  const cacheKey = `${safeCount}:${rimOuterRadius}`;
  const cached = summitSnowDriftCache.get(cacheKey);
  if (cached) return cached;

  const drifts = new Array<MountainMineshaftSummitSnowDrift>(safeCount);
  for (let index = 0; index < safeCount; index += 1) {
    const angle = (index * Math.PI * 2) / safeCount + Math.sin(index * 1.83) * 0.14;
    const radius = rimOuterRadius + 9 + (index % 5) * 7.2 + Math.sin(index * 2.4) * 2.1;
    drifts[index] = {
      index,
      positionXZ: [Math.sin(angle) * radius, Math.cos(angle) * radius],
      yOffset: 0.84,
      rotation: [-Math.PI / 2, 0, angle],
      scale: [4.4 + (index % 4) * 1.7, 1.9 + (index % 3) * 0.85, 1],
      color: index % 2 === 0 ? "#f8fdff" : "#cdeafa",
    };
  }
  summitSnowDriftCache.set(cacheKey, drifts);
  return drifts;
}

export function getMountainMineshaftCatwalkDescriptors({
  segments,
  innerRadius,
  outerRadius,
}: {
  segments: number;
  innerRadius: number;
  outerRadius: number;
}): MountainMineshaftCatwalkDescriptors {
  const safeSegments = Math.max(1, Math.floor(segments));
  const cacheKey = `${safeSegments}:${innerRadius}:${outerRadius}`;
  const cached = catwalkDescriptorCache.get(cacheKey);
  if (cached) return cached;

  const plankRadius = (innerRadius + outerRadius) / 2;
  const centerGuardRailRadius = innerRadius + 0.55;
  const centerGuardPostCount = safeSegments * 2;
  const centerGuardRailSegmentLength = ((Math.PI * 2 * centerGuardRailRadius) / centerGuardPostCount) * 0.78;
  const lightPoleRadius = outerRadius + 0.95;
  const planks = new Array<MountainMineshaftCatwalkRingPoint>(safeSegments);
  const darkGaps = new Array<MountainMineshaftCatwalkRingPoint>(safeSegments);
  const edgeBlocks = new Array<MountainMineshaftCatwalkRingPoint>(safeSegments);
  const guardPosts = new Array<MountainMineshaftCatwalkRingPoint>(centerGuardPostCount);
  const railSegments = new Array<MountainMineshaftCatwalkRingPoint>(centerGuardPostCount);

  for (let index = 0; index < safeSegments; index += 1) {
    const centeredAngle = ((index + 0.5) / safeSegments) * Math.PI * 2;
    const gapAngle = (index / safeSegments) * Math.PI * 2;
    planks[index] = getRingPoint(index, centeredAngle, plankRadius, 0.22);
    darkGaps[index] = getRingPoint(index, gapAngle, plankRadius, 0.33);
    edgeBlocks[index] = getRingPoint(index, centeredAngle, centerGuardRailRadius, 0.46);
  }

  for (let index = 0; index < centerGuardPostCount; index += 1) {
    const postAngle = (index / centerGuardPostCount) * Math.PI * 2;
    const railAngle = ((index + 0.5) / centerGuardPostCount) * Math.PI * 2;
    guardPosts[index] = getRingPoint(index, postAngle, centerGuardRailRadius, 1.18);
    railSegments[index] = getRingPoint(index, railAngle, centerGuardRailRadius, 0);
  }

  const descriptors = {
    centerGuardPostCount,
    centerGuardRailRadius,
    centerGuardRailSegmentLength,
    lightPoleRadius,
    planks,
    darkGaps,
    edgeBlocks,
    guardPosts,
    railSegments,
  };
  catwalkDescriptorCache.set(cacheKey, descriptors);
  return descriptors;
}

export function getMountainMineshaftCatwalkLightPoles(hutAngle: number, lightPoleRadius: number) {
  const cacheKey = `${hutAngle}:${lightPoleRadius}`;
  const cached = catwalkLightPoleCache.get(cacheKey);
  if (cached) return cached;

  const lightPoles = new Array<MountainMineshaftCatwalkLightPole>(4);
  for (let index = 0; index < 4; index += 1) {
    const angle = hutAngle + index * Math.PI / 2 + 0.38;
    lightPoles[index] = {
      ...getRingPoint(index, angle, lightPoleRadius, 0.78),
      rotation: [0, angle + Math.PI / 2, 0],
    };
  }
  catwalkLightPoleCache.set(cacheKey, lightPoles);
  return lightPoles;
}

export function getMountainMineshaftRimBeams({
  count,
  holeRadius,
  outerRadius,
}: {
  count: number;
  holeRadius: number;
  outerRadius: number;
}) {
  const safeCount = Math.max(1, Math.floor(count));
  const centerRadius = (holeRadius + outerRadius) / 2;
  const cacheKey = `${safeCount}:${holeRadius}:${outerRadius}`;
  const cached = rimBeamCache.get(cacheKey);
  if (cached) return cached;

  const beams = new Array<MountainMineshaftRimBeam>(safeCount);
  for (let index = 0; index < safeCount; index += 1) {
    const angle = (Math.PI * 2 * index) / safeCount;
    beams[index] = {
      index,
      angle,
      x: Math.sin(angle) * centerRadius,
      z: Math.cos(angle) * centerRadius,
      rotation: [0, angle + Math.PI / 2, 0],
    };
  }
  rimBeamCache.set(cacheKey, beams);
  return beams;
}

export function getMountainMineshaftSupportFrames({ count = 4 }: { count?: number } = {}) {
  const safeCount = Math.max(0, Math.floor(count));
  const cacheKey = `${safeCount}`;
  const cached = supportFrameCache.get(cacheKey);
  if (cached) return cached;

  const frames = new Array<MountainMineshaftSupportFrame>(safeCount);
  for (let index = 0; index < safeCount; index += 1) {
    const angle = (index * Math.PI) / 2 + Math.PI / 4;
    frames[index] = {
      index,
      angle,
      rotation: [0, angle, 0],
      posts: MOUNTAIN_MINESHAFT_SUPPORT_SIDES.map((side) => ({
        side,
        positionOffset: [side * 12, 8.2, 29] as [number, number, number],
        rotation: [0, 0, side * 0.12] as [number, number, number],
      })),
      topBeamPositionOffset: [0, 16.2, 29],
      snowCaps: MOUNTAIN_MINESHAFT_SUPPORT_SIDES.map((side) => ({
        side,
        position: [side * 8.7, 1.32, 0] as [number, number, number],
      })),
    };
  }

  supportFrameCache.set(cacheKey, frames);
  return frames;
}

export function getMountainMineshaftBottomRocks({
  count,
  bottomRadius,
  minRadius = 12.5,
}: {
  count: number;
  bottomRadius: number;
  minRadius?: number;
}) {
  const safeCount = Math.max(0, Math.floor(count));
  const maxRadius = Math.max(minRadius, bottomRadius - 4);
  const cacheKey = `${safeCount}:${bottomRadius}:${minRadius}`;
  const cached = bottomRockCache.get(cacheKey);
  if (cached) return cached;

  const rocks = new Array<MountainMineshaftBottomRock>(safeCount);
  for (let index = 0; index < safeCount; index += 1) {
    const angle = survivalHash01(9110, index, 3) * Math.PI * 2;
    const radius = lerpNumber(minRadius, maxRadius, Math.pow(survivalHash01(9120, index, 7), 0.7));
    const rockScale = lerpNumber(0.7, 1.8, survivalHash01(9130, index, 11));

    rocks[index] = {
      index,
      angle,
      x: Math.sin(angle) * radius,
      z: Math.cos(angle) * radius,
      rotation: [0, angle, 0],
      scale: [rockScale * 1.4, rockScale * 0.38, rockScale],
      color: MOUNTAIN_MINESHAFT_BOTTOM_ROCK_COLORS[index % MOUNTAIN_MINESHAFT_BOTTOM_ROCK_COLORS.length],
    };
  }
  bottomRockCache.set(cacheKey, rocks);
  return rocks;
}

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
  const ropeLights: MountainMineshaftWallRopeLightDescriptor[] = [];

  MOUNTAIN_VILLAGE_MINESHAFT_WALL_FIBONACCI_SEQUENCE.forEach((lightCount, tierIndex) => {
    const t = tierIndex / Math.max(1, MOUNTAIN_VILLAGE_MINESHAFT_WALL_FIBONACCI_SEQUENCE.length - 1);
    const y = ropeTopY - t * ropeSequenceHeight;
    const rowAngle = -0.25 + tierIndex * MOUNTAIN_VILLAGE_MINESHAFT_GOLDEN_ANGLE;

    for (let lightIndex = 0; lightIndex < lightCount; lightIndex += 1) {
      const angle = rowAngle + (lightCount === 1 ? 0 : (Math.PI * 2 * lightIndex) / lightCount);
      ropeLights.push({
        key: `rope-fibonacci-light-${tierIndex}-${lightIndex}`,
        tierIndex,
        lightIndex,
        position: [Math.sin(angle) * ropeRadius, y, Math.cos(angle) * ropeRadius],
        rotation: [0, angle, 0],
        bulbScale: 1.06 + Math.min(0.38, tierIndex * 0.05),
        glowColor: MOUNTAIN_MINESHAFT_ROPE_LIGHT_GLOW_COLORS[lightIndex % MOUNTAIN_MINESHAFT_ROPE_LIGHT_GLOW_COLORS.length],
        hasLight: tierIndex < 2 && lightIndex === 0,
      });
    }
  });

  const descriptors = { lanterns, paintings, ropeLights };
  wallDecorCache.set(cacheKey, descriptors);
  return descriptors;
}

export function getMountainMineshaftRoyalBanquetDescriptors(): MountainMineshaftRoyalBanquetDescriptors {
  if (royalBanquetDescriptorCache) return royalBanquetDescriptorCache;

  const bottomLights = new Array<MountainMineshaftBottomLightDescriptor>(MOUNTAIN_VILLAGE_MINESHAFT_BOTTOM_LIGHT_COUNT);
  for (let index = 0; index < MOUNTAIN_VILLAGE_MINESHAFT_BOTTOM_LIGHT_COUNT; index += 1) {
    const angle = (index / MOUNTAIN_VILLAGE_MINESHAFT_BOTTOM_LIGHT_COUNT) * Math.PI * 2;
    bottomLights[index] = {
      index,
      position: [
        Math.sin(angle) * MOUNTAIN_VILLAGE_MINESHAFT_BOTTOM_LIGHT_RADIUS,
        0.08,
        Math.cos(angle) * MOUNTAIN_VILLAGE_MINESHAFT_BOTTOM_LIGHT_RADIUS,
      ],
      rotation: [0, angle + Math.PI, 0],
      bodyColor: index % 2 === 0 ? "#5c3d24" : "#372315",
      withLight: index % 3 === 0,
    };
  }

  const chairs = MOUNTAIN_VILLAGE_MINESHAFT_BANQUET_CHAIR_ANGLES.map((angle, index) => ({
    index,
    position: [
      Math.sin(angle) * MOUNTAIN_VILLAGE_MINESHAFT_BANQUET_CHAIR_RADIUS,
      0,
      Math.cos(angle) * MOUNTAIN_VILLAGE_MINESHAFT_BANQUET_CHAIR_RADIUS,
    ] as [number, number, number],
    rotation: [0, angle, 0] as [number, number, number],
    seatColor: index % 2 === 0 ? "#6f4528" : "#55341e",
  }));

  const tableRadius = MOUNTAIN_VILLAGE_MINESHAFT_BANQUET_TABLE_RADIUS;
  const planks = new Array<MountainMineshaftTablePlankDescriptor>(9);
  for (let index = 0; index < planks.length; index += 1) {
    const z = -tableRadius * 0.72 + index * ((tableRadius * 1.44) / 8);
    planks[index] = {
      index,
      z,
      width: Math.sqrt(Math.max(0, tableRadius * tableRadius - z * z)) * 1.82,
      color: index % 2 === 0 ? "#8a5b34" : "#3c2415",
    };
  }

  const legs = new Array<MountainMineshaftTableLegDescriptor>(6);
  for (let index = 0; index < legs.length; index += 1) {
    const angle = (index / legs.length) * Math.PI * 2;
    legs[index] = {
      index,
      position: [Math.sin(angle) * 3.95, 0.92, Math.cos(angle) * 3.95],
    };
  }

  const breads = MOUNTAIN_MINESHAFT_BANQUET_BREAD_POSITIONS.map(({ x, z }, index) => ({
    index,
    position: [x, 2.5, z] as [number, number, number],
    rotation: [0, index * 0.7, 0] as [number, number, number],
    color: index % 2 === 0 ? "#d29a4a" : "#b87833",
  }));

  const fruitBowls = MOUNTAIN_MINESHAFT_FRUIT_BOWL_POSITIONS.map(({ x, z }, bowlIndex) => ({
    index: bowlIndex,
    position: [x, 2.48, z] as [number, number, number],
    fruits: Array.from({ length: 5 }, (_, fruitIndex) => ({
      index: fruitIndex,
      position: [(fruitIndex - 2) * 0.22, 0.18 + (fruitIndex % 2) * 0.12, Math.sin(fruitIndex) * 0.24] as [number, number, number],
      color: MOUNTAIN_MINESHAFT_FRUIT_COLORS[(fruitIndex + bowlIndex) % MOUNTAIN_MINESHAFT_FRUIT_COLORS.length],
    })),
  }));

  const plates = MOUNTAIN_MINESHAFT_BANQUET_PLATE_ANGLES.map((angle, index) => ({
    index,
    position: [Math.sin(angle) * 4.5, 2.42, Math.cos(angle) * 4.5] as [number, number, number],
    rotation: [0, angle, 0] as [number, number, number],
    foodColor: index % 3 === 0 ? "#89422b" : "#c38a42",
  }));

  const candles = MOUNTAIN_MINESHAFT_TABLE_CANDLE_POSITIONS.map(({ x, z }, index) => ({
    index,
    position: [x, 2.54, z] as [number, number, number],
  }));

  royalBanquetDescriptorCache = {
    bottomLights,
    chairs,
    table: {
      radius: tableRadius,
      planks,
      legs,
      breads,
      fruitBowls,
      plates,
      candles,
    },
  };
  return royalBanquetDescriptorCache;
}
