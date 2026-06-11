import { lazy, startTransition, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { SURVIVAL_BLOCK_SIZE } from "../../../../store/gameStore";
import { isMobilePerformanceMode } from "../../input/performanceMode";
import { isSurvivalGrassInspectionView } from "../../../tools/qa/survivalGrassDebug";
import { SurvivalTerrain, SurvivalTerrainTintRuntime } from "../terrain/SurvivalTerrain";
import {
  SURVIVAL_ALL_TERRAIN_SKIRT_EDGES,
  makeSurvivalTerrainCollisionGeometry,
  makeSurvivalTerrainGeometry,
  makeSurvivalTerrainSkirtGeometry,
} from "../terrain/survivalTerrainGeometry";
import {
  SURVIVAL_CHUNK_CENTER_HYSTERESIS,
  SURVIVAL_CHUNK_MOBILE_MOUNT_INTERVAL_MS,
  SURVIVAL_CHUNK_MOUNT_BATCH,
  SURVIVAL_CHUNK_MOUNT_INTERVAL_MS,
  SURVIVAL_CHUNK_STREAM_INITIAL_RADIUS,
  SURVIVAL_RENDER_RADIUS,
  getSurvivalChunkStreamDelay,
  type SurvivalChunkInfo,
  type SurvivalVillageKind,
} from "./survivalWorldConfig";
import {
  getSurvivalBiome,
  getSurvivalWaterLevelAtWorld,
} from "./survivalBiome";
import {
  getSurvivalRawTerrainHeightAtWorld,
  getSurvivalSmoothedTerrainColor,
  getSurvivalTerrainHeightForChunk,
  getSurvivalVillageBaseHeight,
  getSurvivalVillagePadHeight,
  makeSurvivalVillagePadGeometry,
  makeSurvivalVillagePadSkirtGeometry,
} from "./survivalTerrainSurface";
import { getSurvivalDecorationSurfaceQuality } from "./survivalGrassSurface";
import {
  scheduleSurvivalBackgroundTask,
  type SurvivalScheduledBackgroundTask,
} from "./survivalLoadStage";
import {
  isSurvivalBotwGrassWarmupBlockingChunkPrewarm,
  publishSurvivalProceduralWorldStreamTelemetry,
  publishSurvivalVillageRendererPreloads,
} from "./survivalProceduralWorldTelemetry";
import {
  getInitialSurvivalCenterChunkCoords,
  getSurvivalChunkCoord,
} from "./survivalPosition";
import {
  getInitialSurvivalVisibleChunks,
  makeSurvivalChunks,
  reconcileSurvivalVisibleChunks,
  shouldBuildSurvivalChunkColliders,
  shouldRenderSurvivalTerrainSkirt,
} from "./survivalChunks";
import { makeSurvivalRiverSurfaceGeometry } from "./survivalRivers";
import { SURVIVAL_GRASS_SYSTEM_ENABLED } from "../vegetation/survivalGrassSystemConfig";
import {
  hasSurvivalVillage,
  isLilyCoilQuestChunk,
  isLilyCoilRealmCenter,
} from "../villages/survivalVillageRegistry";
import {
  shouldRenderSurvivalFullVillageChunk,
  shouldRenderSurvivalMountainVillageShellChunk,
} from "../villages/survivalVillageVisibility";

const loadSurvivalChicagoCity = () => import("../villages/survivalChicagoCityRendering").then((module) => ({ default: module.SurvivalChicagoCity }));
const loadSurvivalDarrelGrove = () => import("../villages/survivalDarrelGroveRendering").then((module) => ({ default: module.SurvivalDarrelGrove }));
const loadSurvivalDesertVillage = () => import("../villages/survivalDesertVillageRendering").then((module) => ({ default: module.SurvivalDesertVillage }));
const loadSurvivalGraveyardVillage = () => import("../villages/survivalGraveyardVillageRendering").then((module) => ({ default: module.SurvivalGraveyardVillage }));
const loadSurvivalLilyCoil = () => import("../villages/survivalLilyCoilRendering").then((module) => ({ default: module.SurvivalLilyCoil }));
const loadSurvivalMountainVillage = () => import("../villages/survivalMountainVillageRendering").then((module) => ({ default: module.SurvivalMountainVillage }));
const loadSurvivalSwampVillage = () => import("../villages/survivalSwampVillageRendering").then((module) => ({ default: module.SurvivalSwampVillage }));
const loadSurvivalBotwGrassField = () => import("../vegetation/survivalBotwGrassRendering").then((module) => ({ default: module.SurvivalBotwGrassField }));
const loadSurvivalScatterProps = () => import("../vegetation/survivalScatterRendering").then((module) => ({ default: module.SurvivalScatterProps }));
const loadSurvivalWaterFeatures = () => import("./survivalWaterFeatureRendering").then((module) => ({ default: module.SurvivalWaterFeatures }));
const loadSurvivalWorldWillows = () => import("../vegetation/survivalWorldWillowRendering").then((module) => ({ default: module.SurvivalWorldWillows }));

const LazySurvivalChicagoCity = lazy(loadSurvivalChicagoCity);
const LazySurvivalDarrelGrove = lazy(loadSurvivalDarrelGrove);
const LazySurvivalDesertVillage = lazy(loadSurvivalDesertVillage);
const LazySurvivalGraveyardVillage = lazy(loadSurvivalGraveyardVillage);
const LazySurvivalLilyCoil = lazy(loadSurvivalLilyCoil);
const LazySurvivalMountainVillage = lazy(loadSurvivalMountainVillage);
const LazySurvivalSwampVillage = lazy(loadSurvivalSwampVillage);
const LazySurvivalBotwGrassField = lazy(loadSurvivalBotwGrassField);
const LazySurvivalScatterProps = lazy(loadSurvivalScatterProps);
const LazySurvivalWaterFeatures = lazy(loadSurvivalWaterFeatures);
const LazySurvivalWorldWillows = lazy(loadSurvivalWorldWillows);

const survivalVillageKindPreloadScratch = new Set<SurvivalVillageKind>();
const survivalLookaheadPrewarmByKeyScratch = new Map<string, SurvivalChunkInfo>();
const survivalVillageRendererPreloads = new Map<SurvivalVillageKind, Promise<unknown>>();

function preloadSurvivalVillageRenderer(kind: SurvivalVillageKind) {
  if (survivalVillageRendererPreloads.has(kind)) return;

  const promise =
    kind === "chicago" ? loadSurvivalChicagoCity() :
      kind === "darrel-grove" ? loadSurvivalDarrelGrove() :
        kind === "desert" ? loadSurvivalDesertVillage() :
          kind === "graveyard" ? loadSurvivalGraveyardVillage() :
            kind === "lily-coil" ? loadSurvivalLilyCoil() :
              kind === "mountain" ? loadSurvivalMountainVillage() :
                loadSurvivalSwampVillage();
  survivalVillageRendererPreloads.set(kind, promise);
  void promise.catch(() => {
    survivalVillageRendererPreloads.delete(kind);
  });
}

type SurvivalChunkRendererProps = {
  chunk: SurvivalChunkInfo;
  showBaseVillage: boolean;
  visibleChunkKeys: ReadonlySet<string>;
};

function prewarmSurvivalChunkGeometry(chunk: SurvivalChunkInfo) {
  makeSurvivalTerrainGeometry(chunk);
  if (shouldBuildSurvivalChunkColliders(chunk)) {
    makeSurvivalTerrainCollisionGeometry(chunk);
  }
  if (shouldRenderSurvivalTerrainSkirt(chunk)) {
    makeSurvivalTerrainSkirtGeometry(chunk, SURVIVAL_ALL_TERRAIN_SKIRT_EDGES);
  }
  if (chunk.hasRiver) {
    makeSurvivalRiverSurfaceGeometry(chunk, getSurvivalTerrainHeightForChunk);
  }
}

function appendSurvivalLookaheadPrewarmChunks(
  targetCx: number,
  targetCz: number,
  prewarmByKey: Map<string, SurvivalChunkInfo>,
) {
  const targetChunks = makeSurvivalChunks(targetCx, targetCz, true, SURVIVAL_RENDER_RADIUS);
  for (const chunk of targetChunks) {
    const key = `${chunk.key}:${chunk.lod}`;
    if (!prewarmByKey.has(key)) prewarmByKey.set(key, chunk);
  }
}

function SurvivalChunk({
  chunk,
  showBaseVillage,
  visibleChunkKeys,
}: SurvivalChunkRendererProps) {
  if (chunk.cx === 0 && chunk.cz === 0 && showBaseVillage) {
    return null;
  }

  if (isLilyCoilQuestChunk(chunk.cx, chunk.cz)) {
    return (
      <Suspense fallback={null}>
        <LazySurvivalLilyCoil chunk={{ ...chunk, hasVillage: true, villageKind: "lily-coil", lod: chunk.lod === "far" ? "mid" : chunk.lod }} />
      </Suspense>
    );
  }

  if (shouldRenderSurvivalFullVillageChunk(chunk)) {
    if (chunk.villageKind === "chicago") {
      return (
        <Suspense fallback={null}>
          <LazySurvivalChicagoCity
            chunk={chunk}
            villageBaseHeightForChunk={getSurvivalVillageBaseHeight}
            makeVillagePadGeometry={makeSurvivalVillagePadGeometry}
            makeVillagePadSkirtGeometry={makeSurvivalVillagePadSkirtGeometry}
          />
        </Suspense>
      );
    }
    if (chunk.villageKind === "desert") {
      return (
        <Suspense fallback={null}>
          <LazySurvivalDesertVillage
            chunk={chunk}
            terrainHeightForChunk={getSurvivalTerrainHeightForChunk}
            villageBaseHeightForChunk={getSurvivalVillageBaseHeight}
            villagePadHeightForChunk={getSurvivalVillagePadHeight}
            makeVillagePadGeometry={makeSurvivalVillagePadGeometry}
            makeVillagePadSkirtGeometry={makeSurvivalVillagePadSkirtGeometry}
          />
        </Suspense>
      );
    }
    if (chunk.villageKind === "swamp") {
      return (
        <Suspense fallback={null}>
          <LazySurvivalSwampVillage
            chunk={chunk}
            villageBaseHeightForChunk={getSurvivalVillageBaseHeight}
            makeVillagePadGeometry={makeSurvivalVillagePadGeometry}
            makeVillagePadSkirtGeometry={makeSurvivalVillagePadSkirtGeometry}
            getWaterLevelAtWorld={getSurvivalWaterLevelAtWorld}
          />
        </Suspense>
      );
    }
    if (chunk.villageKind === "graveyard") {
      return (
        <Suspense fallback={null}>
          <LazySurvivalGraveyardVillage
            chunk={chunk}
            terrainHeightForChunk={getSurvivalTerrainHeightForChunk}
            terrainColorAtWorld={getSurvivalSmoothedTerrainColor}
            villageBaseHeightForChunk={getSurvivalVillageBaseHeight}
          />
        </Suspense>
      );
    }
    if (chunk.villageKind === "mountain") {
      return (
        <Suspense fallback={null}>
          <LazySurvivalMountainVillage
            chunk={chunk}
            terrainHeightForChunk={getSurvivalTerrainHeightForChunk}
            terrainColorAtWorld={getSurvivalSmoothedTerrainColor}
            villageBaseHeightForChunk={getSurvivalVillageBaseHeight}
          />
        </Suspense>
      );
    }
    if (chunk.villageKind === "darrel-grove") {
      return (
        <Suspense fallback={null}>
          <LazySurvivalDarrelGrove chunk={chunk} />
        </Suspense>
      );
    }
    if (chunk.villageKind === "lily-coil") {
      return (
        <Suspense fallback={null}>
          <LazySurvivalLilyCoil chunk={chunk} />
        </Suspense>
      );
    }
  }

  return (
    <group name={`survival-chunk-${chunk.key}`}>
      <SurvivalTerrain chunk={chunk} visibleChunkKeys={visibleChunkKeys} />
      {chunk.lod !== "far" && (
        <Suspense fallback={null}>
          <LazySurvivalWaterFeatures
            chunk={chunk}
            terrainHeightForChunk={getSurvivalTerrainHeightForChunk}
            grassSystemEnabled={SURVIVAL_GRASS_SYSTEM_ENABLED}
          />
        </Suspense>
      )}
      {chunk.lod === "far"
        ? null
        : (
          <Suspense fallback={null}>
            <LazySurvivalScatterProps
              chunk={chunk}
              grassSystemEnabled={SURVIVAL_GRASS_SYSTEM_ENABLED}
              getSurfaceQuality={getSurvivalDecorationSurfaceQuality}
              terrainHeightForChunk={getSurvivalTerrainHeightForChunk}
              getWaterLevelAtWorld={getSurvivalWaterLevelAtWorld}
            />
          </Suspense>
        )}
    </group>
  );
}

export function SurvivalProceduralWorld({
  showBaseVillage,
}: { showBaseVillage: boolean }) {
  const mobilePerformanceMode = useMemo(() => isMobilePerformanceMode(), []);
  const grassInspectionView = useMemo(() => isSurvivalGrassInspectionView(), []);
  const [centerChunk, setCenterChunk] = useState(() => getInitialSurvivalCenterChunkCoords());
  const [chunkStreamRadius, setChunkStreamRadius] = useState(SURVIVAL_CHUNK_STREAM_INITIAL_RADIUS);
  const [travelLookaheadStep, setTravelLookaheadStep] = useState({ cx: 0, cz: 0 });
  const lastPlayerMoveRef = useRef({ x: 0, z: 0, hasValue: false });

  useEffect(() => {
    const handlePlayerMove = (event: Event) => {
      const detail = (event as CustomEvent<{ x: number; z: number }>).detail;
      if (!detail) return;
      const previousMove = lastPlayerMoveRef.current;
      if (previousMove.hasValue) {
        const deltaX = detail.x - previousMove.x;
        const deltaZ = detail.z - previousMove.z;
        const distanceSq = deltaX * deltaX + deltaZ * deltaZ;
        if (distanceSq > 0.0625) {
          const distance = Math.sqrt(distanceSq);
          const directionX = deltaX / distance;
          const directionZ = deltaZ / distance;
          let nextStepCx = 0;
          let nextStepCz = 0;
          if (Math.abs(directionX) >= Math.abs(directionZ)) {
            nextStepCx = Math.abs(directionX) > 0.28 ? Math.sign(directionX) : 0;
          } else {
            nextStepCz = Math.abs(directionZ) > 0.28 ? Math.sign(directionZ) : 0;
          }
          startTransition(() => {
            setTravelLookaheadStep((current) => (
              current.cx === nextStepCx && current.cz === nextStepCz ? current : { cx: nextStepCx, cz: nextStepCz }
            ));
          });
        }
      }
      previousMove.x = detail.x;
      previousMove.z = detail.z;
      previousMove.hasValue = true;

      startTransition(() => {
        setCenterChunk((current) => {
          let nextCx = current.cx;
          let nextCz = current.cz;
          let localX = detail.x - nextCx * SURVIVAL_BLOCK_SIZE;
          let localZ = detail.z - nextCz * SURVIVAL_BLOCK_SIZE;

          while (localX > SURVIVAL_CHUNK_CENTER_HYSTERESIS) {
            nextCx += 1;
            localX -= SURVIVAL_BLOCK_SIZE;
          }
          while (localX < -SURVIVAL_CHUNK_CENTER_HYSTERESIS) {
            nextCx -= 1;
            localX += SURVIVAL_BLOCK_SIZE;
          }
          while (localZ > SURVIVAL_CHUNK_CENTER_HYSTERESIS) {
            nextCz += 1;
            localZ -= SURVIVAL_BLOCK_SIZE;
          }
          while (localZ < -SURVIVAL_CHUNK_CENTER_HYSTERESIS) {
            nextCz -= 1;
            localZ += SURVIVAL_BLOCK_SIZE;
          }

          return current.cx === nextCx && current.cz === nextCz ? current : { cx: nextCx, cz: nextCz };
        });
      });
    };

    window.addEventListener("player-moved", handlePlayerMove);
    return () => window.removeEventListener("player-moved", handlePlayerMove);
  }, []);

  useEffect(() => {
    const baseRadius = Math.max(chunkStreamRadius, SURVIVAL_CHUNK_STREAM_INITIAL_RADIUS);

    startTransition(() => {
      setChunkStreamRadius(baseRadius);
    });

    const timers: number[] = [];
    const radiusSteps = Math.max(0, SURVIVAL_RENDER_RADIUS - baseRadius);
    for (let index = 0; index < radiusSteps; index += 1) {
      timers.push(window.setTimeout(() => {
        startTransition(() => {
          setChunkStreamRadius((current) => Math.max(current, baseRadius + index + 1));
        });
      }, getSurvivalChunkStreamDelay(index)));
    }

    return () => {
      for (const timer of timers) {
        window.clearTimeout(timer);
      }
    };
  }, [centerChunk.cx, centerChunk.cz]);

  const chunks = useMemo(
    // Keep the authored base chunk in the stream as a stable placeholder; SurvivalChunk
    // returns null for 0:0 while the base village owns that terrain/collider.
    () => makeSurvivalChunks(centerChunk.cx, centerChunk.cz, true, chunkStreamRadius),
    [centerChunk, chunkStreamRadius],
  );

  useEffect(() => {
    if (typeof window === "undefined" || chunks.length === 0) return undefined;

    const villageKinds = survivalVillageKindPreloadScratch;
    villageKinds.clear();
    for (const chunk of chunks) {
      if (isLilyCoilQuestChunk(chunk.cx, chunk.cz)) {
        villageKinds.add("lily-coil");
        continue;
      }
      if (!chunk.villageKind) continue;
      if (shouldRenderSurvivalFullVillageChunk(chunk) || shouldRenderSurvivalMountainVillageShellChunk(chunk)) {
        villageKinds.add(chunk.villageKind);
      }
    }
    if (villageKinds.size === 0) {
      villageKinds.clear();
      return undefined;
    }

    let cancelled = false;
    const orderedKinds: SurvivalVillageKind[] = [];
    for (const kind of villageKinds) {
      orderedKinds.push(kind);
    }
    villageKinds.clear();
    const task = scheduleSurvivalBackgroundTask(() => {
      if (cancelled) return;
      for (const kind of orderedKinds) {
        preloadSurvivalVillageRenderer(kind);
      }
      publishSurvivalVillageRendererPreloads(orderedKinds);
    }, 850);

    return () => {
      cancelled = true;
      task.cancel();
    };
  }, [chunks]);

  useEffect(() => {
    if (typeof window === "undefined" || chunks.length === 0) return undefined;

    let cancelled = false;
    let task: SurvivalScheduledBackgroundTask | null = null;
    let timer: number | null = null;
    let index = 0;

    const runPrewarmSlice = () => {
      task = null;
      if (cancelled) return;

      if (index < chunks.length) {
        prewarmSurvivalChunkGeometry(chunks[index]);
        index += 1;
      }

      if (index < chunks.length) {
        timer = window.setTimeout(() => {
          timer = null;
          task = scheduleSurvivalBackgroundTask(runPrewarmSlice, 900);
        }, 90);
      }
    };

    task = scheduleSurvivalBackgroundTask(runPrewarmSlice, 900);

    return () => {
      cancelled = true;
      task?.cancel();
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [chunks]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const stepCx = travelLookaheadStep.cx;
    const stepCz = travelLookaheadStep.cz;
    if (!stepCx && !stepCz) return undefined;

    const prewarmByKey = survivalLookaheadPrewarmByKeyScratch;
    prewarmByKey.clear();

    if (stepCx && stepCz) {
      appendSurvivalLookaheadPrewarmChunks(centerChunk.cx + stepCx, centerChunk.cz + stepCz, prewarmByKey);
    }
    if (stepCx) appendSurvivalLookaheadPrewarmChunks(centerChunk.cx + stepCx, centerChunk.cz, prewarmByKey);
    if (stepCz) appendSurvivalLookaheadPrewarmChunks(centerChunk.cx, centerChunk.cz + stepCz, prewarmByKey);

    const prewarmChunks: SurvivalChunkInfo[] = [];
    for (const chunk of prewarmByKey.values()) {
      prewarmChunks.push(chunk);
    }
    prewarmByKey.clear();
    let cancelled = false;
    let task: SurvivalScheduledBackgroundTask | null = null;
    let timer: number | null = null;
    let index = 0;

    const runPrewarmSlice = () => {
      task = null;
      if (cancelled) return;

      if (isSurvivalBotwGrassWarmupBlockingChunkPrewarm()) {
        timer = window.setTimeout(() => {
          timer = null;
          task = scheduleSurvivalBackgroundTask(runPrewarmSlice, 700);
        }, 180);
        return;
      }

      if (index < prewarmChunks.length) {
        prewarmSurvivalChunkGeometry(prewarmChunks[index]);
        index += 1;
      }

      if (index < prewarmChunks.length) {
        timer = window.setTimeout(() => {
          timer = null;
          task = scheduleSurvivalBackgroundTask(runPrewarmSlice, 900);
        }, 80);
      }
    };

    task = scheduleSurvivalBackgroundTask(runPrewarmSlice, 700);

    return () => {
      cancelled = true;
      task?.cancel();
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [
    centerChunk.cx,
    centerChunk.cz,
    travelLookaheadStep.cx,
    travelLookaheadStep.cz,
  ]);

  const [visibleChunks, setVisibleChunks] = useState<SurvivalChunkInfo[]>(() => getInitialSurvivalVisibleChunks(chunks));
  const visibleChunksRef = useRef(visibleChunks);
  useEffect(() => {
    visibleChunksRef.current = visibleChunks;
  }, [visibleChunks]);

  const visibleChunkKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const chunk of visibleChunks) {
      keys.add(chunk.key);
    }
    return keys;
  }, [visibleChunks]);

  useEffect(() => {
    if (chunks.length === 0 || typeof window === "undefined") {
      visibleChunksRef.current = [];
      setVisibleChunks([]);
      return undefined;
    }

    let cancelled = false;
    let mountTask: SurvivalScheduledBackgroundTask | null = null;
    let mountTimer: number | null = null;
    const intervalMs = mobilePerformanceMode
      ? SURVIVAL_CHUNK_MOBILE_MOUNT_INTERVAL_MS
      : SURVIVAL_CHUNK_MOUNT_INTERVAL_MS;

    const applyVisibleChunkStep = (addCount: number) => {
      const previousChunks = visibleChunksRef.current;
      const nextChunks = reconcileSurvivalVisibleChunks(previousChunks, chunks, addCount);
      if (nextChunks === previousChunks) return false;

      visibleChunksRef.current = nextChunks;
      startTransition(() => {
        setVisibleChunks(nextChunks);
      });
      return true;
    };

    const scheduleNextMountStep = () => {
      if (cancelled) return;

      mountTimer = window.setTimeout(() => {
        mountTimer = null;
        if (cancelled) return;

        mountTask = scheduleSurvivalBackgroundTask(() => {
          mountTask = null;
          if (cancelled) return;
          if (applyVisibleChunkStep(SURVIVAL_CHUNK_MOUNT_BATCH)) {
            scheduleNextMountStep();
          }
        }, intervalMs);
      }, intervalMs);
    };

    applyVisibleChunkStep(visibleChunksRef.current.length === 0 ? SURVIVAL_CHUNK_MOUNT_BATCH : 0);
    scheduleNextMountStep();

    return () => {
      cancelled = true;
      mountTask?.cancel();
      if (mountTimer !== null) window.clearTimeout(mountTimer);
    };
  }, [chunks, mobilePerformanceMode]);

  useEffect(() => {
    publishSurvivalProceduralWorldStreamTelemetry({
      centerCx: centerChunk.cx,
      centerCz: centerChunk.cz,
      chunkStreamRadius,
      chunks,
      visibleChunks,
    });
  }, [
    centerChunk.cx,
    centerChunk.cz,
    chunkStreamRadius,
    chunks.length,
    visibleChunks,
  ]);

  return (
    <group name="survival-procedural-world">
      <SurvivalTerrainTintRuntime mobilePerformanceMode={mobilePerformanceMode} />
      {visibleChunks.map((chunk) => (
        <SurvivalChunk
          key={chunk.key}
          chunk={chunk}
          showBaseVillage={showBaseVillage}
          visibleChunkKeys={visibleChunkKeys}
        />
      ))}
      <Suspense fallback={null}>
        <LazySurvivalBotwGrassField disabled={isLilyCoilRealmCenter(centerChunk.cx, centerChunk.cz)} />
      </Suspense>
      {!grassInspectionView && (
        <Suspense fallback={null}>
          <LazySurvivalWorldWillows
            centerChunk={centerChunk}
            renderRadius={SURVIVAL_RENDER_RADIUS}
            getChunkCoord={getSurvivalChunkCoord}
            getBiome={getSurvivalBiome}
            getRawTerrainHeightAtWorld={getSurvivalRawTerrainHeightAtWorld}
            getWaterLevelAtWorld={getSurvivalWaterLevelAtWorld}
            hasVillage={hasSurvivalVillage}
          />
        </Suspense>
      )}
    </group>
  );
}
