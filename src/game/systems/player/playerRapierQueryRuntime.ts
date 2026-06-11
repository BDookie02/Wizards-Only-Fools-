export type PlayerRapierQueryWorld = {
  castRay: (...args: any[]) => any;
  projectPoint: (...args: any[]) => any;
};

export type PlayerRapierQueryOptions = {
  filterFlags?: number;
  filterExcludeCollider?: unknown;
  filterExcludeRigidBody?: unknown;
  filterPredicate?: ((collider: any) => boolean) | undefined;
};

const EXCLUDE_SENSORS_FALLBACK = 8;
const RAPIER_QUERY_WARNING_INTERVAL_MS = 2500;

let lastRapierQueryWarningAt = 0;

export function getExcludeSensorsQueryFlags(rapier: { QueryFilterFlags?: { EXCLUDE_SENSORS?: number } }) {
  return rapier.QueryFilterFlags?.EXCLUDE_SENSORS ?? EXCLUDE_SENSORS_FALLBACK;
}

function warnRapierQueryFailure(operation: string, error: unknown) {
  const now = Date.now();
  if (now - lastRapierQueryWarningAt < RAPIER_QUERY_WARNING_INTERVAL_MS) return;
  lastRapierQueryWarningAt = now;
  console.warn(`[WOF] Skipped unsafe Rapier ${operation} query this frame`, error);
}

export function castPlayerWorldRay(
  world: Pick<PlayerRapierQueryWorld, "castRay">,
  ray: unknown,
  maxToi: number,
  solid: boolean,
  options: PlayerRapierQueryOptions = {},
) {
  try {
    return world.castRay(
      ray,
      maxToi,
      solid,
      options.filterFlags,
      undefined,
      options.filterExcludeCollider,
      options.filterExcludeRigidBody,
      options.filterPredicate,
    );
  } catch (error) {
    warnRapierQueryFailure("castRay", error);
    return null;
  }
}

export function projectPlayerWorldPoint(
  world: Pick<PlayerRapierQueryWorld, "projectPoint">,
  point: unknown,
  solid: boolean,
  options: PlayerRapierQueryOptions = {},
) {
  try {
    return world.projectPoint(
      point,
      solid,
      options.filterFlags,
      undefined,
      options.filterExcludeCollider,
      options.filterExcludeRigidBody,
      options.filterPredicate,
    );
  } catch (error) {
    warnRapierQueryFailure("projectPoint", error);
    return null;
  }
}
