import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { SURVIVAL_BLOCK_SIZE } from "../../../../store/gameStore";
import { isMobilePerformanceMode } from "../../input/performanceMode";
import { getSurvivalGrassStreamScale } from "../survival/survivalLoadStage";
import { survivalHash01 } from "../survival/survivalMath";
import type { SurvivalChunkInfo } from "../survival/survivalWorldConfig";
import { SURVIVAL_LOCAL_GRASS_SHORT_BLADES_PER_TUFT } from "./survivalLocalGrassStreaming";
import {
  makeSurvivalChunkShortGrassBlades,
  makeSurvivalChunkTallGrassBlades,
  type SurvivalGrassBlade,
} from "./survivalChunkGrassBlades";
import { makeSurvivalChunkGroundGrassPatches } from "./survivalChunkGroundGrassPatches";
import { type SurvivalGroundGrassPatch } from "./survivalLocalGrassPatches";
import {
  MOBILE_SURVIVAL_GRASS_WIND_UPDATE_INTERVAL_SECONDS,
  SURVIVAL_GRASS_BLADE_SOURCE_UP,
  SURVIVAL_GROUND_GRASS_SOURCE_NORMAL,
  SURVIVAL_WORLD_GRASS_BLADES_PER_TUFT,
} from "./survivalDormantGrassRenderConstants";
import {
  getLilyCoilBladeAlphaTexture,
  getSurvivalGroundGrassCoverAlphaTexture,
  getSurvivalLocalGrassClumpAlphaTexture,
} from "./survivalGrassTextures";
import { createSurvivalVertexColoredPlaneGeometry } from "./survivalGrassGeometry";
import {
  ensureSurvivalInstancedMeshColors,
  finalizeSurvivalInstancedMesh,
  finalizeSurvivalInstancedMeshColors,
} from "./survivalInstancing";
import {
  getSurvivalChunkGrassSurfaceBiome,
  getSurvivalGrassSurfaceBiome,
  getSurvivalIntegratedGrassBladeColor,
  getSurvivalTerrainHeightForChunk,
} from "./survivalDormantGrassSurface";

export function SurvivalGrassGroundCover({ chunk, loadStage = 4 }: { chunk: SurvivalChunkInfo; loadStage?: number }) {
  const groundRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const normal = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const mobilePerformanceMode = useMemo(() => isMobilePerformanceMode(), []);
  const patchAlphaTexture = useMemo(() => getSurvivalGroundGrassCoverAlphaTexture(), []);
  const groundPlaneGeometry = useMemo(() => createSurvivalVertexColoredPlaneGeometry(1, 1), []);
  const streamScale = getSurvivalGrassStreamScale(loadStage);
  const patches = useMemo<SurvivalGroundGrassPatch[]>(
    () => makeSurvivalChunkGroundGrassPatches(chunk, mobilePerformanceMode, streamScale),
    [chunk, mobilePerformanceMode, streamScale],
  );

  useEffect(() => {
    const mesh = groundRef.current;
    if (!mesh) return;

    ensureSurvivalInstancedMeshColors(mesh, patches.length);
    for (let index = 0; index < patches.length; index += 1) {
      const patch = patches[index];
      normal.set(patch.normalX, patch.normalY, patch.normalZ).normalize();
      dummy.position.set(chunk.x + patch.x, patch.y, chunk.z + patch.z);
      dummy.quaternion.setFromUnitVectors(SURVIVAL_GROUND_GRASS_SOURCE_NORMAL, normal);
      dummy.rotateZ(patch.yaw);
      dummy.scale.set(patch.width, patch.depth, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      mesh.setColorAt(index, patch.color);
    }

    mesh.count = patches.length;
    mesh.instanceMatrix.needsUpdate = true;
    finalizeSurvivalInstancedMeshColors(mesh);
    finalizeSurvivalInstancedMesh(mesh, chunk.x, chunk.z, SURVIVAL_BLOCK_SIZE * 0.72, 64);
  }, [chunk.x, chunk.z, dummy, normal, patches]);

  if (patches.length === 0) return null;

  return (
    <instancedMesh ref={groundRef} args={[undefined, undefined, patches.length]} renderOrder={3} frustumCulled={false}>
      <primitive object={groundPlaneGeometry} attach="geometry" />
      <meshBasicMaterial
        alphaMap={patchAlphaTexture}
        alphaTest={0.04}
        color="#ffffff"
        vertexColors
        side={THREE.DoubleSide}
        transparent
        opacity={chunk.lod === "far" ? 0.42 : chunk.lod === "mid" ? 0.45 : 0.48}
        depthWrite={false}
      />
    </instancedMesh>
  );
}

export function SurvivalGrassPatches({ chunk, loadStage = 4 }: { chunk: SurvivalChunkInfo; loadStage?: number }) {
  const grassRef = useRef<THREE.InstancedMesh>(null);
  const shortGrassRef = useRef<THREE.InstancedMesh>(null);
  const grassUniformRef = useRef<{ value: number } | null>(null);
  const shortGrassUniformRef = useRef<{ value: number } | null>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const patchNormal = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const bladeBase = useMemo(() => new THREE.Vector3(), []);
  const mobilePerformanceMode = useMemo(() => isMobilePerformanceMode(), []);
  const streamScale = getSurvivalGrassStreamScale(loadStage);
  const bladeAlphaTexture = useMemo(() => getLilyCoilBladeAlphaTexture(), []);
  const grassBiome = useMemo(() => getSurvivalChunkGrassSurfaceBiome(chunk), [chunk]);
  const isTallgrassBiome = grassBiome === "tallgrass";
  const shortGrassPatchTexture = useMemo(() => getSurvivalLocalGrassClumpAlphaTexture(), []);
  const grassMaterialColor = useMemo(() => {
    const sampleHeight = getSurvivalTerrainHeightForChunk(chunk, 0, 0);
    const color = getSurvivalIntegratedGrassBladeColor(
      grassBiome,
      chunk.x,
      chunk.z,
      sampleHeight,
      survivalHash01(chunk.cx, chunk.cz, 1750),
      0.2,
    );
    return `#${color.getHexString()}`;
  }, [chunk, grassBiome]);
  const shortGrassMaterialColor = useMemo(() => {
    const sampleHeight = getSurvivalTerrainHeightForChunk(chunk, 17, -13);
    const color = getSurvivalIntegratedGrassBladeColor(
      getSurvivalGrassSurfaceBiome(chunk.biome, chunk.x + 17, chunk.z - 13, sampleHeight),
      chunk.x + 17,
      chunk.z - 13,
      sampleHeight,
      survivalHash01(chunk.cx, chunk.cz, 1760),
      isTallgrassBiome ? 0.22 : 0.26,
    );
    return `#${color.getHexString()}`;
  }, [chunk, isTallgrassBiome]);
  const blades = useMemo<SurvivalGrassBlade[]>(
    () => makeSurvivalChunkTallGrassBlades(chunk, grassBiome, mobilePerformanceMode, streamScale),
    [chunk, grassBiome, mobilePerformanceMode, streamScale],
  );
  const shortBlades = useMemo<SurvivalGrassBlade[]>(
    () => makeSurvivalChunkShortGrassBlades(chunk, grassBiome, mobilePerformanceMode, streamScale),
    [chunk, grassBiome, mobilePerformanceMode, streamScale],
  );
  const shortBladesPerTuft = SURVIVAL_LOCAL_GRASS_SHORT_BLADES_PER_TUFT;
  const lastMobileWindUpdateAtRef = useRef(Number.NEGATIVE_INFINITY);

  useFrame(({ clock }) => {
    const elapsed = clock.elapsedTime;
    if (
      mobilePerformanceMode &&
      elapsed - lastMobileWindUpdateAtRef.current < MOBILE_SURVIVAL_GRASS_WIND_UPDATE_INTERVAL_SECONDS
    ) return;
    lastMobileWindUpdateAtRef.current = elapsed;

    if (grassUniformRef.current) {
      grassUniformRef.current.value = elapsed;
    }
    if (shortGrassUniformRef.current) {
      shortGrassUniformRef.current.value = elapsed;
    }
  });

  useEffect(() => {
    const mesh = grassRef.current;
    const shortMesh = shortGrassRef.current;
    if (!mesh && !shortMesh) return;

    if (shortMesh) {
      let shortInstance = 0;
      for (let bladeIndex = 0; bladeIndex < shortBlades.length; bladeIndex += 1) {
        const blade = shortBlades[bladeIndex];
        for (let tuftIndex = 0; tuftIndex < shortBladesPerTuft; tuftIndex += 1) {
          const radial = (tuftIndex / shortBladesPerTuft) * Math.PI * 2;
          const yaw = blade.yaw + radial + (bladeIndex % 6) * 0.07;
          const spread = blade.width * (0.08 + tuftIndex * 0.04);
          const heightJitter = 0.82 + survivalHash01(chunk.cx + tuftIndex, chunk.cz - tuftIndex, 5200 + bladeIndex) * 0.34;
          const widthJitter = 0.84 + survivalHash01(chunk.cx - tuftIndex, chunk.cz + tuftIndex, 5300 + bladeIndex) * 0.46;
          const bladeHeight = blade.height * heightJitter;
          patchNormal.set(blade.normalX, blade.normalY, blade.normalZ).normalize();
          bladeBase.set(
            chunk.x + blade.x + Math.sin(yaw) * spread,
            blade.y,
            chunk.z + blade.z + Math.cos(yaw) * spread,
          );

          dummy.position.copy(bladeBase).addScaledVector(patchNormal, bladeHeight * 0.5);
          dummy.quaternion.setFromUnitVectors(SURVIVAL_GRASS_BLADE_SOURCE_UP, patchNormal);
          dummy.rotateY(yaw);
          dummy.rotateX(blade.tilt * 0.18);
          dummy.rotateZ(Math.sin(yaw + blade.tilt) * 0.1);
          dummy.scale.set(blade.width * widthJitter, bladeHeight, 1);
          dummy.updateMatrix();
          shortMesh.setMatrixAt(shortInstance, dummy.matrix);
          shortInstance += 1;
        }
      }

      shortMesh.count = shortInstance;
      finalizeSurvivalInstancedMesh(shortMesh, chunk.x, chunk.z, SURVIVAL_BLOCK_SIZE * 0.82, 16);
    }

    if (!mesh) return;

    let instance = 0;
    for (let bladeIndex = 0; bladeIndex < blades.length; bladeIndex += 1) {
      const blade = blades[bladeIndex];
      for (let tuftIndex = 0; tuftIndex < SURVIVAL_WORLD_GRASS_BLADES_PER_TUFT; tuftIndex += 1) {
        const radial = (tuftIndex / SURVIVAL_WORLD_GRASS_BLADES_PER_TUFT) * Math.PI * 2;
        const yaw = blade.yaw + radial + (bladeIndex % 5) * 0.09;
        const spread = blade.width * (0.12 + tuftIndex * 0.06);
        const heightJitter = 0.76 + survivalHash01(chunk.cx + tuftIndex, chunk.cz - tuftIndex, 4200 + bladeIndex) * 0.42;
        const widthJitter = 0.88 + survivalHash01(chunk.cx - tuftIndex, chunk.cz + tuftIndex, 4300 + bladeIndex) * 0.52;
        const bladeHeight = blade.height * heightJitter;
        patchNormal.set(blade.normalX, blade.normalY, blade.normalZ).normalize();
        bladeBase.set(
          chunk.x + blade.x + Math.sin(yaw) * spread,
          blade.y,
          chunk.z + blade.z + Math.cos(yaw) * spread,
        );

        dummy.position.copy(bladeBase).addScaledVector(patchNormal, bladeHeight * 0.48);
        dummy.quaternion.setFromUnitVectors(SURVIVAL_GRASS_BLADE_SOURCE_UP, patchNormal);
        dummy.rotateY(yaw);
        dummy.rotateX(blade.tilt * 0.46);
        dummy.rotateZ(Math.sin(yaw + blade.tilt) * 0.14);
        dummy.scale.set(blade.width * widthJitter, bladeHeight, 1);
        dummy.updateMatrix();
        mesh.setMatrixAt(instance, dummy.matrix);
        instance += 1;
      }
    }

    mesh.count = instance;
    finalizeSurvivalInstancedMesh(mesh, chunk.x, chunk.z, SURVIVAL_BLOCK_SIZE * 0.82, 24);
  }, [bladeBase, blades, chunk.cx, chunk.cz, chunk.x, chunk.z, dummy, patchNormal, shortBlades, shortBladesPerTuft]);

  if (blades.length === 0 && shortBlades.length === 0) return null;

  const capacity = Math.max(1, blades.length * SURVIVAL_WORLD_GRASS_BLADES_PER_TUFT);
  const shortCapacity = Math.max(1, shortBlades.length * shortBladesPerTuft);

  return (
    <group name={`survival-grass-${chunk.key}`}>
      <instancedMesh ref={shortGrassRef} args={[undefined, undefined, shortCapacity]} renderOrder={4}>
        <planeGeometry args={[1, 1, 1, 3]} />
        <meshBasicMaterial
          alphaMap={shortGrassPatchTexture}
          alphaTest={chunk.lod === "far" ? 0.14 : 0.12}
          color={shortGrassMaterialColor}
          side={THREE.DoubleSide}
          transparent
          opacity={chunk.lod === "far" ? 0.66 : 0.76}
          depthWrite={false}
          toneMapped={false}
          onBeforeCompile={(shader) => {
            const timeUniform = { value: 0 };
            shader.uniforms.uTime = timeUniform;
            shader.vertexShader = `uniform float uTime;\n${shader.vertexShader.replace(
              "#include <begin_vertex>",
              `#include <begin_vertex>
              float survivalShortBladeMask = smoothstep(-0.5, 0.5, position.y);
              float survivalShortWindSeed = position.x * 4.0;
              #ifdef USE_INSTANCING
                survivalShortWindSeed += instanceMatrix[3].x * 0.023 + instanceMatrix[3].z * 0.029;
              #endif
              float survivalShortWind = sin(uTime * 1.1 + survivalShortWindSeed) + sin(uTime * 1.8 + survivalShortWindSeed * 1.37) * 0.24;
              transformed.x += survivalShortWind * survivalShortBladeMask * survivalShortBladeMask * 0.055;
              transformed.z += cos(uTime * 0.92 + survivalShortWindSeed) * survivalShortBladeMask * 0.025;`,
            )}`;
            shortGrassUniformRef.current = timeUniform;
          }}
        />
      </instancedMesh>
      <instancedMesh ref={grassRef} args={[undefined, undefined, capacity]} renderOrder={5}>
        <planeGeometry args={[1, 1, 1, 3]} />
        <meshBasicMaterial
          alphaMap={bladeAlphaTexture}
          alphaTest={0.16}
          color={grassMaterialColor}
          side={THREE.DoubleSide}
          transparent
          opacity={0.9}
          depthWrite={false}
          toneMapped={false}
          onBeforeCompile={(shader) => {
            const timeUniform = { value: 0 };
            shader.uniforms.uTime = timeUniform;
            shader.vertexShader = `uniform float uTime;\n${shader.vertexShader.replace(
              "#include <begin_vertex>",
              `#include <begin_vertex>
              float survivalBladeMask = smoothstep(-0.5, 0.5, position.y);
              float survivalWindSeed = position.x * 5.0;
              #ifdef USE_INSTANCING
                survivalWindSeed += instanceMatrix[3].x * 0.027 + instanceMatrix[3].z * 0.031;
              #endif
              float survivalWind = sin(uTime * 1.34 + survivalWindSeed) + sin(uTime * 2.08 + survivalWindSeed * 1.53) * 0.34;
              transformed.x += survivalWind * survivalBladeMask * survivalBladeMask * 0.18;
              transformed.z += cos(uTime * 1.08 + survivalWindSeed) * survivalBladeMask * 0.055;`,
            )}`;
            grassUniformRef.current = timeUniform;
          }}
        />
      </instancedMesh>
    </group>
  );
}
