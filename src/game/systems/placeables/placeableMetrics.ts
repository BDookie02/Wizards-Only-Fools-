import type { PlaceableDefinition } from "./placeableCatalog";

export type PlaceableFootprintBounds =
  | { kind: "circle"; radius: number }
  | { kind: "box"; halfX: number; halfZ: number; radius: number };

export function getPlaceableBuildingMetrics(placeable: PlaceableDefinition) {
  return {
    bodyWidth: placeable.category === "village" ? 8.8 : 7.2,
    bodyDepth: placeable.category === "village" ? 9.8 : 7.6,
    bodyHeight: placeable.id.includes("grass-roof") ? 5.8 : 6.8,
    roofHeight: placeable.id.includes("mushroom") ? 3.4 : 2.6,
  };
}

export function getPlaceableFootprintBounds(placeable: PlaceableDefinition): PlaceableFootprintBounds {
  if (placeable.category === "huts" || placeable.category === "village") {
    const { bodyWidth, bodyDepth } = getPlaceableBuildingMetrics(placeable);
    const halfX = Math.max(bodyWidth * 0.5 + 1.15, placeable.footprintRadius * 0.52);
    const halfZ = Math.max(bodyDepth * 0.5 + 1.15, placeable.footprintRadius * 0.52);
    return {
      kind: "box",
      halfX,
      halfZ,
      radius: Math.sqrt(halfX * halfX + halfZ * halfZ),
    };
  }

  return {
    kind: "circle",
    radius: Math.max(0.5, placeable.footprintRadius),
  };
}
