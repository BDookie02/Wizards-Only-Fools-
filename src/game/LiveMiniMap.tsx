import { useFBO, Hud, OrthographicCamera } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useEffect, useRef, useMemo } from "react";
import { useGameStore } from "../store/gameStore";
import { isMobilePerformanceMode } from "./performanceMode";

function shouldHideForMiniMap(object: THREE.Object3D) {
  return object.name === "horizon-cylinder" || object.name.startsWith("survival-sky-");
}

const COMPACT_MINIMAP_VIEW_SIZE = 80;
const EXPANDED_MAP_VIEW_SIZE = 720;
const EXPANDED_MAP_VIEW_SIZE_MOBILE = 520;

export function LiveMiniMap() {
  const isExpanded = useGameStore(s => s.isMapExpanded);
  const isSpellMenuOpen = useGameStore(s => s.isSpellMenuOpen);
  const isPauseMenuOpen = useGameStore(s => s.isPauseMenuOpen);
  const isScoreboardOpen = useGameStore(s => s.isScoreboardOpen);
  const mobilePerformanceMode = useMemo(() => isMobilePerformanceMode(), []);
  const mapTargetSize = mobilePerformanceMode ? 96 : 256;
  const circleSegments = mobilePerformanceMode ? 36 : 64;
  
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
    ? Math.max(48, Math.min(minViewportSide * 0.28, 62))
    : isTallNarrowViewport
    ? Math.max(82, Math.min(minViewportSide * 0.20, 108))
    : (isShortViewport || isNarrowViewport)
      ? Math.max(70, Math.min(minViewportSide * 0.22, 88))
      : Math.max(82, Math.min(minViewportSide * 0.18, 176));
  const miniMapRadius = miniMapSize / 2;
  const miniMapInset = isUltraShortViewport
    ? Math.max(3, Math.min(minViewportSide * 0.018, 8))
    : Math.max(8, Math.min(minViewportSide * 0.02, 16));

  const playerPos = useRef({ x: 0, z: 0, angle: 0, offsetX: 0, offsetZ: 0 });
  const oldClearColorRef = useRef(new THREE.Color());
  const viewportRef = useRef(new THREE.Vector4());
  const scissorRef = useRef(new THREE.Vector4());
  const delayRenderUntilRef = useRef(0);
  const hasRenderedMapRef = useRef(false);
  const previousExpandedRef = useRef(isExpanded);

  useEffect(() => {
    document.documentElement.style.setProperty("--live-minimap-size", `${miniMapSize}px`);
    document.documentElement.style.setProperty("--live-minimap-inset", `${miniMapInset}px`);
  }, [miniMapSize, miniMapInset]);

  useEffect(() => {
    const fn = (e: any) => {
       playerPos.current.x = e.detail.x;
       playerPos.current.z = e.detail.z;
       playerPos.current.angle = e.detail.angle ?? playerPos.current.angle;
    };
    window.addEventListener('player-moved', fn);
    return () => window.removeEventListener('player-moved', fn);
  }, []);

  const lastRenderTime = useRef(0);

  useEffect(() => {
    if (previousExpandedRef.current === isExpanded) return;
    previousExpandedRef.current = isExpanded;

    // Opening/closing the map already costs a React/layout pass. If we have a
    // cached map texture, wait a beat before the extra scene render.
    if (hasRenderedMapRef.current) {
      delayRenderUntilRef.current = performance.now() + (mobilePerformanceMode ? 220 : 110);
    }
  }, [isExpanded, mobilePerformanceMode]);

  useFrame((state) => {
    if (isScoreboardOpen || isSpellMenuOpen || isPauseMenuOpen) return;

    const now = performance.now();
    if (now < delayRenderUntilRef.current) return;

    const renderInterval = mobilePerformanceMode ? (isExpanded ? 700 : 1600) : (isExpanded ? 180 : 420);
    if (now - lastRenderTime.current < renderInterval) return;
    lastRenderTime.current = now;

    const viewSize = isExpanded
      ? (mobilePerformanceMode ? EXPANDED_MAP_VIEW_SIZE_MOBILE : EXPANDED_MAP_VIEW_SIZE)
      : COMPACT_MINIMAP_VIEW_SIZE;
    const aspect = 1; // Always square
    
    mapCamera.left = -viewSize * aspect;
    mapCamera.right = viewSize * aspect;
    mapCamera.top = viewSize;
    mapCamera.bottom = -viewSize;
    
    // Follow the player for both the small minimap and the expanded M-map so
    // survival villages far from world zero still show live local terrain.
    mapCamera.position.set(playerPos.current.x, 200, playerPos.current.z);
    
    mapCamera.updateProjectionMatrix();
    mapCamera.updateMatrixWorld();
    
    const oldClearColor = oldClearColorRef.current;
    state.gl.getClearColor(oldClearColor);
    const oldClearAlpha = state.gl.getClearAlpha();
    
    const oldSceneBg = state.scene.background;
    state.scene.background = null; // Prevent scene background from interfering
    const hiddenForMap: THREE.Object3D[] = [];
    state.scene.traverse((object) => {
      if (object.visible && shouldHideForMiniMap(object)) {
        object.visible = false;
        hiddenForMap.push(object);
      }
    });
    
    const oldRenderTarget = state.gl.getRenderTarget();
    const currentViewport = state.gl.getViewport(viewportRef.current);
    const currentScissor = state.gl.getScissor(scissorRef.current);
    const currentScissorTest = state.gl.getScissorTest();
    
    state.gl.setRenderTarget(mapTarget);
    state.gl.setClearColor('#3a6828', 1);
    state.gl.clear(true, true, true);
    state.gl.render(state.scene, mapCamera);
    hiddenForMap.forEach((object) => {
      object.visible = true;
    });
    
    state.scene.background = oldSceneBg;
    state.gl.setClearColor(oldClearColor, oldClearAlpha);
    state.gl.setRenderTarget(oldRenderTarget);
    state.gl.setViewport(currentViewport);
    state.gl.setScissor(currentScissor);
    state.gl.setScissorTest(currentScissorTest);
    hasRenderedMapRef.current = true;
  });

  return (
    <Hud renderPriority={1}>
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
      <group position={[0, 0, 0]} visible={isExpanded && !isSpellMenuOpen && !isPauseMenuOpen && !isScoreboardOpen}>
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
      <group position={[size.width / 2 - miniMapInset - miniMapRadius, size.height / 2 - miniMapInset - miniMapRadius, 0]} visible={!isExpanded && !isSpellMenuOpen && !isPauseMenuOpen && !isScoreboardOpen}>
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
