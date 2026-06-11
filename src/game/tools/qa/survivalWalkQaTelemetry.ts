import {
  angleDeltaRadians,
  type QaSurvivalIntent,
  type QaSurvivalRouteWaypoint,
  type QaSurvivalWalkInputState,
  type QaSurvivalWalkMode,
} from "./survivalWalkQa";

type QaWalkPosition = { x: number; y: number; z: number };
type QaWalkWaypoint = { x: number; z: number };

export type SurvivalWalkStationaryMode = "delay" | "warmup";

export interface SurvivalWalkObservedCounts {
  mana: number;
  dummies: number;
  quests: number;
}

export interface SurvivalWalkLilyTelemetry {
  t: number;
  direction: number;
}

export interface SurvivalWalkFrameTelemetry {
  mode: QaSurvivalWalkMode;
  input: QaSurvivalWalkInputState;
  sprint: boolean;
  forwardClearance: number;
  viewClearance: number;
  overheadClearance: number;
  planarSpeed: number;
  yaw: number;
  targetYaw: number;
  stuckStrikes: number;
  waypoint: QaWalkWaypoint;
  position: QaWalkPosition;
  chunkCenterX: number;
  chunkCenterZ: number;
  recoveryReason: string;
  combatActive: boolean;
  activeIntent: QaSurvivalIntent | null;
  activeIntentDistance: number;
  activeRouteWaypoint: QaSurvivalRouteWaypoint | null;
  routeIndex: number;
  routeLength: number;
  waypointDistance: number;
  observed: SurvivalWalkObservedCounts;
  abnormality: string;
  lilyTube: SurvivalWalkLilyTelemetry | null;
}

function getQaDataset() {
  if (typeof document === "undefined") return null;
  return document.documentElement.dataset;
}

export function publishSurvivalWalkAction(action: string) {
  const dataset = getQaDataset();
  if (!dataset) return;
  dataset.wofQaWalkAction = action;
}

export function publishSurvivalWalkStationaryInput(mode: SurvivalWalkStationaryMode, action: string) {
  const dataset = getQaDataset();
  if (!dataset) return;
  dataset.wofQaWalkMode = mode;
  dataset.wofQaWalkForward = "0.00";
  dataset.wofQaWalkStrafe = "0.00";
  dataset.wofQaWalkSprint = "0";
  dataset.wofQaWalkAction = action;
}

export function isSurvivalWalkBotwGrassUploadReady() {
  const dataset = getQaDataset();
  if (!dataset) return true;
  const grassUploadProgress = dataset.wofBotwGrassUploadProgress;
  const grassUploadRatio = Number(dataset.wofBotwGrassUploadRatio || 0);
  const progressMatch = grassUploadProgress?.match(/^(\d+)\/(\d+)$/);
  const uploadedGrassCount = progressMatch ? Number(progressMatch[1]) : 0;
  const expectedGrassCount = progressMatch ? Number(progressMatch[2]) : 0;
  return grassUploadRatio >= 0.98 ||
    (expectedGrassCount > 0 && uploadedGrassCount >= expectedGrassCount);
}

export function wasSurvivalWalkManaFlowerCollected(id: string) {
  const dataset = getQaDataset();
  return Boolean(dataset && dataset.wofManaFlowerLastCollect === id);
}

export function publishSurvivalWalkPracticeCast(spell: string) {
  const dataset = getQaDataset();
  if (!dataset) return;
  dataset.wofQaWalkPracticeCast = spell;
}

export function getSurvivalWalkSpellDummyHitCount() {
  const dataset = getQaDataset();
  return dataset ? Number(dataset.wofSpellDummyHits || 0) : 0;
}

export function clearSurvivalWalkRouteTelemetry() {
  const dataset = getQaDataset();
  if (!dataset) return;
  delete dataset.wofQaWalkRoute;
  delete dataset.wofQaWalkRouteIndex;
}

function getSurvivalWalkIntentLabel(telemetry: SurvivalWalkFrameTelemetry) {
  if (telemetry.activeIntent) {
    return `${telemetry.activeIntent.kind}:${telemetry.activeIntent.id}:${Math.round(telemetry.activeIntentDistance)}`;
  }
  if (telemetry.activeRouteWaypoint) {
    return `route:${telemetry.activeRouteWaypoint.id}:${Math.round(telemetry.waypointDistance)}`;
  }
  return "roam";
}

export function publishSurvivalWalkFrameTelemetry(telemetry: SurvivalWalkFrameTelemetry) {
  const dataset = getQaDataset();
  if (!dataset) return;

  dataset.wofQaWalkMode = telemetry.mode;
  dataset.wofQaWalkForward = telemetry.input.forward.toFixed(2);
  dataset.wofQaWalkStrafe = telemetry.input.strafe.toFixed(2);
  dataset.wofQaWalkSprint = telemetry.sprint ? "1" : "0";
  dataset.wofQaWalkClearance = telemetry.forwardClearance.toFixed(1);
  dataset.wofQaWalkViewClearance = telemetry.viewClearance.toFixed(1);
  dataset.wofQaWalkOverheadClearance = telemetry.overheadClearance.toFixed(1);
  dataset.wofQaWalkSpeed = telemetry.planarSpeed.toFixed(2);
  dataset.wofQaWalkYawError = Math.abs(angleDeltaRadians(telemetry.yaw, telemetry.targetYaw)).toFixed(2);
  dataset.wofQaWalkStuckStrikes = String(telemetry.stuckStrikes);
  dataset.wofQaWalkWaypoint = `${Math.round(telemetry.waypoint.x)},${Math.round(telemetry.waypoint.z)}`;
  dataset.wofQaWalkPosition = `${telemetry.position.x.toFixed(1)},${telemetry.position.y.toFixed(1)},${telemetry.position.z.toFixed(1)}`;
  dataset.wofQaWalkLocalPosition = `${(telemetry.position.x - telemetry.chunkCenterX).toFixed(1)},${telemetry.position.y.toFixed(1)},${(telemetry.position.z - telemetry.chunkCenterZ).toFixed(1)}`;
  dataset.wofQaWalkRecoveryReason = telemetry.recoveryReason;
  dataset.wofQaWalkCombat = telemetry.combatActive ? "1" : "0";
  dataset.wofQaWalkIntent = getSurvivalWalkIntentLabel(telemetry);

  if (telemetry.activeRouteWaypoint && telemetry.routeLength > 0) {
    dataset.wofQaWalkRoute = telemetry.activeRouteWaypoint.id;
    dataset.wofQaWalkRouteIndex = String(telemetry.routeIndex % telemetry.routeLength);
  } else {
    delete dataset.wofQaWalkRoute;
    delete dataset.wofQaWalkRouteIndex;
  }

  const targetDistance = Number.isFinite(telemetry.activeIntentDistance)
    ? telemetry.activeIntentDistance
    : telemetry.waypointDistance;
  dataset.wofQaWalkTargetDistance = targetDistance.toFixed(1);
  dataset.wofQaWalkObserved = [
    `mana:${telemetry.observed.mana}`,
    `dummies:${telemetry.observed.dummies}`,
    `quests:${telemetry.observed.quests}`,
  ].join("|");
  dataset.wofQaWalkAbnormality = telemetry.abnormality;

  if (telemetry.lilyTube) {
    dataset.wofQaWalkLilyT = telemetry.lilyTube.t.toFixed(3);
    dataset.wofQaWalkLilyDirection = telemetry.lilyTube.direction >= 0 ? "1" : "-1";
  } else {
    delete dataset.wofQaWalkLilyT;
    delete dataset.wofQaWalkLilyDirection;
  }
}
