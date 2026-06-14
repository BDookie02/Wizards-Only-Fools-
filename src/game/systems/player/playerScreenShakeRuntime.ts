import * as THREE from "three";

export type PlayerScreenShakeState = {
  strength: number;
  until: number;
  duration: number;
};

type PlayerScreenShakeEventDetail = {
  strength?: unknown;
  duration?: unknown;
};

export type PlayerScreenShakeEventAction = {
  strength: number;
  duration: number;
};

function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function resetPlayerScreenShake(screenShake: PlayerScreenShakeState) {
  screenShake.strength = 0;
  screenShake.until = 0;
  screenShake.duration = 1;
}

export function applyPlayerScreenShake(
  camera: THREE.Camera,
  screenShake: PlayerScreenShakeState,
  nowMs: number,
  scratchForward: THREE.Vector3,
  scratchRight: THREE.Vector3,
  scratchUp: THREE.Vector3,
  random = Math.random,
) {
  if (screenShake.strength <= 0) return;

  if (screenShake.until <= nowMs) {
    resetPlayerScreenShake(screenShake);
    return;
  }

  const remaining = Math.max(0, (screenShake.until - nowMs) / Math.max(1, screenShake.duration));
  const amplitude = screenShake.strength * remaining * remaining;
  camera.getWorldDirection(scratchForward);
  scratchRight.crossVectors(camera.up, scratchForward).normalize();
  scratchUp.copy(camera.up).normalize();
  camera.position.addScaledVector(scratchRight, (random() - 0.5) * amplitude);
  camera.position.addScaledVector(scratchUp, (random() - 0.5) * amplitude * 0.65);
}

export function applyPlayerScreenShakeEvent(
  screenShake: PlayerScreenShakeState,
  detail: PlayerScreenShakeEventDetail | null | undefined,
  nowMs: number,
) {
  const { strength, duration } = resolvePlayerScreenShakeEventAction(detail);
  screenShake.strength = Math.max(screenShake.strength, strength);
  screenShake.until = nowMs + duration;
  screenShake.duration = duration;
}

export function resolvePlayerScreenShakeEventAction(
  detail: PlayerScreenShakeEventDetail | null | undefined,
): PlayerScreenShakeEventAction {
  return {
    strength: clampNumber(Number(detail?.strength) || 0.25, 0.02, 1.2),
    duration: clampNumber(Number(detail?.duration) || 320, 80, 1200),
  };
}
