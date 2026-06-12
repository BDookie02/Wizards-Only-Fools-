import {
  MOUNTAIN_VILLAGE_MINESHAFT_BOTTOM_BASE_OFFSET,
  MOUNTAIN_VILLAGE_MINESHAFT_EXIT_BRIDGE_END_RADIUS,
  MOUNTAIN_VILLAGE_MINESHAFT_EXIT_BRIDGE_START_RADIUS,
  MOUNTAIN_VILLAGE_MINESHAFT_EXIT_BRIDGE_Y_OFFSET,
  MOUNTAIN_VILLAGE_MINESHAFT_HOLE_RADIUS,
  MOUNTAIN_VILLAGE_MINESHAFT_HUT_RADIUS,
  MOUNTAIN_VILLAGE_MINESHAFT_LADDER_EXIT_CLEARANCE,
  MOUNTAIN_VILLAGE_MINESHAFT_LADDER_RING_RADIUS,
  MOUNTAIN_VILLAGE_MINESHAFT_LADDER_START_CLEARANCE,
  MOUNTAIN_VILLAGE_MINESHAFT_LADDER_WIDTH,
  MOUNTAIN_VILLAGE_MINESHAFT_RIM_OUTER_RADIUS,
} from "./mountainVillageTerrain";
import { lerpNumber, survivalHash01 } from "../survival/survivalMath";
import type { SurvivalChunkInfo } from "../survival/survivalWorldConfig";

type MountainMineshaftLandingHut = {
  localX: number;
  localZ: number;
  rotation: number;
};

type MountainMineshaftLandingLadder = {
  localX: number;
  localZ: number;
};

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

export type MountainMineshaftPlatformPiece = {
  key: string;
  centerX: number;
  width: number;
};

export type MountainMineshaftPlatformSideShadow = {
  side: -1 | 1;
  position: [number, number, number];
};

export type MountainMineshaftPlatformPlankGroove = {
  index: number;
  position: [number, number, number];
  width: number;
  color: string;
};

export type MountainMineshaftPlatformRail = {
  key: "front" | "back";
  position: [number, number, number];
  width: number;
};

export type MountainMineshaftPlatformBolt = {
  side: -1 | 1;
  position: [number, number, number];
};

export type MountainMineshaftPlatformPieceDetails = {
  key: string;
  sideShadows: MountainMineshaftPlatformSideShadow[];
  plankGrooves: MountainMineshaftPlatformPlankGroove[];
  frontRail: MountainMineshaftPlatformRail;
  backRail: MountainMineshaftPlatformRail;
  bolts: MountainMineshaftPlatformBolt[];
};

export type MountainMineshaftPlatformSupport = {
  side: -1 | 1;
  position: [number, number, number];
  rotation: [number, number, number];
};

export type MountainMineshaftPlatformLightPole = {
  direction: -1 | 1;
  position: [number, number, number];
};

export type MountainMineshaftPlatformDetails = {
  pieces: MountainMineshaftPlatformPieceDetails[];
  supports: MountainMineshaftPlatformSupport[];
  lightPole: MountainMineshaftPlatformLightPole;
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

export type MountainMineshaftCatwalkColliderSegment = {
  index: number;
  positionOffset: [number, number, number];
  rotation: [number, number, number];
};

export type MountainMineshaftCatwalkColliderDetails = {
  args: [number, number, number];
  segments: MountainMineshaftCatwalkColliderSegment[];
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
const catwalkColliderCache = new Map<string, MountainMineshaftCatwalkColliderDetails>();
const platformDetailCache = new Map<string, MountainMineshaftPlatformDetails>();
const exitBridgeDetailCache = new Map<string, MountainMineshaftExitBridgeDetails>();
const ladderDetailCache = new Map<string, MountainMineshaftLadderDetails>();
const summitSnowDriftCache = new Map<string, MountainMineshaftSummitSnowDrift[]>();
const rimBeamCache = new Map<string, MountainMineshaftRimBeam[]>();
const supportFrameCache = new Map<string, MountainMineshaftSupportFrame[]>();
const bottomRockCache = new Map<string, MountainMineshaftBottomRock[]>();

const MOUNTAIN_MINESHAFT_BRIDGE_SIDES = [-1, 1] as const;
const MOUNTAIN_MINESHAFT_SUPPORT_SIDES = [-1, 1] as const;
const MOUNTAIN_MINESHAFT_HUT_LEVEL_FRACTIONS_NEAR = [0.18, 0.48, 0.8] as const;
const MOUNTAIN_MINESHAFT_HUT_LEVEL_FRACTIONS_MID = [0.24, 0.68] as const;
const MOUNTAIN_MINESHAFT_HUT_BODY_COLORS = ["#514331", "#5d4b35", "#423b32", "#664f35"] as const;
const MOUNTAIN_MINESHAFT_HUT_ROOF_COLORS = ["#6f5131", "#805d39", "#5c4028", "#8a6a42"] as const;
const MOUNTAIN_MINESHAFT_HUT_ACCENT_COLORS = ["#86d9ff", "#f1cf82", "#c7eaff", "#d7b46c"] as const;
const MOUNTAIN_MINESHAFT_BOTTOM_ROCK_COLORS = ["#4b4237", "#2f2b27", "#66533c"];

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

export function getMountainMineshaftPlatformDetails({
  platformPieces,
  platformZ,
  platformDepth,
  platformWidth,
  poleSide,
  plankCount = 5,
}: {
  platformPieces: MountainMineshaftPlatformPiece[];
  platformZ: number;
  platformDepth: number;
  platformWidth: number;
  poleSide: -1 | 1;
  plankCount?: number;
}): MountainMineshaftPlatformDetails {
  const safePlankCount = Math.max(1, Math.floor(plankCount));
  const pieceKey = platformPieces.map((piece) => `${piece.key}:${piece.centerX}:${piece.width}`).join("|");
  const cacheKey = `${pieceKey}:${platformZ}:${platformDepth}:${platformWidth}:${poleSide}:${safePlankCount}`;
  const cached = platformDetailCache.get(cacheKey);
  if (cached) return cached;

  const pieces = platformPieces.map((piece) => ({
    key: piece.key,
    sideShadows: MOUNTAIN_MINESHAFT_SUPPORT_SIDES.map((side) => ({
      side,
      position: [piece.centerX + side * piece.width * 0.47, 0.88, platformZ] as [number, number, number],
    })),
    plankGrooves: Array.from({ length: safePlankCount }, (_, index) => {
      const z = platformZ - platformDepth * 0.35 + index * ((platformDepth * 0.7) / Math.max(1, safePlankCount - 1));
      return {
        index,
        position: [piece.centerX, 0.73, z] as [number, number, number],
        width: piece.width * 0.88,
        color: index % 2 === 0 ? "#2c1d13" : "#8a613b",
      };
    }),
    frontRail: {
      key: "front",
      position: [piece.centerX, 0.82, platformZ + platformDepth * 0.46] as [number, number, number],
      width: piece.width * 0.94,
    } as MountainMineshaftPlatformRail,
    backRail: {
      key: "back",
      position: [piece.centerX, 0.8, platformZ - platformDepth * 0.46] as [number, number, number],
      width: piece.width * 0.94,
    } as MountainMineshaftPlatformRail,
    bolts: MOUNTAIN_MINESHAFT_SUPPORT_SIDES.map((side) => ({
      side,
      position: [piece.centerX + side * piece.width * 0.34, 0.94, platformZ + platformDepth * 0.38] as [number, number, number],
    })),
  }));

  const details = {
    pieces,
    supports: MOUNTAIN_MINESHAFT_SUPPORT_SIDES.map((side) => ({
      side,
      position: [side * platformWidth * 0.38, -2.0, platformZ - platformDepth * 0.1] as [number, number, number],
      rotation: [0, 0, side * 0.28] as [number, number, number],
    })),
    lightPole: {
      direction: poleSide,
      position: [poleSide * platformWidth * 0.33, 0.78, platformZ + platformDepth * 0.26] as [number, number, number],
    },
  };

  platformDetailCache.set(cacheKey, details);
  return details;
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

export function getMountainMineshaftCatwalkColliderDetails({
  segments,
  innerRadius,
  outerRadius,
}: {
  segments: number;
  innerRadius: number;
  outerRadius: number;
}): MountainMineshaftCatwalkColliderDetails {
  const safeSegments = Math.max(1, Math.floor(segments));
  const cacheKey = `${safeSegments}:${innerRadius}:${outerRadius}`;
  const cached = catwalkColliderCache.get(cacheKey);
  if (cached) return cached;

  const midRadius = (innerRadius + outerRadius) / 2;
  const radialHalfWidth = (outerRadius - innerRadius) / 2;
  const arcHalfLength = ((Math.PI * 2 * midRadius) / safeSegments) * 0.56;
  const colliderSegments = new Array<MountainMineshaftCatwalkColliderSegment>(safeSegments);

  for (let index = 0; index < safeSegments; index += 1) {
    const angle = ((index + 0.5) / safeSegments) * Math.PI * 2;
    colliderSegments[index] = {
      index,
      positionOffset: [Math.sin(angle) * midRadius, 0, Math.cos(angle) * midRadius],
      rotation: [0, angle, 0],
    };
  }

  const details = {
    args: [arcHalfLength, 0.32, radialHalfWidth] as [number, number, number],
    segments: colliderSegments,
  };
  catwalkColliderCache.set(cacheKey, details);
  return details;
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
