import { shouldPublishCurrentSurvivalWorldTelemetry } from "../../../tools/qa/survivalQaTelemetryRoutes";

type DormantGrassCellTelemetry = {
  centerCellX: number;
  centerCellZ: number;
  visibleCellCount: number;
  targetCellCount: number;
};

type LocalGrassCellTelemetry = DormantGrassCellTelemetry & {
  streamRadius: number;
};

function getDormantGrassDataset(): DOMStringMap | null {
  if (typeof document === "undefined") return null;
  return document.documentElement.dataset;
}

export function publishSurvivalTutorialGrassDebugSummary(summary: string) {
  const dataset = getDormantGrassDataset();
  if (!dataset) return false;
  dataset.wofTutorialGrassDebug = summary;
  return true;
}

export function publishSurvivalTutorialGrassTelemetry({
  centerCellX,
  centerCellZ,
  visibleCellCount,
  targetCellCount,
}: DormantGrassCellTelemetry) {
  if (!shouldPublishCurrentSurvivalWorldTelemetry()) return false;
  const dataset = getDormantGrassDataset();
  if (!dataset) return false;

  dataset.wofTutorialGrassCenter = `${centerCellX},${centerCellZ}`;
  dataset.wofTutorialGrassCells = String(visibleCellCount);
  dataset.wofTutorialGrassBatches = "0";
  dataset.wofTutorialGrassTargetCells = String(targetCellCount);
  dataset.wofTutorialGrassPendingCells = String(Math.max(0, targetCellCount - visibleCellCount));
  return true;
}

export function publishSurvivalLocalGrassTelemetry({
  centerCellX,
  centerCellZ,
  visibleCellCount,
  targetCellCount,
  streamRadius,
}: LocalGrassCellTelemetry) {
  if (!shouldPublishCurrentSurvivalWorldTelemetry()) return false;
  const dataset = getDormantGrassDataset();
  if (!dataset) return false;

  dataset.wofLocalGrassCenter = `${centerCellX},${centerCellZ}`;
  dataset.wofLocalGrassCells = String(visibleCellCount);
  dataset.wofLocalGrassTargetCells = String(targetCellCount);
  dataset.wofLocalGrassPendingCells = String(Math.max(0, targetCellCount - visibleCellCount));
  dataset.wofLocalGrassStreamRadius = String(Math.round(streamRadius));
  return true;
}
