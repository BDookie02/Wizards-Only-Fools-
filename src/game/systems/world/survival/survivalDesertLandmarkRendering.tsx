import { useEffect, useMemo } from "react";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import * as THREE from "three";
import { SURVIVAL_BLOCK_SIZE } from "../../../../store/gameStore";
import type { HutInfo } from "../villages/baseVillageHutLayout";
import { Villagers } from "../../../Villagers";
import { useSurvivalFeatureCount } from "../../../tools/qa/survivalFeatureCounters";
import { isCurrentQaTelemetryRouteEnabled } from "../../../tools/qa/qaRouteTelemetry";
import { getDesertAdobeWallTexture } from "../terrain/survivalTerrainTextures";
import { survivalHash01 } from "./survivalMath";
import type { SurvivalChunkInfo } from "./survivalWorldConfig";

type DesertLandmark = {
  key: string;
  localX: number;
  localZ: number;
  y: number;
  scale: number;
  yaw: number;
  variant: number;
  type: "pyramid" | "obelisk";
};

type FootprintHeightStats = {
  min: number;
  max: number;
  average: number;
  range: number;
};

type PyramidStep = {
  key: string;
  index: number;
  size: number;
  y: number;
};

const desertLandmarkSamples = new Map<string, string>();
const FOOTPRINT_HEIGHT_SAMPLES = [-1, -0.5, 0, 0.5, 1] as const;
const PYRAMID_INTERIOR_SIDE_OFFSETS = [-1, 1] as const;
const PYRAMID_INTERIOR_GLYPH_OFFSETS = [-1, 0, 1] as const;

function shouldPublishDesertLandmarkTelemetry() {
  return isCurrentQaTelemetryRouteEnabled(["perf", "canvas", "grass", "survival"]);
}

function publishDesertLandmarkSamples() {
  if (typeof document === "undefined") return;

  let sampleText = "";
  let publishedCount = 0;

  for (const sample of desertLandmarkSamples.values()) {
    if (!sample) continue;
    sampleText += publishedCount === 0 ? sample : `|${sample}`;
    publishedCount += 1;
    if (publishedCount >= 8) break;
  }

  document.documentElement.dataset.wofDesertLandmarkSample = sampleText;
}

function formatDesertLandmarkSample(chunk: SurvivalChunkInfo, landmarks: DesertLandmark[]) {
  let sampleText = "";
  const sampleCount = Math.min(2, landmarks.length);

  for (let index = 0; index < sampleCount; index += 1) {
    const landmark = landmarks[index];
    const sample = [
      `${chunk.cx},${chunk.cz}`,
      landmark.type,
      landmark.localX.toFixed(1),
      landmark.localZ.toFixed(1),
      landmark.y.toFixed(1),
      (chunk.x + landmark.localX).toFixed(1),
      (chunk.z + landmark.localZ).toFixed(1),
    ].join(":");
    sampleText += index === 0 ? sample : `,${sample}`;
  }

  return sampleText;
}

function useDesertLandmarkSamples(id: string, chunk: SurvivalChunkInfo, landmarks: DesertLandmark[]) {
  const shouldPublish = shouldPublishDesertLandmarkTelemetry();

  useEffect(() => {
    if (!shouldPublish) return;

    if (landmarks.length === 0) {
      desertLandmarkSamples.delete(id);
      publishDesertLandmarkSamples();
      return;
    }

    desertLandmarkSamples.set(id, formatDesertLandmarkSample(chunk, landmarks));
    publishDesertLandmarkSamples();

    return () => {
      desertLandmarkSamples.delete(id);
      publishDesertLandmarkSamples();
    };
  }, [chunk.cx, chunk.cz, chunk.x, chunk.z, id, landmarks, shouldPublish]);
}

export type SurvivalTerrainHeightForChunk = (
  chunk: SurvivalChunkInfo,
  localX: number,
  localZ: number,
) => number;

export type SurvivalWaterLevelAtWorld = (worldX: number, worldZ: number) => number;

function getDesertPyramidMetrics(landmark: DesertLandmark) {
  const stepCount = landmark.variant > 0.72 ? 7 : 6;
  const stepHeight = 2.1 * landmark.scale;
  const baseSize = 31 * landmark.scale;
  const pyramidYaw = landmark.yaw + Math.PI * 0.25;
  const doorWidth = 5.4 * landmark.scale;
  const doorHeight = 6.3 * landmark.scale;
  const wallThickness = Math.max(1.7 * landmark.scale, baseSize * 0.075);
  const height = stepHeight * stepCount + 4.2 * landmark.scale;

  return {
    stepCount,
    stepHeight,
    baseSize,
    pyramidYaw,
    doorWidth,
    doorHeight,
    wallThickness,
    height,
  };
}

function getRotatedSurvivalFootprintHeightStats(
  chunk: SurvivalChunkInfo,
  localX: number,
  localZ: number,
  halfSize: number,
  yaw: number,
  terrainHeightForChunk: SurvivalTerrainHeightForChunk,
): FootprintHeightStats {
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  let count = 0;
  for (let sampleXIndex = 0; sampleXIndex < FOOTPRINT_HEIGHT_SAMPLES.length; sampleXIndex += 1) {
    const sampleX = FOOTPRINT_HEIGHT_SAMPLES[sampleXIndex];

    for (let sampleZIndex = 0; sampleZIndex < FOOTPRINT_HEIGHT_SAMPLES.length; sampleZIndex += 1) {
      const sampleZ = FOOTPRINT_HEIGHT_SAMPLES[sampleZIndex];
      const offsetX = sampleX * halfSize;
      const offsetZ = sampleZ * halfSize;
      const rotatedX = offsetX * cos - offsetZ * sin;
      const rotatedZ = offsetX * sin + offsetZ * cos;
      const height = terrainHeightForChunk(chunk, localX + rotatedX, localZ + rotatedZ);
      min = Math.min(min, height);
      max = Math.max(max, height);
      sum += height;
      count += 1;
    }
  }

  if (count === 0 || !Number.isFinite(min) || !Number.isFinite(max)) {
    const fallback = terrainHeightForChunk(chunk, localX, localZ);
    return { min: fallback, max: fallback, average: fallback, range: 0 };
  }

  return {
    min,
    max,
    average: sum / count,
    range: max - min,
  };
}

function getDesertPyramidFootprintStats(
  landmark: DesertLandmark,
  chunk: SurvivalChunkInfo,
  terrainHeightForChunk: SurvivalTerrainHeightForChunk,
  metrics = getDesertPyramidMetrics(landmark),
) {
  return getRotatedSurvivalFootprintHeightStats(
    chunk,
    landmark.localX,
    landmark.localZ,
    metrics.baseSize * 0.58,
    metrics.pyramidYaw,
    terrainHeightForChunk,
  );
}

function makePyramidVillagerHuts(landmark: DesertLandmark, chunk: SurvivalChunkInfo): HutInfo[] {
  const metrics = getDesertPyramidMetrics(landmark);
  const x = chunk.x + landmark.localX;
  const z = chunk.z + landmark.localZ;
  const rotation = metrics.pyramidYaw + Math.PI;
  const hutCount = metrics.baseSize > 43 ? 3 : 2;
  const hutSideSpacing = metrics.baseSize * (metrics.baseSize > 43 ? 0.16 : 0.14);
  const huts: HutInfo[] = [];

  for (let index = 0; index < hutCount; index += 1) {
    const sideOffset = hutCount === 3 ? (index - 1) * hutSideSpacing : (index === 0 ? -hutSideSpacing : hutSideSpacing);

    huts.push({
      id: `${landmark.key}-egyptian-villager-${index}`,
      x,
      y: landmark.y,
      z,
      hutType: 20 + index,
      colorIndex: index,
      rotation,
      hasPath: false,
      pathRot: rotation,
      isMushroom: false,
      interiorWidth: metrics.baseSize * 0.62,
      interiorDepth: metrics.baseSize * 0.66,
      interiorHeight: metrics.height + 2,
      villagerBackOffset: -metrics.baseSize * (0.13 + index * 0.035),
      villagerSideOffset: sideOffset,
      villagerYOffset: 0.95,
      villagerTheme: "egyptian",
    });
  }

  return huts;
}

function makeDesertPyramidSteps(landmark: DesertLandmark, metrics: ReturnType<typeof getDesertPyramidMetrics>): PyramidStep[] {
  const steps: PyramidStep[] = [];

  for (let index = 0; index < metrics.stepCount; index += 1) {
    const t = index / metrics.stepCount;
    steps.push({
      key: `${landmark.key}-step-${index}`,
      index,
      size: metrics.baseSize * (1 - t * 0.72),
      y: landmark.y + metrics.stepHeight * index + metrics.stepHeight * 0.5,
    });
  }

  return steps;
}

function DesertPyramidFoundation({
  landmark,
  chunk,
  metrics,
  adobeTexture,
  terrainHeightForChunk,
}: {
  landmark: DesertLandmark;
  chunk: SurvivalChunkInfo;
  metrics: ReturnType<typeof getDesertPyramidMetrics>;
  adobeTexture: THREE.Texture;
  terrainHeightForChunk: SurvivalTerrainHeightForChunk;
}) {
  const stats = useMemo(
    () => getDesertPyramidFootprintStats(landmark, chunk, terrainHeightForChunk, metrics),
    [chunk, landmark, metrics, terrainHeightForChunk],
  );
  const foundationSize = metrics.baseSize * 1.1;
  const lowerBuryY = Math.min(stats.min, landmark.y - 0.65) - 1.8;
  const topY = landmark.y + 0.08;
  const foundationHeight = Math.max(0.85, topY - lowerBuryY);

  return (
    <group name={`${landmark.key}-terrain-foundation`}>
      <mesh
        position={[0, lowerBuryY + foundationHeight / 2, 0]}
        castShadow={false}
        receiveShadow={false}
      >
        <boxGeometry args={[foundationSize, foundationHeight, foundationSize]} />
        <meshLambertMaterial map={adobeTexture} color="#b98243" />
      </mesh>
      <mesh
        position={[0, topY + 0.035, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        castShadow={false}
        receiveShadow={false}
      >
        <planeGeometry args={[foundationSize * 1.08, foundationSize * 1.08]} />
        <meshLambertMaterial map={adobeTexture} color="#d3a35b" />
      </mesh>
      <mesh
        position={[0, landmark.y + 0.22 * landmark.scale, -metrics.baseSize * 0.64]}
        rotation={[-0.42, 0, 0]}
        castShadow={false}
        receiveShadow={false}
      >
        <boxGeometry args={[metrics.doorWidth * 1.75, 0.55 * landmark.scale, metrics.baseSize * 0.32]} />
        <meshLambertMaterial color="#d7b06a" />
      </mesh>
    </group>
  );
}

function DesertPyramidInterior({ landmark, metrics }: { landmark: DesertLandmark; metrics: ReturnType<typeof getDesertPyramidMetrics> }) {
  const floorWidth = metrics.baseSize * 0.52;
  const floorDepth = metrics.baseSize * 0.62;
  const floorZ = -metrics.baseSize * 0.05;
  const floorY = landmark.y + 0.05;
  const gold = "#facc15";

  return (
    <group>
      <mesh position={[0, floorY, floorZ]} rotation={[-Math.PI / 2, 0, 0]} castShadow={false} receiveShadow={false}>
        <planeGeometry args={[floorWidth, floorDepth]} />
        <meshBasicMaterial color="#7c5230" />
      </mesh>
      <mesh position={[0, landmark.y + 0.46 * landmark.scale, floorZ + floorDepth * 0.25]} castShadow={false}>
        <boxGeometry args={[metrics.baseSize * 0.28, 0.9 * landmark.scale, metrics.baseSize * 0.12]} />
        <meshLambertMaterial color="#a86f38" />
      </mesh>
      <mesh position={[0, landmark.y + 1.12 * landmark.scale, floorZ + floorDepth * 0.25]} castShadow={false}>
        <boxGeometry args={[metrics.baseSize * 0.22, 0.5 * landmark.scale, metrics.baseSize * 0.08]} />
        <meshBasicMaterial color={gold} />
      </mesh>
      {PYRAMID_INTERIOR_SIDE_OFFSETS.map((side) => (
        <group key={side} position={[side * floorWidth * 0.34, landmark.y, -metrics.baseSize * 0.18]}>
          <mesh position={[0, 2.2 * landmark.scale, 0]} castShadow={false}>
            <cylinderGeometry args={[0.5 * landmark.scale, 0.6 * landmark.scale, 4.4 * landmark.scale, 6]} />
            <meshLambertMaterial color="#d6a25b" />
          </mesh>
          <mesh position={[0, 4.75 * landmark.scale, 0]} castShadow={false}>
            <boxGeometry args={[1.9 * landmark.scale, 0.45 * landmark.scale, 1.9 * landmark.scale]} />
            <meshBasicMaterial color={gold} />
          </mesh>
          <mesh position={[0, 5.35 * landmark.scale, 0]} castShadow={false}>
            <coneGeometry args={[0.7 * landmark.scale, 1.35 * landmark.scale, 6]} />
            <meshBasicMaterial color="#fb923c" />
          </mesh>
        </group>
      ))}
      {PYRAMID_INTERIOR_GLYPH_OFFSETS.map((glyph) => (
        <mesh key={glyph} position={[glyph * metrics.baseSize * 0.09, landmark.y + 3.25 * landmark.scale, metrics.baseSize * 0.3]} rotation={[0, Math.PI, 0]} castShadow={false}>
          <boxGeometry args={[0.28 * landmark.scale, 2.0 * landmark.scale, 0.08 * landmark.scale]} />
          <meshBasicMaterial color={glyph === 0 ? gold : "#0ea5e9"} />
        </mesh>
      ))}
    </group>
  );
}

function DesertPyramidColliders({
  landmark,
  chunk,
  terrainHeightForChunk,
}: {
  landmark: DesertLandmark;
  chunk: SurvivalChunkInfo;
  terrainHeightForChunk: SurvivalTerrainHeightForChunk;
}) {
  const metrics = getDesertPyramidMetrics(landmark);
  const foundationStats = getDesertPyramidFootprintStats(landmark, chunk, terrainHeightForChunk, metrics);
  const foundationLowerY = Math.min(foundationStats.min, landmark.y - 0.65) - 1.8;
  const foundationTopY = landmark.y + 0.08;
  const foundationHeight = Math.max(0.85, foundationTopY - foundationLowerY);
  const sideWallX = metrics.baseSize / 2 - metrics.wallThickness / 2;
  const sideWallDepth = metrics.baseSize * 0.86;
  const wallY = landmark.y + metrics.height / 2;
  const frontZ = -metrics.baseSize / 2 + metrics.wallThickness / 2;
  const backZ = metrics.baseSize / 2 - metrics.wallThickness / 2;
  const frontSideWidth = Math.max(1, (metrics.baseSize - metrics.doorWidth) / 2);
  const lintelHeight = Math.max(0.8, metrics.height - metrics.doorHeight);

  return (
    <RigidBody
      type="fixed"
      colliders={false}
      friction={0.2}
      restitution={0}
      position={[chunk.x + landmark.localX, 0, chunk.z + landmark.localZ]}
      rotation={[0, metrics.pyramidYaw, 0]}
    >
      <CuboidCollider
        args={[metrics.baseSize * 0.55, foundationHeight / 2, metrics.baseSize * 0.55]}
        position={[0, foundationLowerY + foundationHeight / 2, 0]}
      />
      <CuboidCollider
        args={[metrics.doorWidth * 0.9, 0.28 * landmark.scale, metrics.baseSize * 0.16]}
        position={[0, landmark.y + 0.22 * landmark.scale, -metrics.baseSize * 0.64]}
        rotation={[-0.42, 0, 0]}
      />
      <CuboidCollider
        args={[metrics.wallThickness / 2, metrics.height / 2, sideWallDepth / 2]}
        position={[-sideWallX, wallY, 0]}
      />
      <CuboidCollider
        args={[metrics.wallThickness / 2, metrics.height / 2, sideWallDepth / 2]}
        position={[sideWallX, wallY, 0]}
      />
      <CuboidCollider
        args={[metrics.baseSize / 2, metrics.height / 2, metrics.wallThickness / 2]}
        position={[0, wallY, backZ]}
      />
      <CuboidCollider
        args={[frontSideWidth / 2, metrics.height / 2, metrics.wallThickness / 2]}
        position={[-metrics.doorWidth / 2 - frontSideWidth / 2, wallY, frontZ]}
      />
      <CuboidCollider
        args={[frontSideWidth / 2, metrics.height / 2, metrics.wallThickness / 2]}
        position={[metrics.doorWidth / 2 + frontSideWidth / 2, wallY, frontZ]}
      />
      <CuboidCollider
        args={[metrics.doorWidth / 2, lintelHeight / 2, metrics.wallThickness / 2]}
        position={[0, landmark.y + metrics.doorHeight + lintelHeight / 2, frontZ]}
      />
    </RigidBody>
  );
}

function DesertPyramidLandmark({
  landmark,
  chunk,
  terrainHeightForChunk,
}: {
  landmark: DesertLandmark;
  chunk: SurvivalChunkInfo;
  terrainHeightForChunk: SurvivalTerrainHeightForChunk;
}) {
  const adobeTexture = useMemo(() => getDesertAdobeWallTexture(), []);
  const metrics = getDesertPyramidMetrics(landmark);
  const steps = makeDesertPyramidSteps(landmark, metrics);

  return (
    <>
      <group
        name={landmark.key}
        position={[chunk.x + landmark.localX, 0, chunk.z + landmark.localZ]}
        rotation={[0, metrics.pyramidYaw, 0]}
      >
        <DesertPyramidFoundation
          landmark={landmark}
          chunk={chunk}
          metrics={metrics}
          adobeTexture={adobeTexture}
          terrainHeightForChunk={terrainHeightForChunk}
        />
        {steps.map((step) => {
          const wall = Math.min(metrics.wallThickness, step.size * 0.22);
          const frontZ = -step.size / 2 + wall / 2;
          const backZ = step.size / 2 - wall / 2;
          const sideX = step.size / 2 - wall / 2;
          const sideDepth = Math.max(1, step.size - wall * 2);
          const doorOpen = step.index * metrics.stepHeight < metrics.doorHeight;
          const opening = Math.min(metrics.doorWidth + step.index * 0.6 * landmark.scale, step.size * 0.48);
          const frontSideWidth = Math.max(0.8, (step.size - opening) / 2);
          const materialColor = step.index % 2 === 0 ? "#d2a45c" : "#c8954f";

          return (
            <group key={step.key}>
              <mesh position={[0, step.y, backZ]} castShadow={false}>
                <boxGeometry args={[step.size, metrics.stepHeight, wall]} />
                <meshLambertMaterial map={adobeTexture} color={materialColor} />
              </mesh>
              <mesh position={[-sideX, step.y, 0]} castShadow={false}>
                <boxGeometry args={[wall, metrics.stepHeight, sideDepth]} />
                <meshLambertMaterial map={adobeTexture} color={materialColor} />
              </mesh>
              <mesh position={[sideX, step.y, 0]} castShadow={false}>
                <boxGeometry args={[wall, metrics.stepHeight, sideDepth]} />
                <meshLambertMaterial map={adobeTexture} color={materialColor} />
              </mesh>
              {doorOpen ? (
                <>
                  <mesh position={[-opening / 2 - frontSideWidth / 2, step.y, frontZ]} castShadow={false}>
                    <boxGeometry args={[frontSideWidth, metrics.stepHeight, wall]} />
                    <meshLambertMaterial map={adobeTexture} color={materialColor} />
                  </mesh>
                  <mesh position={[opening / 2 + frontSideWidth / 2, step.y, frontZ]} castShadow={false}>
                    <boxGeometry args={[frontSideWidth, metrics.stepHeight, wall]} />
                    <meshLambertMaterial map={adobeTexture} color={materialColor} />
                  </mesh>
                </>
              ) : (
                <mesh position={[0, step.y, frontZ]} castShadow={false}>
                  <boxGeometry args={[step.size, metrics.stepHeight, wall]} />
                  <meshLambertMaterial map={adobeTexture} color={materialColor} />
                </mesh>
              )}
            </group>
          );
        })}
        <DesertPyramidInterior landmark={landmark} metrics={metrics} />
        <mesh position={[0, landmark.y + metrics.stepHeight * metrics.stepCount + 1.3 * landmark.scale, 0]} castShadow={false}>
          <coneGeometry args={[metrics.baseSize * 0.16, 3.2 * landmark.scale, 4]} />
          <meshLambertMaterial color="#f1d08a" />
        </mesh>
        <mesh position={[0, landmark.y + metrics.doorHeight * 0.52, -metrics.baseSize * 0.5 - 0.06]} castShadow={false}>
          <boxGeometry args={[metrics.doorWidth, metrics.doorHeight, 0.24 * landmark.scale]} />
          <meshBasicMaterial color="#170d09" transparent opacity={0.72} />
        </mesh>
        <mesh position={[0, landmark.y + metrics.doorHeight + 0.28 * landmark.scale, -metrics.baseSize * 0.5 - 0.09]} castShadow={false}>
          <boxGeometry args={[metrics.doorWidth * 1.4, 0.55 * landmark.scale, 0.28 * landmark.scale]} />
          <meshBasicMaterial color="#facc15" />
        </mesh>
      </group>
      {chunk.distance === 0 && <DesertPyramidColliders landmark={landmark} chunk={chunk} terrainHeightForChunk={terrainHeightForChunk} />}
    </>
  );
}

function DesertObeliskLandmark({ landmark, chunk }: { landmark: DesertLandmark; chunk: SurvivalChunkInfo }) {
  const adobeTexture = useMemo(() => getDesertAdobeWallTexture(), []);
  const height = 28 * landmark.scale;

  return (
    <group
      name={landmark.key}
      position={[chunk.x + landmark.localX, landmark.y, chunk.z + landmark.localZ]}
      rotation={[0, landmark.yaw, 0]}
    >
      <mesh position={[0, 1.1 * landmark.scale, 0]} castShadow={false}>
        <boxGeometry args={[9 * landmark.scale, 2.2 * landmark.scale, 9 * landmark.scale]} />
        <meshLambertMaterial map={adobeTexture} color="#c99b58" />
      </mesh>
      <mesh position={[0, height * 0.5 + 2.2 * landmark.scale, 0]} castShadow={false}>
        <boxGeometry args={[4.8 * landmark.scale, height, 4.8 * landmark.scale]} />
        <meshLambertMaterial map={adobeTexture} color="#d7ad66" />
      </mesh>
      <mesh position={[0, height + 5.2 * landmark.scale, 0]} castShadow={false}>
        <coneGeometry args={[3.5 * landmark.scale, 5.5 * landmark.scale, 4]} />
        <meshLambertMaterial color="#eecb80" />
      </mesh>
      {PYRAMID_INTERIOR_SIDE_OFFSETS.map((side) => (
        <mesh key={side} position={[side * 8.5 * landmark.scale, 3.8 * landmark.scale, 2.5 * landmark.scale]} castShadow={false}>
          <boxGeometry args={[2.2 * landmark.scale, 7.6 * landmark.scale, 2.2 * landmark.scale]} />
          <meshLambertMaterial map={adobeTexture} color="#bd8c4d" />
        </mesh>
      ))}
    </group>
  );
}

export function DesertLandmarks({
  chunk,
  terrainHeightForChunk,
  getWaterLevelAtWorld,
}: {
  chunk: SurvivalChunkInfo;
  terrainHeightForChunk: SurvivalTerrainHeightForChunk;
  getWaterLevelAtWorld: SurvivalWaterLevelAtWorld;
}) {
  const landmarks = useMemo<DesertLandmark[]>(() => {
    if (chunk.biome !== "desert" || chunk.lod === "far" || chunk.hasVillage) return [];

    const targetCount = chunk.lod === "near" ? 2 : 1;
    const generated: DesertLandmark[] = [];
    const attempts = targetCount * 14;

    for (let index = 0; index < attempts && generated.length < targetCount; index += 1) {
      const localX = (survivalHash01(chunk.cx, chunk.cz, 510 + index) - 0.5) * SURVIVAL_BLOCK_SIZE * 0.76;
      const localZ = (survivalHash01(chunk.cx, chunk.cz, 540 + index) - 0.5) * SURVIVAL_BLOCK_SIZE * 0.76;
      if (Math.min(Math.abs(localX), Math.abs(localZ)) < 62) continue;

      const worldX = chunk.x + localX;
      const worldZ = chunk.z + localZ;
      const y = terrainHeightForChunk(chunk, localX, localZ);
      const waterY = getWaterLevelAtWorld(worldX, worldZ);
      if (y < waterY + 0.5) continue;

      const variant = survivalHash01(chunk.cx, chunk.cz, 570 + index);
      const scale = 0.86 + survivalHash01(chunk.cx, chunk.cz, 600 + index) * 0.72;
      const yaw = survivalHash01(chunk.cx, chunk.cz, 630 + index) * Math.PI * 2;
      const type = variant > 0.32 ? "pyramid" : "obelisk";
      let landmarkY = y;

      if (type === "pyramid") {
        const provisional: DesertLandmark = {
          key: `${chunk.key}-desert-landmark-${index}`,
          localX,
          localZ,
          y,
          scale,
          yaw,
          variant,
          type,
        };
        const metrics = getDesertPyramidMetrics(provisional);
        const footprintStats = getDesertPyramidFootprintStats(provisional, chunk, terrainHeightForChunk, metrics);
        const maxSlopeRange = Math.max(4.75, metrics.baseSize * 0.12);
        if (footprintStats.range > maxSlopeRange) continue;
        landmarkY = Math.max(y, footprintStats.max + 0.08);
      }

      generated.push({
        key: `${chunk.key}-desert-landmark-${index}`,
        localX,
        localZ,
        y: landmarkY,
        scale,
        yaw,
        variant,
        type,
      });
    }

    return generated;
  }, [chunk, getWaterLevelAtWorld, terrainHeightForChunk]);
  const counterId = `survival-desert-landmarks-${chunk.key}`;
  useSurvivalFeatureCount("desertLandmarks", counterId, landmarks.length);
  useDesertLandmarkSamples(counterId, chunk, landmarks);

  const pyramidHuts = useMemo(() => {
    const huts: HutInfo[] = [];

    for (let index = 0; index < landmarks.length; index += 1) {
      const landmark = landmarks[index];
      if (landmark.type !== "pyramid") continue;
      const landmarkHuts = makePyramidVillagerHuts(landmark, chunk);
      for (let hutIndex = 0; hutIndex < landmarkHuts.length; hutIndex += 1) {
        huts.push(landmarkHuts[hutIndex]);
      }
    }

    return huts;
  }, [chunk, landmarks]);

  if (landmarks.length === 0) return null;

  return (
    <>
      {landmarks.map((landmark) => (
        landmark.type === "pyramid"
          ? (
            <DesertPyramidLandmark
              key={landmark.key}
              landmark={landmark}
              chunk={chunk}
              terrainHeightForChunk={terrainHeightForChunk}
            />
          )
          : <DesertObeliskLandmark key={landmark.key} landmark={landmark} chunk={chunk} />
      ))}
      {chunk.distance === 0 && pyramidHuts.length > 0 && (
        <Villagers
          key={`survival-pyramid-villagers-${chunk.key}`}
          huts={pyramidHuts}
          name={`survival-pyramid-villagers-${chunk.key}`}
        />
      )}
    </>
  );
}
