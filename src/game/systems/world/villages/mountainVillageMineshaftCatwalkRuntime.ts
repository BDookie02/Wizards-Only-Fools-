export type MountainMineshaftCatwalkRingPoint = {
  index: number;
  angle: number;
  position: [number, number, number];
  rotation: [number, number, number];
};

export type MountainMineshaftCatwalkLightPole = MountainMineshaftCatwalkRingPoint;

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

const catwalkDescriptorCache = new Map<string, MountainMineshaftCatwalkDescriptors>();
const catwalkLightPoleCache = new Map<string, MountainMineshaftCatwalkLightPole[]>();
const catwalkColliderCache = new Map<string, MountainMineshaftCatwalkColliderDetails>();

function getRingPoint(index: number, angle: number, radius: number, y: number): MountainMineshaftCatwalkRingPoint {
  return {
    index,
    angle,
    position: [Math.sin(angle) * radius, y, Math.cos(angle) * radius],
    rotation: [0, angle, 0],
  };
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

export function getMountainMineshaftCatwalkRuntimeSummary({
  segments = 18,
  innerRadius = 16,
  outerRadius = 22,
  hutAngle = 0.7,
}: {
  segments?: number;
  innerRadius?: number;
  outerRadius?: number;
  hutAngle?: number;
} = {}) {
  const descriptors = getMountainMineshaftCatwalkDescriptors({ segments, innerRadius, outerRadius });
  const colliders = getMountainMineshaftCatwalkColliderDetails({ segments, innerRadius, outerRadius });
  const lightPoles = getMountainMineshaftCatwalkLightPoles(hutAngle, descriptors.lightPoleRadius);
  return {
    plankCount: descriptors.planks.length,
    darkGapCount: descriptors.darkGaps.length,
    edgeBlockCount: descriptors.edgeBlocks.length,
    guardPostCount: descriptors.guardPosts.length,
    railSegmentCount: descriptors.railSegments.length,
    colliderSegmentCount: colliders.segments.length,
    lightPoleCount: lightPoles.length,
  };
}
