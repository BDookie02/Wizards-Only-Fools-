import * as THREE from "three";
import {
  CHICAGO_CROSSWALK_BAR_OFFSETS,
  CHICAGO_HYDRANT_OFFSETS,
  CHICAGO_PARKING_LINE_INDICES,
  CHICAGO_ROAD_POSITIONS,
  CHICAGO_SAFE_STREET_OFFSETS,
  CHICAGO_SIDE_SIGNS,
  CHICAGO_SIDEWALK_PROP_OFFSET,
  getChicagoStreetFacingRotation,
  isNearChicagoIntersectionBand,
} from "./survivalChicagoCityLayout";

export type ChicagoFlatPlanePatch = { x: number; z: number; width: number; depth: number };
export type ChicagoGrassPatch = ChicagoFlatPlanePatch & { key: string; color: string };
export type ChicagoCrosswalkStripe = ChicagoFlatPlanePatch & { key: string; opacity: number };
export type ChicagoGrassGroup = { color: string; items: ChicagoGrassPatch[] };
export type ChicagoCrosswalkGroup = { opacity: number; items: ChicagoCrosswalkStripe[] };
export type ChicagoStreetPoint = { key: string; x: number; z: number };
export type ChicagoBench = ChicagoStreetPoint & { rotation: number };
export type ChicagoSidewalkSegment = { center: number; length: number };

export function makeChicagoHydrantLayout(): ChicagoStreetPoint[] {
  const items: ChicagoStreetPoint[] = [];
  for (let roadIndex = 0; roadIndex < CHICAGO_ROAD_POSITIONS.length; roadIndex += 1) {
    const road = CHICAGO_ROAD_POSITIONS[roadIndex];
    for (let index = 0; index < CHICAGO_HYDRANT_OFFSETS.length && items.length < 16; index += 1) {
      const offset = CHICAGO_HYDRANT_OFFSETS[index];
      const side = index % 2 === 0 ? -1 : 1;
      items.push({ key: `hydrant-v-${road}-${offset}`, x: road + side * 17.2, z: offset + roadIndex * 2 });
    }
    if (items.length >= 16) break;
  }
  return items;
}

export function makeChicagoTrashCanLayout(): ChicagoStreetPoint[] {
  const items: ChicagoStreetPoint[] = [];
  for (let roadIndex = 0; roadIndex < CHICAGO_ROAD_POSITIONS.length; roadIndex += 1) {
    const road = CHICAGO_ROAD_POSITIONS[roadIndex];
    for (let index = 0; index < CHICAGO_SAFE_STREET_OFFSETS.length && items.length < 52; index += 1) {
      const offset = CHICAGO_SAFE_STREET_OFFSETS[index];
      if (isNearChicagoIntersectionBand(offset)) continue;
      const side = index % 2 === 0 ? -1 : 1;
      items.push({
        key: `trash-v-${road}-${offset}`,
        x: road + side * CHICAGO_SIDEWALK_PROP_OFFSET,
        z: offset + (roadIndex % 2 === 0 ? 2.4 : -2.4),
      });
      if (index % 2 === 0) {
        items.push({
          key: `trash-h-${road}-${offset}`,
          x: offset,
          z: road - side * CHICAGO_SIDEWALK_PROP_OFFSET,
        });
      }
    }
    if (items.length >= 52) break;
  }
  return items;
}

export function makeChicagoBenchLayout(): ChicagoBench[] {
  const items: ChicagoBench[] = [];
  for (let roadIndex = 0; roadIndex < CHICAGO_ROAD_POSITIONS.length; roadIndex += 1) {
    const road = CHICAGO_ROAD_POSITIONS[roadIndex];
    for (let index = 0; index < CHICAGO_SAFE_STREET_OFFSETS.length && items.length < 34; index += 1) {
      const offset = CHICAGO_SAFE_STREET_OFFSETS[index];
      if (isNearChicagoIntersectionBand(offset)) continue;
      const side = index % 2 === 0 ? -1 : 1;
      const verticalX = road + side * CHICAGO_SIDEWALK_PROP_OFFSET;
      items.push({
        key: `bench-v-${road}-${offset}`,
        x: verticalX,
        z: offset,
        rotation: getChicagoStreetFacingRotation(verticalX, offset, road, offset),
      });
      if (items.length >= 34) break;
      if ((index + roadIndex) % 2 === 0) {
        const horizontalZ = road + side * CHICAGO_SIDEWALK_PROP_OFFSET;
        items.push({
          key: `bench-h-${road}-${offset}`,
          x: offset,
          z: horizontalZ,
          rotation: getChicagoStreetFacingRotation(offset, horizontalZ, offset, road),
        });
      }
    }
    if (items.length >= 34) break;
  }
  return items;
}

export function makeChicagoGrassPatches(): ChicagoGrassPatch[] {
  const items: ChicagoGrassPatch[] = [];
  for (let roadIndex = 0; roadIndex < CHICAGO_ROAD_POSITIONS.length; roadIndex += 1) {
    const road = CHICAGO_ROAD_POSITIONS[roadIndex];
    for (let index = 0; index < CHICAGO_SAFE_STREET_OFFSETS.length && items.length < 72; index += 1) {
      const offset = CHICAGO_SAFE_STREET_OFFSETS[index];
      if (isNearChicagoIntersectionBand(offset)) continue;
      const side = index % 2 === 0 ? -1 : 1;
      items.push({
        key: `grass-v-${road}-${offset}`,
        x: road + side * (CHICAGO_SIDEWALK_PROP_OFFSET + 0.2),
        z: offset,
        width: 5.2 + ((index + roadIndex) % 3) * 1.4,
        depth: 8.5 + ((index + roadIndex) % 4) * 2.2,
        color: (index + roadIndex) % 2 === 0 ? "#3f8f3f" : "#2f7d32",
      });
      if (index % 3 !== 0) {
        items.push({
          key: `grass-h-${road}-${offset}`,
          x: offset,
          z: road - side * (CHICAGO_SIDEWALK_PROP_OFFSET + 0.2),
          width: 8.5 + ((index + roadIndex) % 4) * 2.2,
          depth: 5.2 + ((index + roadIndex) % 3) * 1.4,
          color: (index + roadIndex) % 2 === 0 ? "#347d36" : "#4d9a42",
        });
      }
    }
    if (items.length >= 72) break;
  }
  return items;
}

export function makeChicagoCrosswalkStripes(): ChicagoCrosswalkStripe[] {
  const items: ChicagoCrosswalkStripe[] = [];
  const approachOffset = 18.8;
  const roadSpan = 24.6;
  const crosswalkLength = 6.4;
  const halfCrosswalk = crosswalkLength / 2;
  const barWidth = 1.05;
  for (let xIndex = 0; xIndex < CHICAGO_ROAD_POSITIONS.length; xIndex += 1) {
    const x = CHICAGO_ROAD_POSITIONS[xIndex];
    for (let zIndex = 0; zIndex < CHICAGO_ROAD_POSITIONS.length; zIndex += 1) {
      const z = CHICAGO_ROAD_POSITIONS[zIndex];
      for (let directionIndex = 0; directionIndex < CHICAGO_SIDE_SIGNS.length; directionIndex += 1) {
        const direction = CHICAGO_SIDE_SIGNS[directionIndex];
        const verticalCenterZ = z + direction * approachOffset;
        const horizontalCenterX = x + direction * approachOffset;

        items.push(
          { key: `cross-v-edge-a-${x}-${z}-${direction}`, x, z: verticalCenterZ - halfCrosswalk, width: roadSpan, depth: 0.46, opacity: 0.76 },
          { key: `cross-v-edge-b-${x}-${z}-${direction}`, x, z: verticalCenterZ + halfCrosswalk, width: roadSpan, depth: 0.46, opacity: 0.76 },
          { key: `cross-v-stop-${x}-${z}-${direction}`, x, z: verticalCenterZ + direction * (halfCrosswalk + 2.1), width: roadSpan + 1.0, depth: 0.48, opacity: 0.66 },
          { key: `cross-h-edge-a-${x}-${z}-${direction}`, x: horizontalCenterX - halfCrosswalk, z, width: 0.46, depth: roadSpan, opacity: 0.76 },
          { key: `cross-h-edge-b-${x}-${z}-${direction}`, x: horizontalCenterX + halfCrosswalk, z, width: 0.46, depth: roadSpan, opacity: 0.76 },
          { key: `cross-h-stop-${x}-${z}-${direction}`, x: horizontalCenterX + direction * (halfCrosswalk + 2.1), z, width: 0.48, depth: roadSpan + 1.0, opacity: 0.66 },
        );

        for (let stripeIndex = 0; stripeIndex < CHICAGO_CROSSWALK_BAR_OFFSETS.length; stripeIndex += 1) {
          const offset = CHICAGO_CROSSWALK_BAR_OFFSETS[stripeIndex];
          items.push({
            key: `cross-v-continental-${x}-${z}-${direction}-${stripeIndex}`,
            x: x + offset,
            z: verticalCenterZ,
            width: barWidth,
            depth: crosswalkLength,
            opacity: 0.82,
          });
          items.push({
            key: `cross-h-continental-${x}-${z}-${direction}-${stripeIndex}`,
            x: horizontalCenterX,
            z: z + offset,
            width: crosswalkLength,
            depth: barWidth,
            opacity: 0.82,
          });
        }
      }
    }
  }
  return items;
}

export function makeChicagoSidewalkPlanes(sidewalkSegments: ChicagoSidewalkSegment[]): ChicagoFlatPlanePatch[] {
  const items: ChicagoFlatPlanePatch[] = [];
  for (let roadIndex = 0; roadIndex < CHICAGO_ROAD_POSITIONS.length; roadIndex += 1) {
    const x = CHICAGO_ROAD_POSITIONS[roadIndex];
    for (let sideIndex = 0; sideIndex < CHICAGO_SIDE_SIGNS.length; sideIndex += 1) {
      const side = CHICAGO_SIDE_SIGNS[sideIndex] * 18;
      for (let segmentIndex = 0; segmentIndex < sidewalkSegments.length; segmentIndex += 1) {
        const segment = sidewalkSegments[segmentIndex];
        items.push({ x: x + side, z: segment.center, width: 6.5, depth: segment.length });
      }
    }
  }
  for (let roadIndex = 0; roadIndex < CHICAGO_ROAD_POSITIONS.length; roadIndex += 1) {
    const z = CHICAGO_ROAD_POSITIONS[roadIndex];
    for (let sideIndex = 0; sideIndex < CHICAGO_SIDE_SIGNS.length; sideIndex += 1) {
      const side = CHICAGO_SIDE_SIGNS[sideIndex] * 18;
      for (let segmentIndex = 0; segmentIndex < sidewalkSegments.length; segmentIndex += 1) {
        const segment = sidewalkSegments[segmentIndex];
        items.push({ x: segment.center, z: z + side, width: segment.length, depth: 6.5 });
      }
    }
  }
  return items;
}

export function makeChicagoParkingLines(): ChicagoFlatPlanePatch[] {
  const items: ChicagoFlatPlanePatch[] = [];
  for (let roadIndex = 0; roadIndex < CHICAGO_ROAD_POSITIONS.length; roadIndex += 1) {
    const x = CHICAGO_ROAD_POSITIONS[roadIndex];
    for (let index = 0; index < CHICAGO_PARKING_LINE_INDICES.length; index += 1) {
      items.push({ x: x - 12.6, z: -198 + index * 56, width: 1.1, depth: 21 });
    }
  }
  for (let roadIndex = 0; roadIndex < CHICAGO_ROAD_POSITIONS.length; roadIndex += 1) {
    const z = CHICAGO_ROAD_POSITIONS[roadIndex];
    for (let index = 0; index < CHICAGO_PARKING_LINE_INDICES.length; index += 1) {
      items.push({ x: -198 + index * 56, z: z + 12.6, width: 21, depth: 1.1 });
    }
  }
  return items;
}

export function groupChicagoGrassPatches(grassPatches: ChicagoGrassPatch[]) {
  const groups: ChicagoGrassGroup[] = [];
  for (let patchIndex = 0; patchIndex < grassPatches.length; patchIndex += 1) {
    const patch = grassPatches[patchIndex];
    let group: ChicagoGrassGroup | undefined;
    for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
      if (groups[groupIndex].color === patch.color) {
        group = groups[groupIndex];
        break;
      }
    }
    if (!group) {
      group = { color: patch.color, items: [] };
      groups.push(group);
    }
    group.items.push(patch);
  }
  return groups;
}

export function groupChicagoCrosswalkStripes(crosswalks: ChicagoCrosswalkStripe[]) {
  const groups: ChicagoCrosswalkGroup[] = [];
  for (let stripeIndex = 0; stripeIndex < crosswalks.length; stripeIndex += 1) {
    const stripe = crosswalks[stripeIndex];
    let group: ChicagoCrosswalkGroup | undefined;
    for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
      if (groups[groupIndex].opacity === stripe.opacity) {
        group = groups[groupIndex];
        break;
      }
    }
    if (!group) {
      group = { opacity: stripe.opacity, items: [] };
      groups.push(group);
    }
    group.items.push(stripe);
  }
  return groups;
}

export function setChicagoFlatPlaneInstancedPart(
  dummy: THREE.Object3D,
  mesh: THREE.InstancedMesh,
  index: number,
  x: number,
  y: number,
  z: number,
  width: number,
  depth: number,
) {
  dummy.position.set(x, y, z);
  dummy.rotation.set(-Math.PI / 2, 0, 0);
  dummy.scale.set(width, depth, 1);
  dummy.updateMatrix();
  mesh.setMatrixAt(index, dummy.matrix);
}
