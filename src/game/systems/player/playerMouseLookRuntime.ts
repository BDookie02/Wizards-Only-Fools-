import * as THREE from "three";

export type PlayerMouseLookFallbackOptions = {
  applyCameraLookDelta: (yawDelta: number, pitchDelta: number) => void;
  getMouseSensitivity: () => number;
  isMouseLookFallbackActive: () => boolean;
};

export function installPlayerMouseLookFallback({
  applyCameraLookDelta,
  getMouseSensitivity,
  isMouseLookFallbackActive,
}: PlayerMouseLookFallbackOptions) {
  if (typeof document === "undefined") return () => {};

  let fallbackMousePosition: { x: number; y: number } | null = null;

  const handleMouseMove = (event: MouseEvent) => {
    const pointerLocked = document.pointerLockElement !== null;
    const fallbackActive = !pointerLocked && isMouseLookFallbackActive();
    if (!pointerLocked && !fallbackActive) {
      fallbackMousePosition = null;
      return;
    }

    let movementX = event.movementX;
    let movementY = event.movementY;
    if (fallbackActive) {
      const previousMousePosition = fallbackMousePosition;
      fallbackMousePosition = { x: event.clientX, y: event.clientY };
      const clientMovementX = previousMousePosition ? event.clientX - previousMousePosition.x : 0;
      const clientMovementY = previousMousePosition ? event.clientY - previousMousePosition.y : 0;
      if (!Number.isFinite(movementX) || movementX === 0) movementX = clientMovementX;
      if (!Number.isFinite(movementY) || movementY === 0) movementY = clientMovementY;
      movementX = THREE.MathUtils.clamp(movementX, -96, 96);
      movementY = THREE.MathUtils.clamp(movementY, -96, 96);
    } else {
      fallbackMousePosition = null;
    }

    if (movementX === 0 && movementY === 0) return;

    const mouseSensitivity = getMouseSensitivity();
    applyCameraLookDelta(-movementX * mouseSensitivity, -movementY * mouseSensitivity);
  };

  document.addEventListener("mousemove", handleMouseMove);
  return () => document.removeEventListener("mousemove", handleMouseMove);
}
