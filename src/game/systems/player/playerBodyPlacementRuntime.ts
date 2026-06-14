export type PlayerBodyPlacementVector = {
  x: number;
  y: number;
  z: number;
};

export type PlayerPlacementBody = {
  setTranslation(position: PlayerBodyPlacementVector, wakeUp: boolean): void;
  setLinvel(velocity: PlayerBodyPlacementVector, wakeUp: boolean): void;
  setAngvel?(velocity: PlayerBodyPlacementVector, wakeUp: boolean): void;
};

export type PlayerPlacementCamera = {
  position: {
    set(x: number, y: number, z: number): unknown;
  };
};

const ZERO_VECTOR: PlayerBodyPlacementVector = { x: 0, y: 0, z: 0 };

export function applyPlayerBodyCameraPlacement({
  body,
  camera,
  cameraHeight,
  position,
  resetAngularVelocity = false,
  wakeUp = true,
}: {
  body: PlayerPlacementBody | null | undefined;
  camera: PlayerPlacementCamera;
  cameraHeight: number;
  position: PlayerBodyPlacementVector;
  resetAngularVelocity?: boolean;
  wakeUp?: boolean;
}) {
  if (!body) return false;
  body.setTranslation(position, wakeUp);
  body.setLinvel(ZERO_VECTOR, wakeUp);
  if (resetAngularVelocity) body.setAngvel?.(ZERO_VECTOR, wakeUp);
  camera.position.set(position.x, position.y + cameraHeight, position.z);
  return true;
}
