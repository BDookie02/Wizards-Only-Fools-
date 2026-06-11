const FULL_TURN_RADIANS = Math.PI * 2;

export function normalizeAngleRadians(angle: number) {
  const normalized = (angle + Math.PI) % FULL_TURN_RADIANS;
  return (normalized < 0 ? normalized + FULL_TURN_RADIANS : normalized) - Math.PI;
}

export function angleDeltaRadians(from: number, to: number) {
  return normalizeAngleRadians(to - from);
}

export function absoluteAngleDeltaRadians(from: number, to: number) {
  return Math.abs(angleDeltaRadians(from, to));
}

export function lerpAngleRadians(from: number, to: number, alpha: number) {
  return normalizeAngleRadians(from + angleDeltaRadians(from, to) * alpha);
}

export function moveAngleTowardsRadians(from: number, to: number, maxStep: number) {
  const delta = angleDeltaRadians(from, to);
  return normalizeAngleRadians(from + Math.min(maxStep, Math.max(-maxStep, delta)));
}
