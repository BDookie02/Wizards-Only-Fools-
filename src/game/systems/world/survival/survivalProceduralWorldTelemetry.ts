import { shouldPublishCurrentSurvivalWorldTelemetry } from "../../../tools/qa/survivalQaTelemetryRoutes";
import type { SurvivalChunkInfo, SurvivalVillageKind } from "./survivalWorldConfig";
import { shouldRenderSurvivalMountainVillageShellChunk } from "../villages/survivalVillageVisibility";
import { isSurvivalBotwGrassWarmupBlockingChunkPrewarm as isSurvivalBotwGrassBuildBlockingChunkPrewarm } from "../vegetation/survivalBotwGrassTelemetry";

export type SurvivalProceduralWorldStreamTelemetry = {
  centerCx: number;
  centerCz: number;
  chunkStreamRadius: number;
  chunks: readonly SurvivalChunkInfo[];
  visibleChunks: readonly SurvivalChunkInfo[];
};

let latestSurvivalProceduralPendingChunkCount = 0;

function shouldPublishSurvivalProceduralWorldTelemetry() {
  return shouldPublishCurrentSurvivalWorldTelemetry();
}

export function getSurvivalProceduralPendingChunkCount() {
  return latestSurvivalProceduralPendingChunkCount;
}

export function publishSurvivalVillageRendererPreloads(villageKinds: readonly SurvivalVillageKind[]) {
  if (!shouldPublishSurvivalProceduralWorldTelemetry()) return;
  document.documentElement.dataset.wofSurvivalVillageRendererPreloads = villageKinds.join("|");
}

export function isSurvivalBotwGrassWarmupBlockingChunkPrewarm() {
  return isSurvivalBotwGrassBuildBlockingChunkPrewarm();
}

export function publishSurvivalProceduralWorldStreamTelemetry({
  centerCx,
  centerCz,
  chunkStreamRadius,
  chunks,
  visibleChunks,
}: SurvivalProceduralWorldStreamTelemetry) {
  const pendingChunkCount = Math.max(0, chunks.length - visibleChunks.length);
  latestSurvivalProceduralPendingChunkCount = pendingChunkCount;

  if (!shouldPublishSurvivalProceduralWorldTelemetry()) return;
  const visibleMountainShells: string[] = [];
  for (const chunk of visibleChunks) {
    if (shouldRenderSurvivalMountainVillageShellChunk(chunk)) {
      visibleMountainShells.push(`${chunk.key}:${chunk.lod}:${chunk.distance}`);
    }
  }

  document.documentElement.dataset.wofSurvivalProceduralMounted = "1";
  document.documentElement.dataset.wofSurvivalStreamCenter = `${centerCx},${centerCz}`;
  document.documentElement.dataset.wofSurvivalStreamRadius = String(chunkStreamRadius);
  document.documentElement.dataset.wofSurvivalRenderedChunks = String(visibleChunks.length);
  document.documentElement.dataset.wofSurvivalTargetChunks = String(chunks.length);
  document.documentElement.dataset.wofSurvivalPendingChunks = String(pendingChunkCount);
  document.documentElement.dataset.wofSurvivalMountainShells = visibleMountainShells.join("|");
}
