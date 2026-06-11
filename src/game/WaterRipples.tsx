import { useCallback, useEffect, useMemo, useState, useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { isMobilePerformanceMode } from './systems/input/performanceMode';
import { isCurrentQaTelemetryRouteEnabled } from './tools/qa/qaRouteTelemetry';
import {
  BASE_VILLAGE_WATER_Y,
  WATER_RIPPLE_LIFETIME_MS,
  appendWaterRipple,
  getWaterRippleCleanupDelayMs,
  isBaseVillageWaterRippleSpot,
  isWaterRippleQaEnabled,
  pruneExpiredWaterRipples,
  type WaterRipple,
} from './systems/world/water/waterRippleRuntime';

const MOBILE_WATER_RIPPLE_UPDATE_INTERVAL_SECONDS = 1 / 30;

function shouldPublishWaterRippleTelemetry() {
  return isCurrentQaTelemetryRouteEnabled(["waterRipple", "perf", "canvas"]);
}

export function WaterRipples() {
  const [ripples, setRipples] = useState<readonly WaterRipple[]>([]);
  const rippleIdRef = useRef(0);
  const lastRippleTime = useRef(0);
  const rippleFrameNowRef = useRef(0);
  const mobilePerformanceMode = useRef(isMobilePerformanceMode());
  const waterRippleQaEnabled = useRef(false);
  const rippleSegments = mobilePerformanceMode.current ? 18 : 32;
  const rippleGeometry = useMemo(() => new THREE.RingGeometry(0.8, 1.0, rippleSegments), [rippleSegments]);

  useEffect(() => {
    return () => rippleGeometry.dispose();
  }, [rippleGeometry]);

  useEffect(() => {
    const handlePlayerMoved = (e: any) => {
      const { x, y, z, isMoving, grounded, isInWater, waterY } = e.detail;
      const rippleY = typeof waterY === "number" ? waterY + 0.01 : BASE_VILLAGE_WATER_Y;
      const shouldRipple = Boolean(isInWater) || isBaseVillageWaterRippleSpot(x, y, z);

      if (shouldRipple && isMoving && grounded) {
        const now = e.timeStamp;
        const rippleInterval = mobilePerformanceMode.current ? 700 : 400;
        if (now - lastRippleTime.current > rippleInterval) {
          lastRippleTime.current = now;
          setRipples((prev) => appendWaterRipple(prev, { id: rippleIdRef.current++, x, y: rippleY, z, spawnTime: now }, now));
        }
      }
    };

    window.addEventListener('player-moved', handlePlayerMoved);
    return () => window.removeEventListener('player-moved', handlePlayerMoved);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined" || !isWaterRippleQaEnabled(window.location.search)) return;

    waterRippleQaEnabled.current = true;
    let qaTriggerCount = 0;
    const qaTriggerRafs = new Set<number>();
    const triggerRipple = (now: number) => {
      qaTriggerCount += 1;
      document.documentElement.dataset.wofWaterRippleQaTriggers = String(qaTriggerCount);
      setRipples((prev) =>
        appendWaterRipple(
          prev,
          {
            id: rippleIdRef.current++,
            x: 50,
            y: BASE_VILLAGE_WATER_Y + 0.01,
            z: 0,
            spawnTime: now,
          },
          now,
        ),
      );
    };
    const requestQaRipple = () => {
      const raf = window.requestAnimationFrame((now) => {
        qaTriggerRafs.delete(raf);
        triggerRipple(now);
      });
      qaTriggerRafs.add(raf);
    };

    const firstTrigger = window.setTimeout(requestQaRipple, 200);
    const secondTrigger = window.setTimeout(requestQaRipple, 900);

    return () => {
      window.clearTimeout(firstTrigger);
      window.clearTimeout(secondTrigger);
      for (const raf of qaTriggerRafs) {
        window.cancelAnimationFrame(raf);
      }
      waterRippleQaEnabled.current = false;
      delete document.documentElement.dataset.wofWaterRippleQaExpired;
      delete document.documentElement.dataset.wofWaterRippleQaTriggers;
    };
  }, []);

  useEffect(() => {
    if (!shouldPublishWaterRippleTelemetry()) return;
    document.documentElement.dataset.wofWaterRipples = String(ripples.length);
    return () => {
      delete document.documentElement.dataset.wofWaterRipples;
    };
  }, [ripples.length]);

  useEffect(() => {
    if (ripples.length === 0 || typeof window === "undefined") return undefined;

    const latestSpawnTime = ripples[ripples.length - 1]?.spawnTime ?? 0;
    const now = Math.max(rippleFrameNowRef.current, latestSpawnTime);
    const cleanupDelay = getWaterRippleCleanupDelayMs(ripples, now);
    const cleanupAt = now + cleanupDelay + 16;
    const cleanupTimeout = window.setTimeout(() => {
      const cleanupNow = Math.max(rippleFrameNowRef.current, cleanupAt);
      const activeRipples = pruneExpiredWaterRipples(ripples, cleanupNow);
      if (activeRipples !== ripples) {
        if (waterRippleQaEnabled.current && typeof document !== "undefined") {
          const expiredCount = ripples.length - activeRipples.length;
          const currentExpired = Number(document.documentElement.dataset.wofWaterRippleQaExpired ?? "0");
          document.documentElement.dataset.wofWaterRippleQaExpired = String(currentExpired + expiredCount);
        }
        setRipples(activeRipples);
      }
    }, cleanupDelay + 16);

    return () => window.clearTimeout(cleanupTimeout);
  }, [ripples]);

  return (
    <>
      {ripples.length > 0 && (
        <ActiveRippleMeshes
          ripples={ripples}
          nowRef={rippleFrameNowRef}
          geometry={rippleGeometry}
          mobilePerformanceMode={mobilePerformanceMode.current}
        />
      )}
    </>
  );
}

type RippleNodeKey = "mesh" | "material";

type RippleNodes = {
  mesh?: THREE.Mesh;
  material?: THREE.MeshBasicMaterial;
  lastMobileUpdateAt: number;
};

type RippleNode = THREE.Mesh | THREE.MeshBasicMaterial;

function ActiveRippleMeshes({
  ripples,
  nowRef,
  geometry,
  mobilePerformanceMode,
}: {
  ripples: readonly WaterRipple[];
  nowRef: MutableRefObject<number>;
  geometry: THREE.RingGeometry;
  mobilePerformanceMode: boolean;
}) {
  const rippleNodesRef = useRef(new Map<number, RippleNodes>());

  const registerRippleNode = useCallback((rippleId: number, nodeKey: RippleNodeKey, node: RippleNode | null) => {
    const rippleNodes = rippleNodesRef.current;
    if (!node) {
      const existing = rippleNodes.get(rippleId);
      if (existing) {
        delete existing[nodeKey];
        if (!existing.mesh && !existing.material) {
          rippleNodes.delete(rippleId);
        }
      }
      return;
    }

    const existing = rippleNodes.get(rippleId) ?? { lastMobileUpdateAt: Number.NEGATIVE_INFINITY };
    if (nodeKey === "mesh") {
      existing.mesh = node as THREE.Mesh;
    } else {
      existing.material = node as THREE.MeshBasicMaterial;
    }
    rippleNodes.set(rippleId, existing);
  }, []);

  useFrame((state) => {
    const elapsed = state.clock.elapsedTime;
    nowRef.current = elapsed * 1000;

    for (const ripple of ripples) {
      const nodes = rippleNodesRef.current.get(ripple.id);
      if (!nodes?.mesh || !nodes.material) continue;
      if (mobilePerformanceMode) {
        if (elapsed - nodes.lastMobileUpdateAt < MOBILE_WATER_RIPPLE_UPDATE_INTERVAL_SECONDS) continue;
        nodes.lastMobileUpdateAt = elapsed;
      }
      const now = nowRef.current > 0 ? nowRef.current : ripple.spawnTime;
      const age = (now - ripple.spawnTime) / WATER_RIPPLE_LIFETIME_MS;
      if (age <= 1.0) {
        const scale = 0.5 + age * 2.0;
        nodes.mesh.scale.set(scale, scale, scale);
        nodes.material.opacity = Math.max(0, 1.0 - age);
      }
    }
  });

  return (
    <>
      {ripples.map((ripple) => (
        <RippleMesh
          key={ripple.id}
          ripple={ripple}
          geometry={geometry}
          registerRippleNode={registerRippleNode}
        />
      ))}
    </>
  );
}

function RippleMesh({
  ripple,
  geometry,
  registerRippleNode,
}: {
  ripple: WaterRipple;
  geometry: THREE.RingGeometry;
  registerRippleNode: (rippleId: number, nodeKey: RippleNodeKey, node: RippleNode | null) => void;
}) {

  return (
    <mesh
      ref={(node) => registerRippleNode(ripple.id, "mesh", node)}
      geometry={geometry}
      position={[ripple.x, ripple.y, ripple.z]}
      rotation={[-Math.PI / 2, 0, 0]}
      renderOrder={-1}
    >
      <meshBasicMaterial
        ref={(node) => registerRippleNode(ripple.id, "material", node)}
        color="white"
        transparent
        opacity={1}
        depthWrite={false}
      />
    </mesh>
  );
}
