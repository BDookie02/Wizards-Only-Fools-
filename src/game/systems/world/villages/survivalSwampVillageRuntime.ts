import * as THREE from "three";

export type SwampVillageRope = {
  key: string;
  start: [number, number, number];
  end: [number, number, number];
  sag: number;
  lightCount: number;
  lightHue: number;
};

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
