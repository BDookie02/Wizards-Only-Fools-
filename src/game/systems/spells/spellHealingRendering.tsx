import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, useTexture } from "@react-three/drei";
import * as THREE from "three";
import { Projectile, useGameStore } from "../../../store/gameStore";
import { getSpriteUrl } from "../../SpriteManifest";
import { emitClearLocalStatusEffects } from "../../network/gameNetworkClient";
import { getPublishedLocalPlayerPosition } from "../player/playerEventBridge";
import { getEpochMsFromRenderClock } from "../rendering/renderClockEpoch";
import { isLocalProjectileCreator } from "./spellProjectileOwnership";
import {
  HEALING_CRYSTAL_TICK_MS,
  getHealingCrystalTick,
} from "./spellHealingRuntime";
import { useProjectileLifetime } from "./spellProjectileLifetime";
import { isMobilePerformanceMode } from "../input/performanceMode";

const MOBILE_HEALING_CRYSTAL_VISUAL_UPDATE_INTERVAL_SECONDS = 1 / 24;

function HealingCrystalMesh() {
  const ref = useRef<THREE.Group>(null);
  const lastMobileVisualUpdateAtRef = useRef(Number.NEGATIVE_INFINITY);
  const mobilePerformanceMode = useMemo(() => isMobilePerformanceMode(), []);
  const texture = useTexture(getSpriteUrl("/sprites/misc/healing_gems.gif") || "/sprites/misc/healing_gems.gif");

  useEffect(() => {
    if (texture) {
      texture.minFilter = THREE.NearestFilter;
      texture.magFilter = THREE.NearestFilter;
    }
  }, [texture]);

  useFrame(({ clock }) => {
    if (
      mobilePerformanceMode &&
      clock.elapsedTime - lastMobileVisualUpdateAtRef.current < MOBILE_HEALING_CRYSTAL_VISUAL_UPDATE_INTERVAL_SECONDS
    ) {
      return;
    }
    lastMobileVisualUpdateAtRef.current = clock.elapsedTime;
    if (ref.current) {
      ref.current.position.y = Math.sin(clock.elapsedTime * 3) * 0.5 + 1.0;
    }
  });

  return (
    <group ref={ref}>
      <Billboard>
        <mesh>
          <planeGeometry args={[2.5, 2.5]} />
          <meshBasicMaterial
            map={texture}
            transparent={true}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            alphaTest={0.05}
          />
        </mesh>
      </Billboard>
    </group>
  );
}

export function HealingCrystals({ projectile }: { projectile: Projectile }) {
  useProjectileLifetime(projectile.id, 10000);
  const isMyProjectile = isLocalProjectileCreator(projectile);

  return (
    <group position={[projectile.pos.x, projectile.pos.y, projectile.pos.z]}>
      {isMyProjectile && <LocalHealingCrystalTick projectile={projectile} />}
      <HealingCrystalMesh />
      <mesh position={[0, -0.4, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[2.5, 32]} />
        <meshBasicMaterial color="#00ff88" transparent opacity={0.2} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
}

function LocalHealingCrystalTick({ projectile }: { projectile: Projectile }) {
  const lastTickAtMsRef = useRef<number | null>(null);
  const epochOffsetRef = useRef<number | null>(null);

  useFrame(({ clock }) => {
    const nowMs = getEpochMsFromRenderClock(clock.elapsedTime, epochOffsetRef);
    const lastTickAtMs = lastTickAtMsRef.current;
    if (lastTickAtMs === null) {
      lastTickAtMsRef.current = nowMs;
      return;
    }

    if (nowMs - lastTickAtMs < HEALING_CRYSTAL_TICK_MS) return;

    const deltaSeconds = Math.max(0, (nowMs - lastTickAtMs) / 1000);
    lastTickAtMsRef.current = nowMs;
    const localPlayerPos = getPublishedLocalPlayerPosition();
    const store = useGameStore.getState();
    const tick = getHealingCrystalTick(localPlayerPos, projectile, store, deltaSeconds, nowMs);
    if (!tick.inRange) return;

    if (tick.clearedEffects.length > 0) {
      store.clearToxicEffects();
      emitClearLocalStatusEffects(tick.clearedEffects);
    }
    if (tick.nextHealth !== store.health) {
      store.setHealth(tick.nextHealth);
    }
  });

  return null;
}
