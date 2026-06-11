import { isQaTelemetryRouteEnabledFromSearch } from "../../../tools/qa/qaRouteTelemetry";

let cachedTelemetrySearch = "";
let cachedTelemetryEnabled = false;
let latestSurvivalBotwGrassBuildState = "";
let latestSurvivalBotwGrassUploadProgress = "";

function getSurvivalBotwGrassTelemetryRoot() {
  if (typeof window === "undefined" || typeof document === "undefined") return null;
  if (!shouldPublishSurvivalBotwGrassRuntimeMetricsFromSearch(window.location.search)) return null;
  return document.documentElement;
}

export function shouldPublishSurvivalBotwGrassRuntimeMetricsFromSearch(search: string) {
  if (search === cachedTelemetrySearch) return cachedTelemetryEnabled;

  cachedTelemetrySearch = search;
  cachedTelemetryEnabled = isQaTelemetryRouteEnabledFromSearch(search, ["perf", "grass", "survival", "canvas", "touch", "mountain"]);

  return cachedTelemetryEnabled;
}

export function isSurvivalBotwGrassWarmupBlockingChunkPrewarm() {
  return latestSurvivalBotwGrassBuildState === "building" &&
    (!latestSurvivalBotwGrassUploadProgress || latestSurvivalBotwGrassUploadProgress === "0/0");
}

export function publishSurvivalBotwGrassPendingPrewarms(count: number) {
  const root = getSurvivalBotwGrassTelemetryRoot();
  if (!root) return;
  root.dataset.wofBotwGrassPendingPrewarms = String(count);
}

export function publishSurvivalBotwGrassPrewarmBuilding(buildKey: string) {
  const root = getSurvivalBotwGrassTelemetryRoot();
  if (!root) return;
  root.dataset.wofBotwGrassPrewarmKey = buildKey;
  root.dataset.wofBotwGrassPrewarmState = "building";
}

export function publishSurvivalBotwGrassPrewarmReady(buildKey: string, buildMs: number) {
  const root = getSurvivalBotwGrassTelemetryRoot();
  if (!root) return;
  root.dataset.wofBotwGrassPrewarmKey = buildKey;
  root.dataset.wofBotwGrassPrewarmMs = String(Math.round(buildMs));
  root.dataset.wofBotwGrassPrewarmState = "ready";
}

export function publishSurvivalBotwGrassBuildState(state: string) {
  latestSurvivalBotwGrassBuildState = state;
  const root = getSurvivalBotwGrassTelemetryRoot();
  if (!root) return;
  root.dataset.wofBotwGrassBuildState = state;
}

export function publishSurvivalBotwGrassBuildResult(buildKey: string, buildMs: number, state: string) {
  latestSurvivalBotwGrassBuildState = state;
  const root = getSurvivalBotwGrassTelemetryRoot();
  if (!root) return;
  root.dataset.wofBotwGrassBuildKey = buildKey;
  root.dataset.wofBotwGrassBuildMs = String(Math.round(buildMs));
  root.dataset.wofBotwGrassBuildState = state;
}

export function publishSurvivalBotwGrassUploadSnapshot(
  centerX: number,
  centerZ: number,
  visibleCount: number,
  uploadIndex: number,
  totalCount: number,
  groundTriangles: number,
) {
  latestSurvivalBotwGrassUploadProgress = `${uploadIndex}/${totalCount}`;
  const root = getSurvivalBotwGrassTelemetryRoot();
  if (!root) return;
  root.dataset.wofBotwGrassCenter = `${Math.round(centerX)},${Math.round(centerZ)}`;
  root.dataset.wofBotwGrassInstances = String(visibleCount);
  root.dataset.wofBotwGrassUploadProgress = `${uploadIndex}/${totalCount}`;
  root.dataset.wofBotwGrassUploadRatio = (totalCount > 0 ? uploadIndex / totalCount : 0).toFixed(2);
  root.dataset.wofBotwGrassGroundTriangles = String(groundTriangles);
}

export function publishSurvivalBotwGrassUploadComplete(totalCount: number) {
  latestSurvivalBotwGrassUploadProgress = `${totalCount}/${totalCount}`;
  const root = getSurvivalBotwGrassTelemetryRoot();
  if (!root) return;
  root.dataset.wofBotwGrassInstances = String(totalCount);
  root.dataset.wofBotwGrassUploadProgress = `${totalCount}/${totalCount}`;
  root.dataset.wofBotwGrassUploadRatio = "1.00";
}

export function publishSurvivalBotwGrassFlowerCounts(totalCount: number, largeBloomCount: number, tallFlowerHeadCount = 0) {
  const root = getSurvivalBotwGrassTelemetryRoot();
  if (!root) return;
  root.dataset.wofBotwGrassFlowers = String(totalCount);
  root.dataset.wofBotwGrassLargeFlowers = String(largeBloomCount);
  root.dataset.wofBotwGrassTallFlowerHeads = String(tallFlowerHeadCount);
}

export function publishSurvivalBotwGrassRuntimeMetrics(metrics: {
  leadDistance: number;
  leadSpeed: number;
  centerTravelAlignment: number;
  targetDistance: number;
  viewerDistance: number;
  uploadRatio: number;
}) {
  const root = getSurvivalBotwGrassTelemetryRoot();
  if (!root) return;
  root.dataset.wofBotwGrassLead = String(Math.round(metrics.leadDistance));
  root.dataset.wofBotwGrassSpeed = metrics.leadSpeed.toFixed(1);
  root.dataset.wofBotwGrassCenterAlignment = metrics.centerTravelAlignment.toFixed(2);
  root.dataset.wofBotwGrassTargetDistance = String(Math.round(metrics.targetDistance));
  root.dataset.wofBotwGrassViewerDistance = String(Math.round(metrics.viewerDistance));
  root.dataset.wofBotwGrassUploadRatio = metrics.uploadRatio.toFixed(2);
}

export function clearSurvivalBotwGrassRuntimeMetrics() {
  const root = getSurvivalBotwGrassTelemetryRoot();
  if (!root) return;
  delete root.dataset.wofBotwGrassLead;
  delete root.dataset.wofBotwGrassSpeed;
  delete root.dataset.wofBotwGrassCenterAlignment;
  delete root.dataset.wofBotwGrassTargetDistance;
  delete root.dataset.wofBotwGrassViewerDistance;
}

export function publishSurvivalBotwGrassDebugLine(samples: unknown[]) {
  const root = getSurvivalBotwGrassTelemetryRoot();
  if (!root) return;
  root.dataset.wofBotwGrassDebugLine = JSON.stringify(samples);
}

export function clearSurvivalBotwGrassDebugLine() {
  const root = getSurvivalBotwGrassTelemetryRoot();
  if (!root) return;
  delete root.dataset.wofBotwGrassDebugLine;
}
