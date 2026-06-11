import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { SurvivalBiome } from "../../../../store/gameStore";
import { isMobilePerformanceMode } from "../../input/performanceMode";
import { useSurvivalFeatureCount } from "../../../tools/qa/survivalFeatureCounters";
import { survivalHash01 } from "../survival/survivalMath";
import {
  getSurvivalWorldWillows,
  type SurvivalWorldWillow,
  type SurvivalWorldWillowResolvers,
} from "./survivalWorldWillows";
import {
  FoliageDodeca,
  HIDE_FROM_MINIMAP,
  SurvivalBranch,
  SurvivalHangingVine,
} from "./SurvivalFoliagePrimitives";
import { finalizeSurvivalInstancedMesh } from "./survivalInstancing";
import { getSurvivalSolidTreeTexture } from "./survivalTreeVisuals";

type SurvivalWillowParticle = {
  angle: number;
  radius: number;
  height: number;
  speed: number;
  size: number;
  phase: number;
};

const MOBILE_WILLOW_PARTICLE_UPDATE_INTERVAL_SECONDS = 1 / 24;

function getWillowCanopyColors(biome: SurvivalBiome): [string, string, string] {
  if (biome === "desert") return ["#7f974f", "#a9a85f", "#c2b76e"];
  if (biome === "swamp") return ["#51672e", "#6f7e38", "#89a04f"];
  if (biome === "mushroom") return ["#7851a2", "#9f65c7", "#c47ddb"];
  if (biome === "jungle") return ["#145a2c", "#1f793c", "#4f9a45"];
  return ["#4f8730", "#76aa48", "#9ac45a"];
}

function SurvivalWillowParticles({
  willow,
  canopyHeight,
  canopyRadius,
}: {
  willow: SurvivalWorldWillow;
  canopyHeight: number;
  canopyRadius: number;
}) {
  const particleRef = useRef<THREE.InstancedMesh>(null);
  const lastMobileUpdateAtRef = useRef(-Infinity);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const mobilePerformanceMode = useMemo(() => isMobilePerformanceMode(), []);
  const particles = useMemo<SurvivalWillowParticle[]>(() => {
    const count = mobilePerformanceMode ? 36 : 72;
    const generated: SurvivalWillowParticle[] = [];
    for (let index = 0; index < count; index += 1) {
      generated.push({
        angle: survivalHash01(index, willow.variant * 1000, 9300) * Math.PI * 2,
        radius: canopyRadius * (0.16 + survivalHash01(index, willow.variant * 1000, 9310) * 0.9),
        height: canopyHeight * (0.08 + survivalHash01(index, willow.variant * 1000, 9320) * 0.98),
        speed: 0.34 + survivalHash01(index, willow.variant * 1000, 9330) * 0.42,
        size: willow.scale * (0.42 + survivalHash01(index, willow.variant * 1000, 9340) * 0.72),
        phase: survivalHash01(index, willow.variant * 1000, 9350) * Math.PI * 2,
      });
    }
    return generated;
  }, [canopyHeight, canopyRadius, mobilePerformanceMode, willow.scale, willow.variant]);

  useEffect(() => {
    const mesh = particleRef.current;
    if (!mesh) return;
    mesh.count = particles.length;
    finalizeSurvivalInstancedMesh(mesh, 0, 0, canopyRadius * 1.35, canopyHeight * 0.5);
  }, [canopyHeight, canopyRadius, particles]);

  useFrame(({ clock }) => {
    const mesh = particleRef.current;
    if (!mesh) return;

    const time = clock.elapsedTime;
    if (mobilePerformanceMode) {
      if (time - lastMobileUpdateAtRef.current < MOBILE_WILLOW_PARTICLE_UPDATE_INTERVAL_SECONDS) return;
      lastMobileUpdateAtRef.current = time;
    }
    for (let index = 0; index < particles.length; index += 1) {
      const particle = particles[index];
      const drift = time * particle.speed + particle.phase;
      const fall = (particle.height + drift * 12) % canopyHeight;
      const angle = particle.angle + Math.sin(drift * 0.7) * 0.18;
      const radius = particle.radius + Math.sin(drift * 1.3) * willow.scale * 2.6;
      dummy.position.set(
        Math.sin(angle) * radius,
        canopyHeight - fall,
        Math.cos(angle) * radius,
      );
      dummy.rotation.set(0, angle, 0);
      dummy.scale.setScalar(particle.size * (0.72 + Math.sin(drift * 2.2) * 0.18));
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    }

    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={particleRef} args={[undefined, undefined, particles.length]} renderOrder={8} frustumCulled={false}>
      <sphereGeometry args={[1, 5, 4]} />
      <meshBasicMaterial color="#d9f99d" transparent opacity={0.58} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
    </instancedMesh>
  );
}

function MassiveWillowTree({
  willow,
  showParticles,
}: {
  willow: SurvivalWorldWillow;
  showParticles: boolean;
}) {
  const trunkColor = willow.biome === "mushroom" ? "#51315c" : willow.biome === "desert" ? "#6f5428" : "#332315";
  const branchColor = willow.biome === "mushroom" ? "#68406f" : willow.biome === "desert" ? "#7a5f30" : "#2c2214";
  const canopyColors = getWillowCanopyColors(willow.biome);
  const barkTexture = useMemo(() => getSurvivalSolidTreeTexture(), []);
  const trunkHeight = 86 * willow.scale;
  const trunkRadius = 4.6 * willow.scale;
  const canopyRadius = 24 * willow.scale;
  const canopyHeight = 56 * willow.scale;
  const branches = useMemo(() => {
    const generated: Array<{
      key: string;
      start: THREE.Vector3;
      end: THREE.Vector3;
      radius: number;
    }> = [];
    for (let index = 0; index < 8; index += 1) {
      const side = index % 2 === 0 ? 1 : -1;
      const angle = index * 0.78 + willow.variant * 2.2;
      const startY = trunkHeight * (0.38 + index * 0.052);
      const length = canopyRadius * (0.62 + survivalHash01(index, willow.variant * 1000, 9200) * 0.54);
      generated.push({
        key: `branch-${index}`,
        start: new THREE.Vector3(0, startY, 0),
        end: new THREE.Vector3(
          Math.sin(angle) * length * side,
          startY + canopyHeight * (0.16 + survivalHash01(index, willow.variant * 1000, 9210) * 0.42),
          Math.cos(angle) * length,
        ),
        radius: trunkRadius * (0.34 - index * 0.018),
      });
    }
    return generated;
  }, [canopyHeight, canopyRadius, trunkHeight, trunkRadius, willow.variant]);
  const leafLobes = useMemo(() => {
    const lobes: Array<{ key: string; position: [number, number, number]; radius: number; color: string; scale: [number, number, number] }> = [];
    lobes.push({
      key: "crown",
      position: [0, trunkHeight + canopyHeight * 0.18, 0],
      radius: canopyRadius * 0.72,
      color: canopyColors[0],
      scale: [1.12, 0.86, 1.04],
    });
    for (let index = 0; index < 10; index += 1) {
      const angle = index * 0.64 + willow.variant * 4.1;
      const radius = canopyRadius * (0.32 + survivalHash01(index, willow.variant * 1000, 9220) * 0.58);
      const lobeSize = canopyRadius * (0.38 + survivalHash01(index, willow.variant * 1000, 9230) * 0.32);
      lobes.push({
        key: `lobe-${index}`,
        position: [
          Math.sin(angle) * radius,
          trunkHeight + canopyHeight * (0.02 + survivalHash01(index, willow.variant * 1000, 9240) * 0.46),
          Math.cos(angle) * radius,
        ],
        radius: lobeSize,
        color: canopyColors[index % canopyColors.length],
        scale: [
          0.78 + survivalHash01(index, willow.variant * 1000, 9250) * 0.36,
          0.62 + survivalHash01(index, willow.variant * 1000, 9260) * 0.3,
          0.74 + survivalHash01(index, willow.variant * 1000, 9270) * 0.38,
        ],
      });
    }
    return lobes;
  }, [canopyColors, canopyHeight, canopyRadius, trunkHeight, willow.variant]);
  const vines = useMemo(() => {
    const generated: Array<{
      key: string;
      x: number;
      y: number;
      z: number;
      length: number;
      sway: number;
    }> = [];
    for (let index = 0; index < 14; index += 1) {
      const angle = index * 0.45 + willow.variant * 5.2;
      const radius = canopyRadius * (0.45 + survivalHash01(index, willow.variant * 1000, 9360) * 0.62);
      generated.push({
        key: `vine-${index}`,
        x: Math.sin(angle) * radius,
        y: trunkHeight + canopyHeight * (0.06 + survivalHash01(index, willow.variant * 1000, 9370) * 0.54),
        z: Math.cos(angle) * radius,
        length: willow.scale * (18 + survivalHash01(index, willow.variant * 1000, 9380) * 32),
        sway: angle + survivalHash01(index, willow.variant * 1000, 9390) * 1.8,
      });
    }
    return generated;
  }, [canopyHeight, canopyRadius, trunkHeight, willow.scale, willow.variant]);

  return (
    <group
      name={willow.key}
      position={[willow.x, willow.y, willow.z]}
      rotation={[0, willow.yaw, 0]}
      userData={HIDE_FROM_MINIMAP}
    >
      <mesh position={[0, trunkHeight * 0.5 - trunkHeight * 0.035, 0]} rotation={[0.04, 0, -0.025]} castShadow={false}>
        <cylinderGeometry args={[trunkRadius * 0.68, trunkRadius, trunkHeight * 1.07, 7]} />
        <meshBasicMaterial map={barkTexture} color={trunkColor} toneMapped={false} />
      </mesh>
      {branches.map((branch) => (
        <SurvivalBranch
          key={branch.key}
          start={branch.start}
          end={branch.end}
          radius={Math.max(0.42, branch.radius)}
          color={branchColor}
        />
      ))}
      {leafLobes.map((lobe) => (
        <FoliageDodeca
          key={lobe.key}
          position={lobe.position}
          radius={lobe.radius}
          color={lobe.color}
          edgeColor={willow.biome === "mushroom" ? "#311839" : "#1a2d12"}
          scale={lobe.scale}
        />
      ))}
      {vines.map((vine) => (
        <SurvivalHangingVine
          key={vine.key}
          x={vine.x}
          y={vine.y}
          z={vine.z}
          length={vine.length}
          sway={vine.sway}
        />
      ))}
      {showParticles && (
        <group position={[0, trunkHeight + canopyHeight * 0.26, 0]}>
          <SurvivalWillowParticles willow={willow} canopyHeight={canopyHeight} canopyRadius={canopyRadius} />
        </group>
      )}
    </group>
  );
}

export function SurvivalWorldWillows({
  centerChunk,
  renderRadius,
  getChunkCoord,
  getBiome,
  getRawTerrainHeightAtWorld,
  getWaterLevelAtWorld,
  hasVillage,
}: {
  centerChunk: { cx: number; cz: number };
  renderRadius: number;
} & SurvivalWorldWillowResolvers) {
  const willows = useMemo(() => {
    const allWillows = getSurvivalWorldWillows({
      getChunkCoord,
      getBiome,
      getRawTerrainHeightAtWorld,
      getWaterLevelAtWorld,
      hasVillage,
    });
    const visible: SurvivalWorldWillow[] = [];
    const maxDistance = renderRadius + 1;
    for (let index = 0; index < allWillows.length; index += 1) {
      const willow = allWillows[index];
      if (Math.max(Math.abs(willow.cx - centerChunk.cx), Math.abs(willow.cz - centerChunk.cz)) <= maxDistance) {
        visible.push(willow);
      }
    }
    return visible;
  }, [
    centerChunk.cx,
    centerChunk.cz,
    getBiome,
    getChunkCoord,
    getRawTerrainHeightAtWorld,
    getWaterLevelAtWorld,
    hasVillage,
    renderRadius,
  ]);

  useSurvivalFeatureCount("worldWillows", "survival-world-willows", willows.length);

  if (willows.length === 0) return null;

  return (
    <group name="survival-world-willows">
      {willows.map((willow) => {
        const distance = Math.max(Math.abs(willow.cx - centerChunk.cx), Math.abs(willow.cz - centerChunk.cz));
        return (
          <MassiveWillowTree
            key={willow.key}
            willow={willow}
            showParticles={distance <= renderRadius}
          />
        );
      })}
    </group>
  );
}
