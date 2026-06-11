import { useEffect } from "react";
import { isCurrentQaTelemetryRouteEnabled } from "./qaRouteTelemetry";

type NumericSurvivalFeatureCounter =
  | "ambientBirds"
  | "bushBlobs"
  | "chicagoBuildings"
  | "chicagoCars"
  | "chicagoPedestrians"
  | "desertLandmarks"
  | "desertVillageBuildings"
  | "detailScatterProps"
  | "fastGroveTrees"
  | "fernFronds"
  | "graveyardFenceSegments"
  | "graveyardPathStones"
  | "graveyardTombs"
  | "hobbitHuts"
  | "lilyPads"
  | "rockOutcrops"
  | "roofForestTrees"
  | "solidTrees"
  | "swampVillageHuts"
  | "waterPonds"
  | "waterfalls"
  | "worldWillows";

type InsectFeatureCount = {
  butterflies: number;
  bees: number;
};

const numericDatasetKeys: Record<NumericSurvivalFeatureCounter, string> = {
  ambientBirds: "wofAmbientBirds",
  bushBlobs: "wofBushBlobs",
  chicagoBuildings: "wofChicagoBuildings",
  chicagoCars: "wofChicagoCars",
  chicagoPedestrians: "wofChicagoPedestrians",
  desertLandmarks: "wofDesertLandmarks",
  desertVillageBuildings: "wofDesertVillageBuildings",
  detailScatterProps: "wofDetailScatterProps",
  fastGroveTrees: "wofFastGroveTrees",
  fernFronds: "wofFernFronds",
  graveyardFenceSegments: "wofGraveyardFenceSegments",
  graveyardPathStones: "wofGraveyardPathStones",
  graveyardTombs: "wofGraveyardTombs",
  hobbitHuts: "wofHobbitHuts",
  lilyPads: "wofLilyPads",
  rockOutcrops: "wofRockOutcrops",
  roofForestTrees: "wofRoofForestTrees",
  solidTrees: "wofSolidTrees",
  swampVillageHuts: "wofSwampVillageHuts",
  waterPonds: "wofWaterPonds",
  waterfalls: "wofWaterfalls",
  worldWillows: "wofWorldWillows",
};

const numericCounts = new Map<NumericSurvivalFeatureCounter, Map<string, number>>();
const insectCounts = new Map<string, InsectFeatureCount>();

function shouldPublishSurvivalFeatureCounters() {
  return isCurrentQaTelemetryRouteEnabled(["perf", "hud", "aspect", "canvas", "touch", "mountain", "grass", "survival"]);
}

function getNumericCounts(metric: NumericSurvivalFeatureCounter) {
  let counts = numericCounts.get(metric);
  if (!counts) {
    counts = new Map<string, number>();
    numericCounts.set(metric, counts);
  }

  return counts;
}

function publishNumericCount(metric: NumericSurvivalFeatureCounter) {
  if (typeof document === "undefined") return;

  let total = 0;
  for (const count of getNumericCounts(metric).values()) {
    total += count;
  }
  document.documentElement.dataset[numericDatasetKeys[metric]] = String(total);
}

function publishInsectCount() {
  if (typeof document === "undefined") return;

  let butterflies = 0;
  let bees = 0;
  for (const count of insectCounts.values()) {
    butterflies += count.butterflies;
    bees += count.bees;
  }

  document.documentElement.dataset.wofAmbientInsects = `${butterflies}:${bees}`;
}

export function useSurvivalFeatureCount(
  metric: NumericSurvivalFeatureCounter,
  id: string,
  count: number,
) {
  const shouldPublish = shouldPublishSurvivalFeatureCounters();

  useEffect(() => {
    if (!shouldPublish) return;

    const counts = getNumericCounts(metric);
    counts.set(id, count);
    publishNumericCount(metric);

    return () => {
      counts.delete(id);
      publishNumericCount(metric);
    };
  }, [count, id, metric, shouldPublish]);
}

export function useSurvivalAmbientInsectCount(
  id: string,
  butterflies: number,
  bees: number,
) {
  const shouldPublish = shouldPublishSurvivalFeatureCounters();

  useEffect(() => {
    if (!shouldPublish) return;

    insectCounts.set(id, { butterflies, bees });
    publishInsectCount();

    return () => {
      insectCounts.delete(id);
      publishInsectCount();
    };
  }, [bees, butterflies, id, shouldPublish]);
}
