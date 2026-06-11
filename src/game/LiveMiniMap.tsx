import { useFBO, Hud, OrthographicCamera } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useEffect, useRef, useMemo, type MutableRefObject } from "react";
import { useGameStore } from "../store/gameStore";
import { isMobilePerformanceMode } from "./systems/input/performanceMode";
import {
  createLiveMiniMapHiddenObjectCache,
  getCachedHiddenMiniMapObjects,
  getLiveMiniMapCameraCenterInto,
  getLiveMiniMapCircleSegments,
  getLiveMiniMapTargetSize,
  getLiveMiniMapToggleDelayMs,
  getLiveMiniMapViewSize,
  hideMiniMapObjectsForRender,
  shouldRenderLiveMiniMapFrame,
  restoreMiniMapObjectsAfterRender,
} from "./systems/rendering/minimap/liveMiniMapRuntime";
import { getPublishedLastPlayerYaw, getPublishedLocalPlayerPosition } from "./systems/player/playerEventBridge";
import { isMapUiBlockedByModal } from "./ui/hud/mapVisibilityRuntime";

type LiveMiniMapPlayerPositionRef = MutableRefObject<{ x: number; z: number; angle: number; offsetX: number; offsetZ: number }>;

function syncLiveMiniMapPlayerFromPublishedState(playerPos: LiveMiniMapPlayerPositionRef["current"]) {
  const publishedPosition = getPublishedLocalPlayerPosition();
  if (publishedPosition) {
    playerPos.x = publishedPosition.x;
    playerPos.z = publishedPosition.z;
  }

  const publishedYaw = getPublishedLastPlayerYaw();
  if (publishedYaw !== undefined) {
    playerPos.angle = publishedYaw;
  }
}

export function LiveMiniMap() {
  const isExpanded = useGameStore(s => s.isMapExpanded);
  const isSpellMenuOpen = useGameStore(s => s.isSpellMenuOpen);
  const isPauseMenuOpen = useGameStore(s => s.isPauseMenuOpen);
  const isScoreboardOpen = useGameStore(s => s.isScoreboardOpen);
  const isInventoryOpen = useGameStore(s => s.isInventoryOpen);
  const expandedMapPage = useGameStore(s => s.expandedMapPage);
  const mapUiBlockedByModal = isMapUiBlockedByModal({
    isInventoryOpen,
    isPauseMenuOpen,
    isScoreboardOpen,
    isSpellMenuOpen,
  });
  const mobilePerformanceMode = useMemo(() => isMobilePerformanceMode(), []);
  const mapTargetSize = getLiveMiniMapTargetSize(mobilePerformanceMode);
  const circleSegments = getLiveMiniMapCircleSegments(mobilePerformanceMode);
  
  // Keep the minimap render target modest; it is redrawn repeatedly from above.
  const mapTarget = useFBO(mapTargetSize, mapTargetSize, {
      format: THREE.RGBAFormat,
      samples: 0,
      stencilBuffer: false,
  });
  
  const mapCamera = useMemo(() => {
     // Default size will be updated in useFrame depending on state
     const cam = new THREE.OrthographicCamera(-100, 100, 100, -100, 0.1, 1000);
     cam.rotation.set(-Math.PI / 2, 0, 0);
     cam.position.set(0, 200, 0);
     return cam;
  }, []);

  const { size } = useThree();
  const minViewportSide = Math.min(size.width, size.height);
  const isUltraShortViewport = size.height <= 260;
  const isShortViewport = size.height <= 390;
  const isNarrowViewport = size.width <= 430;
  const isTallNarrowViewport = isNarrowViewport && size.height >= 470;
  const miniMapSize = isUltraShortViewport
    ? Math.max(56, Math.min(minViewportSide * 0.32, 70))
    : isTallNarrowViewport
    ? Math.max(98, Math.min(minViewportSide * 0.25, 132))
    : (isShortViewport || isNarrowViewport)
      ? Math.max(84, Math.min(minViewportSide * 0.26, 112))
      : Math.max(104, Math.min(minViewportSide * 0.22, 212));
  const miniMapRadius = miniMapSize / 2;
  const miniMapInset = isUltraShortViewport
    ? Math.max(3, Math.min(minViewportSide * 0.018, 8))
    : Math.max(8, Math.min(minViewportSide * 0.02, 16));

  const playerPos = useRef({ x: 0, z: 0, angle: 0, offsetX: 0, offsetZ: 0 });
  const oldClearColorRef = useRef(new THREE.Color());
  const viewportRef = useRef(new THREE.Vector4());
  const scissorRef = useRef(new THREE.Vector4());
  const hiddenForMapRef = useRef<THREE.Object3D[]>([]);
  const hiddenObjectCacheRef = useRef(createLiveMiniMapHiddenObjectCache());
  const delayRenderUntilRef = useRef(0);
  const pendingToggleDelayMsRef = useRef(0);
  const hasRenderedMapRef = useRef(false);
  const previousExpandedRef = useRef(isExpanded);
  const lastRenderedPlayerRef = useRef({ x: Number.POSITIVE_INFINITY, z: Number.POSITIVE_INFINITY, expanded: false });
  const mapCenterRef = useRef({ x: 0, z: 0 });
  const shouldTrackLiveMiniMapPlayer = !mapUiBlockedByModal && !(isExpanded && expandedMapPage === "world");

  useEffect(() => {
    document.documentElement.style.setProperty("--live-minimap-size", `${miniMapSize}px`);
    document.documentElement.style.setProperty("--live-minimap-inset", `${miniMapInset}px`);
  }, [miniMapSize, miniMapInset]);

  useEffect(() => {
    if (!shouldTrackLiveMiniMapPlayer) return;

    syncLiveMiniMapPlayerFromPublishedState(playerPos.current);

    const fn = (e: any) => {
       playerPos.current.x = e.detail.x;
       playerPos.current.z = e.detail.z;
       playerPos.current.angle = e.detail.angle ?? playerPos.current.angle;
    };
    window.addEventListener('player-moved', fn);
    return () => window.removeEventListener('player-moved', fn);
  }, [shouldTrackLiveMiniMapPlayer]);

  const lastRenderTime = useRef(0);

  useEffect(() => {
    if (previousExpandedRef.current === isExpanded) return;
    previousExpandedRef.current = isExpanded;

    // Opening/closing the map already costs a React/layout pass. If we have a
    // cached map texture, wait a beat before the extra scene render.
    if (hasRenderedMapRef.current) {
      pendingToggleDelayMsRef.current = getLiveMiniMapToggleDelayMs(mobilePerformanceMode);
    }
  }, [isExpanded, mobilePerformanceMode]);

  const shouldMountLiveMiniMapRenderer = shouldTrackLiveMiniMapPlayer;

  return (
    <Hud renderPriority={1}>
      {shouldMountLiveMiniMapRenderer && (
        <LiveMiniMapFrameRenderer
          isExpanded={isExpanded}
          mobilePerformanceMode={mobilePerformanceMode}
          mapCamera={mapCamera}
          mapTarget={mapTarget}
          playerPos={playerPos}
          oldClearColorRef={oldClearColorRef}
          viewportRef={viewportRef}
          scissorRef={scissorRef}
          hiddenForMapRef={hiddenForMapRef}
          hiddenObjectCacheRef={hiddenObjectCacheRef}
          delayRenderUntilRef={delayRenderUntilRef}
          pendingToggleDelayMsRef={pendingToggleDelayMsRef}
          hasRenderedMapRef={hasRenderedMapRef}
          lastRenderedPlayerRef={lastRenderedPlayerRef}
          lastRenderTimeRef={lastRenderTime}
          mapCenterRef={mapCenterRef}
        />
      )}
      <OrthographicCamera
        makeDefault
        position={[0, 0, 10]}
        zoom={1}
        top={size.height / 2}
        bottom={-size.height / 2}
        left={-size.width / 2}
        right={size.width / 2}
        near={0.1}
        far={100}
      />
      
      {/* Expanded Map */}
      <group position={[0, 0, 0]} visible={isExpanded && expandedMapPage === "live" && !mapUiBlockedByModal}>
          {/* Box background for the square map */}
          <mesh position={[0, 0, -1]}>
             <planeGeometry args={[Math.min(size.width * 0.8, size.height * 0.8, 800) + 16, Math.min(size.width * 0.8, size.height * 0.8, 800) + 16]} />
             <meshBasicMaterial color="#5d466e" />
          </mesh>
          <mesh position={[0, 0, -0.5]}>
             <planeGeometry args={[Math.min(size.width * 0.8, size.height * 0.8, 800) + 8, Math.min(size.width * 0.8, size.height * 0.8, 800) + 8]} />
             <meshBasicMaterial color="#1c1421" />
          </mesh>
          {/* The Live Map Square */}
          <mesh position={[0, 0, 0]}>
             <planeGeometry args={[Math.min(size.width * 0.8, size.height * 0.8, 800), Math.min(size.width * 0.8, size.height * 0.8, 800)]} />
             <meshBasicMaterial map={mapTarget.texture} dispose={null} />
          </mesh>
      </group>

      {/* Small MiniMap */}
      <group position={[size.width / 2 - miniMapInset - miniMapRadius, size.height / 2 - miniMapInset - miniMapRadius, 0]} visible={!isExpanded && !mapUiBlockedByModal}>
          {/* Draw border matching wizard-panel */}
          <mesh position={[0, 0, -2]}>
             <circleGeometry args={[miniMapRadius + 4, circleSegments]} />
             <meshBasicMaterial color="#5d466e" />
          </mesh>
          <mesh position={[2, -2, -1.9]}>
             <circleGeometry args={[miniMapRadius + 4, circleSegments]} />
             <meshBasicMaterial color="#1c1421" />
          </mesh>
          <mesh position={[0, 0, -1]}>
             <circleGeometry args={[miniMapRadius, circleSegments]} />
             <meshBasicMaterial color="#333" />
          </mesh>
          <mesh position={[0, 0, 0]}>
             <circleGeometry args={[miniMapRadius, circleSegments]} />
             <meshBasicMaterial map={mapTarget.texture} transparent opacity={1} dispose={null} />
          </mesh>
      </group>
    </Hud>
  );
}

function LiveMiniMapFrameRenderer({
  isExpanded,
  mobilePerformanceMode,
  mapCamera,
  mapTarget,
  playerPos,
  oldClearColorRef,
  viewportRef,
  scissorRef,
  hiddenForMapRef,
  hiddenObjectCacheRef,
  delayRenderUntilRef,
  pendingToggleDelayMsRef,
  hasRenderedMapRef,
  lastRenderedPlayerRef,
  lastRenderTimeRef,
  mapCenterRef,
}: {
  isExpanded: boolean;
  mobilePerformanceMode: boolean;
  mapCamera: THREE.OrthographicCamera;
  mapTarget: THREE.WebGLRenderTarget;
  playerPos: LiveMiniMapPlayerPositionRef;
  oldClearColorRef: MutableRefObject<THREE.Color>;
  viewportRef: MutableRefObject<THREE.Vector4>;
  scissorRef: MutableRefObject<THREE.Vector4>;
  hiddenForMapRef: MutableRefObject<THREE.Object3D[]>;
  hiddenObjectCacheRef: MutableRefObject<ReturnType<typeof createLiveMiniMapHiddenObjectCache>>;
  delayRenderUntilRef: MutableRefObject<number>;
  pendingToggleDelayMsRef: MutableRefObject<number>;
  hasRenderedMapRef: MutableRefObject<boolean>;
  lastRenderedPlayerRef: MutableRefObject<{ x: number; z: number; expanded: boolean }>;
  lastRenderTimeRef: MutableRefObject<number>;
  mapCenterRef: MutableRefObject<{ x: number; z: number }>;
}) {
  useFrame((state) => {
    const now = state.clock.elapsedTime * 1000;
    const pendingToggleDelayMs = pendingToggleDelayMsRef.current;
    if (pendingToggleDelayMs > 0) {
      delayRenderUntilRef.current = now + pendingToggleDelayMs;
      pendingToggleDelayMsRef.current = 0;
    }

    const lastRenderedPlayer = lastRenderedPlayerRef.current;
    if (!shouldRenderLiveMiniMapFrame({
      now,
      delayRenderUntil: delayRenderUntilRef.current,
      lastRenderTime: lastRenderTimeRef.current,
      isExpanded,
      mobilePerformanceMode,
      hasRenderedMap: hasRenderedMapRef.current,
      player: playerPos.current,
      lastRenderedPlayer,
    })) return;

    lastRenderTimeRef.current = now;

    const viewSize = getLiveMiniMapViewSize(isExpanded);
    const aspect = 1;

    mapCamera.left = -viewSize * aspect;
    mapCamera.right = viewSize * aspect;
    mapCamera.top = viewSize;
    mapCamera.bottom = -viewSize;

    const mapCenter = getLiveMiniMapCameraCenterInto(playerPos.current, isExpanded, mapCenterRef.current);
    mapCamera.position.set(mapCenter.x, isExpanded ? 520 : 200, mapCenter.z);

    mapCamera.updateProjectionMatrix();
    mapCamera.updateMatrixWorld();

    const oldClearColor = oldClearColorRef.current;
    state.gl.getClearColor(oldClearColor);
    const oldClearAlpha = state.gl.getClearAlpha();

    const oldSceneBg = state.scene.background;
    state.scene.background = null;
    const hiddenForMap = hiddenForMapRef.current;
    const hiddenCandidates = getCachedHiddenMiniMapObjects(state.scene, hiddenObjectCacheRef.current, now);
    hideMiniMapObjectsForRender(hiddenCandidates, hiddenForMap);

    const oldRenderTarget = state.gl.getRenderTarget();
    const currentViewport = state.gl.getViewport(viewportRef.current);
    const currentScissor = state.gl.getScissor(scissorRef.current);
    const currentScissorTest = state.gl.getScissorTest();

    state.gl.setRenderTarget(mapTarget);
    try {
      state.gl.setClearColor("#3a6828", 1);
      state.gl.clear(true, true, true);
      state.gl.render(state.scene, mapCamera);
    } finally {
      restoreMiniMapObjectsAfterRender(hiddenForMap);
      state.scene.background = oldSceneBg;
      state.gl.setClearColor(oldClearColor, oldClearAlpha);
      state.gl.setRenderTarget(oldRenderTarget);
      state.gl.setViewport(currentViewport);
      state.gl.setScissor(currentScissor);
      state.gl.setScissorTest(currentScissorTest);
    }
    hasRenderedMapRef.current = true;
    lastRenderedPlayer.x = playerPos.current.x;
    lastRenderedPlayer.z = playerPos.current.z;
    lastRenderedPlayer.expanded = isExpanded;
  });

  return null;
}
