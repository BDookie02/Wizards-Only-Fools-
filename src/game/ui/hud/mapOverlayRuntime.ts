import { SURVIVAL_BLOCK_SIZE, type ExpandedMapPage, type MapWaypoint } from "../../../store/gameStore";
import type { MapDirection } from "./mapControllerRuntime";

export type LiveMapPosition = {
  x: number;
  z: number;
  angle: number;
};

export type VillageFastTravelTarget = {
  key: string;
  label: string;
  x: number;
  y: number;
  z: number;
};

export type FullMapLandmarkLabel = {
  key: string;
  label: string;
  x: number;
  z: number;
};

export type MapControlId = "page-live" | "page-world" | "close" | "clear-waypoint" | `travel-${string}`;
export type ExpandedMapFrameStyle = {
  width: string;
  aspectRatio: string;
};

export type MapKeyboardToggleEvent = {
  key: string;
  repeat: boolean;
  target: EventTarget | null;
};

export const FULL_MAP_IMAGE_SRC = "/maps/dagamemap.png";
export const FULL_MAP_ASPECT_RATIO = "4096 / 2979";
export const FULL_MAP_BOUNDS = {
  minX: -2304,
  maxX: 3328,
  minZ: -2304,
  maxZ: 1792,
};
export const LOCAL_MINIMAP_WORLD_RADIUS = 80;

export const VILLAGE_FAST_TRAVEL_TARGETS: VillageFastTravelTarget[] = [
  { key: "base", label: "BASE", x: 0, y: 15, z: 30 },
  { key: "chicago", label: "CHICAGO", x: -3 * SURVIVAL_BLOCK_SIZE, y: 140, z: -3 * SURVIVAL_BLOCK_SIZE + 214 },
  { key: "swamp", label: "SWAMP", x: 0, y: 140, z: -3 * SURVIVAL_BLOCK_SIZE + 214 },
  { key: "desert", label: "DESERT", x: 4 * SURVIVAL_BLOCK_SIZE, y: 140, z: -4 * SURVIVAL_BLOCK_SIZE + 214 },
  { key: "mountain", label: "MOUNTAIN", x: 3 * SURVIVAL_BLOCK_SIZE, y: 270, z: 62 },
  { key: "graveyard", label: "GRAVEYARD", x: 5 * SURVIVAL_BLOCK_SIZE, y: 92, z: 2 * SURVIVAL_BLOCK_SIZE + 132 },
];

export const FULL_MAP_LANDMARK_LABELS: FullMapLandmarkLabel[] = [
  { key: "chicago", label: "Chicago city", x: -3 * SURVIVAL_BLOCK_SIZE, z: -3 * SURVIVAL_BLOCK_SIZE },
  { key: "swamp", label: "Swamp village", x: 0, z: -3 * SURVIVAL_BLOCK_SIZE },
  { key: "desert", label: "Desert village", x: 4 * SURVIVAL_BLOCK_SIZE, z: -4 * SURVIVAL_BLOCK_SIZE },
  { key: "base", label: "Base village", x: 0, z: 0 },
  { key: "mountain", label: "Mountain village", x: 3 * SURVIVAL_BLOCK_SIZE, z: 0 },
  { key: "graveyard", label: "Graveyard", x: 5 * SURVIVAL_BLOCK_SIZE, z: 2 * SURVIVAL_BLOCK_SIZE },
];

export function clampPercent(value: number) {
  return Math.min(100, Math.max(0, value));
}

export function getRoundedPlanarDistance(a: { x: number; z: number }, b: { x: number; z: number }) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.round(Math.sqrt(dx * dx + dz * dz));
}

export function isEditableMapTarget(target: EventTarget | null) {
  if (typeof HTMLElement === "undefined") return false;
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return target.isContentEditable || tag === "input" || tag === "textarea" || tag === "select";
}

export function shouldToggleMapFromKeyboardEvent(event: MapKeyboardToggleEvent) {
  return !event.repeat && !isEditableMapTarget(event.target) && (event.key === "m" || event.key === "M");
}

export function getFullMapWaypointFromClientPoint(
  clientX: number,
  clientY: number,
  rect: Pick<DOMRect, "height" | "left" | "top" | "width">,
): MapWaypoint {
  const xRatio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  const zRatio = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
  return {
    x: FULL_MAP_BOUNDS.minX + xRatio * (FULL_MAP_BOUNDS.maxX - FULL_MAP_BOUNDS.minX),
    z: FULL_MAP_BOUNDS.minZ + zRatio * (FULL_MAP_BOUNDS.maxZ - FULL_MAP_BOUNDS.minZ),
  };
}

export function dispatchMapVillageFastTravel(target: VillageFastTravelTarget) {
  const detail = { x: target.x, y: target.y, z: target.z };
  if (typeof window !== "undefined") {
    const TeleportEvent = window.CustomEvent ?? CustomEvent;
    window.dispatchEvent(new TeleportEvent("teleportPlayer", { detail }));
  }
  return detail;
}

export function getVisibleMapControlIds(expandedMapPage: ExpandedMapPage, hasWaypoint: boolean) {
  const ids: MapControlId[] = ["page-live", "page-world"];
  if (expandedMapPage === "world") {
    for (const target of VILLAGE_FAST_TRAVEL_TARGETS) {
      ids.push(`travel-${target.key}`);
    }
    if (hasWaypoint) ids.push("clear-waypoint");
  }
  ids.push("close");
  return ids;
}

export function getExpandedMapFrameStyle(expandedMapPage: ExpandedMapPage): ExpandedMapFrameStyle {
  return expandedMapPage === "world"
    ? { width: "min(92cqw, calc(76cqh * 4096 / 2979), 1120px)", aspectRatio: FULL_MAP_ASPECT_RATIO }
    : { width: "min(80cqw, 76cqh, 800px)", aspectRatio: "1 / 1" };
}

export function isMapControlIdVisible(ids: readonly MapControlId[], id: MapControlId) {
  for (const visibleId of ids) {
    if (visibleId === id) return true;
  }
  return false;
}

export function scrollFocusedMapControlIntoPanel(panel: HTMLDivElement, control: HTMLButtonElement) {
  const panelRect = panel.getBoundingClientRect();
  const controlRect = control.getBoundingClientRect();
  const margin = 10;
  if (controlRect.top < panelRect.top + margin) {
    panel.scrollTop -= panelRect.top + margin - controlRect.top;
  } else if (controlRect.bottom > panelRect.bottom - margin) {
    panel.scrollTop += controlRect.bottom - (panelRect.bottom - margin);
  }
}

export function findDirectionalMapControlId(
  controls: ReadonlyMap<MapControlId, HTMLButtonElement>,
  visibleIds: readonly MapControlId[],
  currentId: MapControlId,
  direction: MapDirection,
) {
  let fallbackId = currentId;
  for (const id of visibleIds) {
    if (controls.get(id)) {
      fallbackId = id;
      break;
    }
  }
  const currentControl = controls.get(currentId) ?? controls.get(fallbackId);
  if (!currentControl) return fallbackId;

  const currentRect = currentControl.getBoundingClientRect();
  const currentCenterX = currentRect.left + currentRect.width / 2;
  const currentCenterY = currentRect.top + currentRect.height / 2;
  let bestId: MapControlId | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const id of visibleIds) {
    if (id === currentId) continue;
    const control = controls.get(id);
    if (!control) continue;
    const rect = control.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = centerX - currentCenterX;
    const dy = centerY - currentCenterY;
    const mainDistance =
      direction === "up" ? -dy :
        direction === "down" ? dy :
          direction === "left" ? -dx :
            dx;
    if (mainDistance <= 4) continue;

    const crossDistance = direction === "up" || direction === "down" ? Math.abs(dx) : Math.abs(dy);
    const overlap =
      direction === "up" || direction === "down"
        ? Math.max(0, Math.min(currentRect.right, rect.right) - Math.max(currentRect.left, rect.left))
        : Math.max(0, Math.min(currentRect.bottom, rect.bottom) - Math.max(currentRect.top, rect.top));
    const overlapBonus = overlap > 0 ? -160 : 0;
    const score = mainDistance * 10 + crossDistance + overlapBonus;
    if (score < bestScore) {
      bestScore = score;
      bestId = id;
    }
  }

  return bestId ?? currentId;
}

export function getFullMapMarkerPosition(point: MapWaypoint) {
  return {
    left: clampPercent(((point.x - FULL_MAP_BOUNDS.minX) / (FULL_MAP_BOUNDS.maxX - FULL_MAP_BOUNDS.minX)) * 100),
    top: clampPercent(((point.z - FULL_MAP_BOUNDS.minZ) / (FULL_MAP_BOUNDS.maxZ - FULL_MAP_BOUNDS.minZ)) * 100),
  };
}

export function getSurvivalBlockCenter(value: number) {
  return Math.floor((value + SURVIVAL_BLOCK_SIZE / 2) / SURVIVAL_BLOCK_SIZE) * SURVIVAL_BLOCK_SIZE;
}

export function getSurvivalBlockBounds(position: LiveMapPosition) {
  const centerX = getSurvivalBlockCenter(position.x);
  const centerZ = getSurvivalBlockCenter(position.z);
  const halfBlock = SURVIVAL_BLOCK_SIZE / 2;
  return {
    minX: centerX - halfBlock,
    minZ: centerZ - halfBlock,
  };
}

export function getBlockMapMarkerPosition(point: MapWaypoint, blockBounds: ReturnType<typeof getSurvivalBlockBounds>, insetPercent = 0) {
  const rawLeft = ((point.x - blockBounds.minX) / SURVIVAL_BLOCK_SIZE) * 100;
  const rawTop = ((point.z - blockBounds.minZ) / SURVIVAL_BLOCK_SIZE) * 100;
  const min = insetPercent;
  const max = 100 - insetPercent;
  return {
    left: Math.min(max, Math.max(min, rawLeft)),
    top: Math.min(max, Math.max(min, rawTop)),
    pinned: rawLeft < min || rawLeft > max || rawTop < min || rawTop > max,
  };
}

export function getWaypointNavigationMarker(
  waypoint: MapWaypoint | null,
  playerPosition: LiveMapPosition,
  radiusPercent: number,
) {
  if (!waypoint) return null;
  const dx = waypoint.x - playerPosition.x;
  const dz = waypoint.z - playerPosition.z;
  const distanceSq = dx * dx + dz * dz;
  if (distanceSq < 1) {
    return { left: 50, top: 50, distance: 0, pinned: false };
  }

  const distance = Math.sqrt(distanceSq);
  const scale = Math.min(1, LOCAL_MINIMAP_WORLD_RADIUS / distance);
  const edgeScale = distanceSq > LOCAL_MINIMAP_WORLD_RADIUS * LOCAL_MINIMAP_WORLD_RADIUS ? 0.92 : 1;
  const markerRadius = radiusPercent * scale * edgeScale;
  return {
    left: 50 + (dx / distance) * markerRadius,
    top: 50 + (dz / distance) * markerRadius,
    distance,
    pinned: distanceSq > LOCAL_MINIMAP_WORLD_RADIUS * LOCAL_MINIMAP_WORLD_RADIUS,
  };
}
