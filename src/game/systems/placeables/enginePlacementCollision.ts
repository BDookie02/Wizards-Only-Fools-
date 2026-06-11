import { getPlaceableDefinition, type PlaceableDefinition } from "./placeableCatalog";
import { getPlaceableFootprintBounds, type PlaceableFootprintBounds } from "./placeableMetrics";

export type EnginePlacementFootprint = {
  instanceId: string;
  placeableId: string;
  label: string;
  x: number;
  z: number;
  yaw?: number;
};

type FootprintBox = Extract<PlaceableFootprintBounds, { kind: "box" }> & {
  x: number;
  z: number;
  axisX: { x: number; z: number };
  axisZ: { x: number; z: number };
};

function dot2(a: { x: number; z: number }, b: { x: number; z: number }) {
  return a.x * b.x + a.z * b.z;
}

function getBoxFootprint(shape: Extract<PlaceableFootprintBounds, { kind: "box" }>, x: number, z: number, yaw: number): FootprintBox {
  const safeYaw = Number.isFinite(yaw) ? yaw : 0;
  const cos = Math.cos(safeYaw);
  const sin = Math.sin(safeYaw);
  return {
    ...shape,
    x,
    z,
    axisX: { x: cos, z: -sin },
    axisZ: { x: sin, z: cos },
  };
}

function boxProjectionRadius(box: FootprintBox, axis: { x: number; z: number }) {
  return box.halfX * Math.abs(dot2(box.axisX, axis)) + box.halfZ * Math.abs(dot2(box.axisZ, axis));
}

function boxesOverlap(a: FootprintBox, b: FootprintBox) {
  const centerDelta = { x: b.x - a.x, z: b.z - a.z };
  const axes = [a.axisX, a.axisZ, b.axisX, b.axisZ];
  for (let index = 0; index < axes.length; index += 1) {
    const axis = axes[index];
    const distance = Math.abs(dot2(centerDelta, axis));
    const limit = boxProjectionRadius(a, axis) + boxProjectionRadius(b, axis);
    if (distance > limit) return false;
  }
  return true;
}

function circleOverlapsBox(circleX: number, circleZ: number, radius: number, box: FootprintBox) {
  const dx = circleX - box.x;
  const dz = circleZ - box.z;
  const localX = dx * box.axisX.x + dz * box.axisX.z;
  const localZ = dx * box.axisZ.x + dz * box.axisZ.z;
  const closestX = Math.max(-box.halfX, Math.min(box.halfX, localX));
  const closestZ = Math.max(-box.halfZ, Math.min(box.halfZ, localZ));
  const distanceX = localX - closestX;
  const distanceZ = localZ - closestZ;
  return distanceX * distanceX + distanceZ * distanceZ <= radius * radius;
}

function footprintsOverlap(
  shape: PlaceableFootprintBounds,
  x: number,
  z: number,
  yaw: number,
  otherShape: PlaceableFootprintBounds,
  otherX: number,
  otherZ: number,
  otherYaw: number
) {
  if (shape.kind === "circle" && otherShape.kind === "circle") {
    const minDistance = Math.max(1.2, (shape.radius + otherShape.radius) * 0.82);
    const dx = x - otherX;
    const dz = z - otherZ;
    return dx * dx + dz * dz < minDistance * minDistance;
  }

  if (shape.kind === "box" && otherShape.kind === "box") {
    return boxesOverlap(getBoxFootprint(shape, x, z, yaw), getBoxFootprint(otherShape, otherX, otherZ, otherYaw));
  }

  if (shape.kind === "box") {
    return circleOverlapsBox(otherX, otherZ, otherShape.radius, getBoxFootprint(shape, x, z, yaw));
  }

  if (shape.kind === "circle" && otherShape.kind === "box") {
    return circleOverlapsBox(x, z, shape.radius, getBoxFootprint(otherShape, otherX, otherZ, otherYaw));
  }

  return false;
}

export function findEnginePlacementCollision(
  placeable: PlaceableDefinition,
  x: number,
  z: number,
  objects: EnginePlacementFootprint[],
  ignoreInstanceId?: string,
  yaw = 0
) {
  const shape = getPlaceableFootprintBounds(placeable);
  for (let index = 0; index < objects.length; index += 1) {
    const object = objects[index];
    if (object.instanceId === ignoreInstanceId) continue;
    const otherPlaceable = getPlaceableDefinition(object.placeableId);
    if (!otherPlaceable) continue;
    const otherShape = getPlaceableFootprintBounds(otherPlaceable);
    if (footprintsOverlap(shape, x, z, yaw, otherShape, object.x, object.z, object.yaw ?? 0)) {
      return object;
    }
  }
  return null;
}
