import {
  MOUNTAIN_VILLAGE_MINESHAFT_EXIT_BRIDGE_END_RADIUS,
  MOUNTAIN_VILLAGE_MINESHAFT_EXIT_BRIDGE_START_RADIUS,
} from "./mountainVillageTerrain";

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

const platformDetailCache = new Map<string, MountainMineshaftPlatformDetails>();
const exitBridgeDetailCache = new Map<string, MountainMineshaftExitBridgeDetails>();
const ladderDetailCache = new Map<string, MountainMineshaftLadderDetails>();
const MOUNTAIN_MINESHAFT_BRIDGE_SIDES = [-1, 1] as const;
const MOUNTAIN_MINESHAFT_PLATFORM_SUPPORT_SIDES = [-1, 1] as const;

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
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
    sideShadows: MOUNTAIN_MINESHAFT_PLATFORM_SUPPORT_SIDES.map((side) => ({
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
    bolts: MOUNTAIN_MINESHAFT_PLATFORM_SUPPORT_SIDES.map((side) => ({
      side,
      position: [piece.centerX + side * piece.width * 0.34, 0.94, platformZ + platformDepth * 0.38] as [number, number, number],
    })),
  }));

  const details = {
    pieces,
    supports: MOUNTAIN_MINESHAFT_PLATFORM_SUPPORT_SIDES.map((side) => ({
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

export function getMountainMineshaftAccessRuntimeSummary() {
  const fullPlatform = getMountainMineshaftPlatformPieces(18, null, 4);
  const splitPlatform = getMountainMineshaftPlatformPieces(18, 0, 4);
  const platformDetails = getMountainMineshaftPlatformDetails({
    platformPieces: splitPlatform,
    platformZ: 5,
    platformDepth: 8,
    platformWidth: 18,
    poleSide: 1,
  });
  const bridgeFrame = getMountainMineshaftExitBridgeFrame({ angle: 0.8 });
  const bridgeDetails = getMountainMineshaftExitBridgeDetails({ length: bridgeFrame.length, width: 8 });
  const ladderDetails = getMountainMineshaftLadderDetails({ height: 42, width: 4.4 });

  return {
    fullPlatformPieceCount: fullPlatform.length,
    splitPlatformPieceCount: splitPlatform.length,
    platformDetailPieceCount: platformDetails.pieces.length,
    platformSupportCount: platformDetails.supports.length,
    bridgeEdgeShadowCount: bridgeDetails.edgeShadows.length,
    bridgeDarkGapCount: bridgeDetails.darkGaps.length,
    bridgePlankCount: bridgeDetails.planks.length,
    bridgeSideRailCount: bridgeDetails.sideRails.length,
    bridgePostCount: bridgeDetails.sideRails.reduce((sum, rail) => sum + rail.posts.length, 0),
    bridgeSupportCount: bridgeDetails.supports.length,
    ladderRungCount: ladderDetails.rungCount,
    ladderWrapCount: ladderDetails.wrapCount,
    ladderBrightEdgeCount: ladderDetails.brightEdges.length,
    ladderDarkEdgeCount: ladderDetails.darkEdges.length,
  };
}
