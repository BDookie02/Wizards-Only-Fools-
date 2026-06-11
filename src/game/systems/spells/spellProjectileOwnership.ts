import type { Projectile } from "../../../store/gameStore";
import { getLocalNetworkPlayerId } from "../../network/gameNetworkClient";

type ProjectileCreator = Pick<Projectile, "creatorId">;

export function getLocalProjectileCreatorId() {
  return getLocalNetworkPlayerId();
}

export function isLocalProjectileCreator(projectile: ProjectileCreator) {
  return projectile.creatorId === getLocalNetworkPlayerId();
}

export function isRemoteProjectileCreator(projectile: ProjectileCreator) {
  return !isLocalProjectileCreator(projectile);
}

export function isLocalNetworkPlayerId(playerId: string) {
  return playerId === getLocalNetworkPlayerId();
}
