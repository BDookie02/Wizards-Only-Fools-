export type PlayerTeleportAction =
  | { type: "none" }
  | {
      type: "apply";
      position: { x: number; y: number; z: number };
      yaw?: number;
    };

function readFiniteNumber(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function readOptionalFiniteNumber(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

export function resolvePlayerTeleportEventAction(detail: unknown): PlayerTeleportAction {
  const payload = detail && typeof detail === "object" ? detail as Record<string, unknown> : {};
  const x = readFiniteNumber(payload.x);
  const y = readFiniteNumber(payload.y);
  const z = readFiniteNumber(payload.z);
  if (x === null || y === null || z === null) return { type: "none" };

  return {
    type: "apply",
    position: { x, y, z },
    yaw: readOptionalFiniteNumber(payload.yaw),
  };
}
