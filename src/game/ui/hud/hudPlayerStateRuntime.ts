import type { PlayerStateEventDetail } from "../../systems/player/playerEventBridge";

export type HudPlayerState = PlayerStateEventDetail;

export function createDefaultHudPlayerState(): HudPlayerState {
  return {
    isMoving: false,
    isSprinting: false,
    isSliding: false,
    isCrouching: false,
    isGrounded: true,
    isMeditating: false,
  };
}

function readHudPlayerStateFlag(candidate: Partial<HudPlayerState>, key: keyof HudPlayerState, fallback: boolean) {
  return typeof candidate[key] === "boolean" ? candidate[key] : fallback;
}

export function areHudPlayerStatesEqual(left: HudPlayerState, right: HudPlayerState) {
  return (
    left.isMoving === right.isMoving &&
    left.isSprinting === right.isSprinting &&
    left.isSliding === right.isSliding &&
    left.isCrouching === right.isCrouching &&
    left.isGrounded === right.isGrounded &&
    left.isMeditating === right.isMeditating
  );
}

export function resolveHudPlayerStateEvent(previous: HudPlayerState, detail: unknown): HudPlayerState {
  if (!detail || typeof detail !== "object") return previous;
  const candidate = detail as Partial<HudPlayerState>;
  const next: HudPlayerState = {
    isMoving: readHudPlayerStateFlag(candidate, "isMoving", previous.isMoving),
    isSprinting: readHudPlayerStateFlag(candidate, "isSprinting", previous.isSprinting),
    isSliding: readHudPlayerStateFlag(candidate, "isSliding", previous.isSliding),
    isCrouching: readHudPlayerStateFlag(candidate, "isCrouching", previous.isCrouching),
    isGrounded: readHudPlayerStateFlag(candidate, "isGrounded", previous.isGrounded),
    isMeditating: readHudPlayerStateFlag(candidate, "isMeditating", previous.isMeditating),
  };
  return areHudPlayerStatesEqual(previous, next) ? previous : next;
}
