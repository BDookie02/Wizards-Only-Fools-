import {
  getLastKnownLocalPlayerPosition,
  getPublishedLastPlayerYaw,
} from "../player/playerEventBridge";
import type { EnginePlaceableRequestDetail } from "./placementRules";

export function getEnginePlacementPlayerSnapshot(detail?: EnginePlaceableRequestDetail) {
  const playerPosition = getLastKnownLocalPlayerPosition();
  const playerYaw = Number(getPublishedLastPlayerYaw() ?? detail?.yaw ?? 0);
  return { position: playerPosition, yaw: playerYaw };
}
