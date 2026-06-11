import type { PlaceableDefinition } from "./placeableCatalog";

export type PlaceableBuildingMetrics = {
  bodyWidth: number;
  bodyDepth: number;
  bodyHeight: number;
  roofHeight: number;
  roofSegments: number;
};

export type PlaceableFootprintBounds =
  | { kind: "circle"; radius: number }
  | { kind: "box"; halfX: number; halfZ: number; radius: number };

const placeableBuildingMetricsCache = new WeakMap<PlaceableDefinition, PlaceableBuildingMetrics>();
const placeableFootprintBoundsCache = new WeakMap<PlaceableDefinition, PlaceableFootprintBounds>();

export function getPlaceableBuildingMetrics(placeable: PlaceableDefinition) {
  const cached = placeableBuildingMetricsCache.get(placeable);
  if (cached) return cached;

  const isMushroom = placeable.id.includes("mushroom");
  const metrics = {
    bodyWidth: placeable.category === "village" ? 8.8 : 7.2,
    bodyDepth: placeable.category === "village" ? 9.8 : 7.6,
    bodyHeight: placeable.id.includes("grass-roof") ? 5.8 : 6.8,
    roofHeight: isMushroom ? 3.4 : 2.6,
    roofSegments: isMushroom ? 20 : 4,
  };
  placeableBuildingMetricsCache.set(placeable, metrics);
  return metrics;
}

export function getPlaceableFootprintBounds(placeable: PlaceableDefinition): PlaceableFootprintBounds {
  const cached = placeableFootprintBoundsCache.get(placeable);
  if (cached) return cached;

  let bounds: PlaceableFootprintBounds;
  if (placeable.category === "huts" || placeable.category === "village") {
    const { bodyWidth, bodyDepth } = getPlaceableBuildingMetrics(placeable);
    const halfX = Math.max(bodyWidth * 0.5 + 1.15, placeable.footprintRadius * 0.52);
    const halfZ = Math.max(bodyDepth * 0.5 + 1.15, placeable.footprintRadius * 0.52);
    bounds = {
      kind: "box",
      halfX,
      halfZ,
      radius: Math.sqrt(halfX * halfX + halfZ * halfZ),
    };
  } else {
    bounds = {
      kind: "circle",
      radius: Math.max(0.5, placeable.footprintRadius),
    };
  }

  placeableFootprintBoundsCache.set(placeable, bounds);
  return bounds;
}
