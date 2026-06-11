import { Canvas } from "@react-three/fiber";
import { Suspense, useMemo, useEffect, useState } from "react";
import { SURVIVAL_BLOCK_SIZE, useGameStore } from "../store/gameStore";
import { CanvasRuntimeProbe } from "./systems/rendering/canvas/CanvasRuntimeProbe";
import { CanvasResizeNudge } from "./systems/rendering/canvas/CanvasResizeNudge";
import { configureGameRenderer } from "./systems/rendering/canvas/configureGameRenderer";
import { applyGameCanvasElementSizing } from "./systems/rendering/canvas/gameCanvasElementSizing";
import { ImmediateResizeObserver } from "./systems/rendering/canvas/resizeObserverFallback";
import { getHorizonHillsTexture } from "./systems/rendering/sky/horizonHillsTexture";
import {
  getGameWorldCanvasStyle,
  getGameWorldHorizonConfig,
  getGameWorldLightingConfig,
} from "./systems/rendering/gameWorldCanvasConfig";
import {
  AstralRealmVeil,
  HorizonCylinder,
  SurvivalSkyCycle,
} from "./systems/rendering/sky/SurvivalSkyCycle";
import { LazyBaseVillageScene, LazyClassicSkyEnvironment, LazyDevSpellTestDummies, LazyEnginePlacedObjects, LazyGameWorldPhysicsStage, LazyLiveMiniMap, LazyNetworkManager, LazyPersistentQuestNpcs, LazyPlayerController, LazyProjectiles, LazyQuestNavigationBeacons, LazyRunes, LazySurvivalProceduralWorld } from "./systems/world/gameWorldLazyModules";
import { useBaseVillageRenderState } from "./systems/world/villages/baseVillageVisibility";
import { publishGameWorldModeTelemetry } from "./systems/world/gameWorldTelemetry";
import { isMobilePerformanceMode } from "./systems/input/performanceMode";
import { isCurrentQaTelemetryRouteEnabled } from "./tools/qa/qaRouteTelemetry";

export function GameWorld() {
  const gameMode = useGameStore(s => s.gameMode);
  const isQuestDevModeEnabled = useGameStore(s => s.isQuestDevModeEnabled);
  const isSurvivalMode = gameMode === "solo-survival" || gameMode === "multiplayer-survival";
  const isMultiplayerMode = gameMode !== "solo-survival";
  const areWorldDeveloperToolsAllowed = isSurvivalMode && (
    import.meta.env.DEV ||
    isQuestDevModeEnabled ||
    (gameMode as string) === "creative"
  );
  const mobilePerformanceMode = useMemo(() => isMobilePerformanceMode(), []);
  useEffect(() => {
    publishGameWorldModeTelemetry(gameMode, isSurvivalMode);
  }, [gameMode, isSurvivalMode]);
  const { ambientIntensity, directionalIntensity } = getGameWorldLightingConfig(isSurvivalMode, mobilePerformanceMode);
  const canvasStyle = useMemo(
    () => getGameWorldCanvasStyle(isSurvivalMode, mobilePerformanceMode),
    [isSurvivalMode, mobilePerformanceMode],
  );
  const horizonConfig = getGameWorldHorizonConfig(isSurvivalMode);
  const {
    renderBaseVillageContent,
    showBaseVillagePeople,
    showBaseVillageProps,
    showBaseVillageTreeHouse,
  } = useBaseVillageRenderState(isSurvivalMode);

  const hillsTexture = useMemo(() => getHorizonHillsTexture(), []);
  const spellDummyQaRequested = useMemo(() => isCurrentQaTelemetryRouteEnabled(["spellDummies"]), []);
  const [mountSpellDummyQa, setMountSpellDummyQa] = useState(false);

  useEffect(() => {
    if (!spellDummyQaRequested) return;
    const timeout = window.setTimeout(() => setMountSpellDummyQa(true), 650);
    return () => window.clearTimeout(timeout);
  }, [spellDummyQaRequested]);

  return (
    <Canvas 
      id="game-canvas"
      tabIndex={0}
      camera={{ fov: 75, near: 0.035, far: SURVIVAL_BLOCK_SIZE * 18 }}
      gl={{ alpha: false, antialias: false, powerPreference: "high-performance", stencil: false }} 
      dpr={mobilePerformanceMode ? 0.42 : 0.46}
      resize={{ offsetSize: true, polyfill: ImmediateResizeObserver }}
      onCreated={({ gl }) => {
        applyGameCanvasElementSizing(gl.domElement);
        configureGameRenderer(gl);
        if (spellDummyQaRequested) setMountSpellDummyQa(true);
      }}
      style={canvasStyle}
    >
      <CanvasRuntimeProbe />
      <CanvasResizeNudge />
      {mountSpellDummyQa && (
        <Suspense fallback={null}>
          <LazyDevSpellTestDummies />
        </Suspense>
      )}
      {isSurvivalMode ? (
        <SurvivalSkyCycle mobilePerformanceMode={mobilePerformanceMode} />
      ) : mobilePerformanceMode ? (
        <color attach="background" args={["#9bdcff"]} />
      ) : (
        <Suspense fallback={null}>
          <LazyClassicSkyEnvironment />
        </Suspense>
      )}
      {!isSurvivalMode && <ambientLight intensity={ambientIntensity} />}
      {!isSurvivalMode && mobilePerformanceMode && <hemisphereLight args={["#ffffff", "#a37d52", 1.18]} />}
      {!isSurvivalMode && <directionalLight position={[50, 20, 50]} intensity={directionalIntensity} />}
      <AstralRealmVeil />

      <HorizonCylinder
        texture={hillsTexture}
        radius={horizonConfig.radius}
        height={horizonConfig.height}
        y={horizonConfig.y}
        segments={horizonConfig.segments}
        followCamera={isSurvivalMode}
        dynamicCycle={isSurvivalMode}
        mobilePerformanceMode={mobilePerformanceMode}
      />

      <Suspense fallback={null}>
        <LazyGameWorldPhysicsStage>
          <LazyPlayerController />
          {isSurvivalMode && (
            <LazySurvivalProceduralWorld
              showBaseVillage={renderBaseVillageContent}
            />
          )}
          <Suspense fallback={null}>
            {isMultiplayerMode && <LazyNetworkManager />}
            <LazyProjectiles />
            {areWorldDeveloperToolsAllowed && (
              <LazyEnginePlacedObjects isSurvivalMode={isSurvivalMode} />
            )}
            {renderBaseVillageContent && (
              <LazyBaseVillageScene
                isSurvivalMode={isSurvivalMode}
                renderBaseVillageContent={renderBaseVillageContent}
                showBaseVillagePeople={showBaseVillagePeople}
                showBaseVillageProps={showBaseVillageProps}
                showBaseVillageTreeHouse={showBaseVillageTreeHouse}
              />
            )}
            <LazyLiveMiniMap />
            <LazyPersistentQuestNpcs />
            <LazyQuestNavigationBeacons />
            <LazyRunes />
          </Suspense>
        </LazyGameWorldPhysicsStage>
      </Suspense>
    </Canvas>
  );
}






