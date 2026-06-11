import React, { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { PointLight } from "three";
import { useGameStore } from "../store/gameStore";
import {
  CAMPFIRE_DAMAGE_PER_SECOND,
  CAMPFIRE_DAMAGE_TICK_MS,
  getCampfireFlickerState,
  getCampfirePoint,
  isWithinCampfireDamageRadius,
} from "./systems/world/villages/campfireRuntime";
import { isMobilePerformanceMode } from "./systems/input/performanceMode";

const MOBILE_CAMPFIRE_FLICKER_UPDATE_INTERVAL_SECONDS = 1 / 30;

export function Campfire({ position = [0, 0, 30] }: { position?: [number, number, number] }) {
  const fireRef = useRef<PointLight>(null);
  const mobilePerformanceMode = useMemo(() => isMobilePerformanceMode(), []);
  const lastFlickerUpdateAtRef = useRef(Number.NEGATIVE_INFINITY);
  const lastDamageTickAtRef = useRef<number | null>(null);
  const { camera } = useThree();
  const campfirePos = useMemo(() => getCampfirePoint(position), [position[0], position[1], position[2]]);

  useFrame((state) => {
    const elapsed = state.clock.elapsedTime;
    const lastDamageTickAt = lastDamageTickAtRef.current;
    if (lastDamageTickAt === null) {
      lastDamageTickAtRef.current = elapsed;
    } else if (elapsed - lastDamageTickAt >= CAMPFIRE_DAMAGE_TICK_MS / 1000) {
      lastDamageTickAtRef.current = elapsed;
      if (typeof document !== "undefined" && document.pointerLockElement && isWithinCampfireDamageRadius(camera.position, campfirePos)) {
        const gameState = useGameStore.getState();
        if (gameState.health > 0) {
          gameState.damagePlayer(CAMPFIRE_DAMAGE_PER_SECOND * (CAMPFIRE_DAMAGE_TICK_MS / 1000));
        }
      }
    }

    if (
      fireRef.current &&
      (!mobilePerformanceMode || elapsed - lastFlickerUpdateAtRef.current >= MOBILE_CAMPFIRE_FLICKER_UPDATE_INTERVAL_SECONDS)
    ) {
      lastFlickerUpdateAtRef.current = elapsed;
      const flicker = getCampfireFlickerState(elapsed);
      fireRef.current.intensity = flicker.intensity;
      fireRef.current.position.y = flicker.lightY;
    }
  });

  return (
    <group position={position}>
      {/* Logs */}
      <mesh position={[0, 0.2, 0]} rotation={[0, Math.PI / 4, 0]}>
        <boxGeometry args={[1.5, 0.4, 0.4]} />
        <meshStandardMaterial color="#4a3221" />
      </mesh>
      <mesh position={[0, 0.2, 0]} rotation={[0, -Math.PI / 4, 0]}>
        <boxGeometry args={[1.5, 0.4, 0.4]} />
        <meshStandardMaterial color="#4a3221" />
      </mesh>
      
      {/* Fire blob */}
      <mesh position={[0, 0.6, 0]}>
        <sphereGeometry args={[0.4, 8, 8]} />
        <meshBasicMaterial color="#ff5500" transparent opacity={0.8} />
      </mesh>
      
      <pointLight ref={fireRef} color="#ff8800" distance={15} intensity={2} position={[0, 1, 0]} />
    </group>
  );
}
