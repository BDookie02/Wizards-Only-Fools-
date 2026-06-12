import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { CuboidCollider, CylinderCollider, RigidBody } from "@react-three/rapier";
import * as THREE from "three";
import { SURVIVAL_BLOCK_SIZE } from "../../../../store/gameStore";
import { getCachedIndexRange } from "../../rendering/indexRange";
import type { HutInfo } from "./baseVillageHutLayout";
import { Villagers } from "../../../Villagers";
import { getDesertAdobeWallTexture, getDesertSandTexture } from "../terrain/survivalTerrainTextures";
import { isStrictSurvivalDesertTerrainAtWorld, isSurvivalRestoredMeadowWaterSuppressed } from "../survival/survivalBiome";
import { shouldBuildSurvivalChunkColliders, shouldRenderSurvivalChunkSkirt } from "../survival/survivalChunks";
import { lerpNumber, survivalHash01 } from "../survival/survivalMath";
import { SURVIVAL_VILLAGE_PAD_SEGMENTS, type SurvivalChunkInfo } from "../survival/survivalWorldConfig";
import { PLANT_EDGE_COLOR } from "../vegetation/SurvivalFoliagePrimitives";
import { useSurvivalFeatureCount } from "../../../tools/qa/survivalFeatureCounters";
import { DESERT_VILLAGE_RADIUS, isNearDesertGate } from "./survivalDesertVillageTerrain";

type GateSide = "north" | "south" | "east" | "west";

type SurvivalTerrainHeightForChunk = (chunk: SurvivalChunkInfo, localX: number, localZ: number) => number;
type SurvivalVillageBaseHeightForChunk = (chunk: SurvivalChunkInfo) => number;
type SurvivalVillagePadHeightForChunk = (chunk: SurvivalChunkInfo, localX: number, localZ: number, baseHeight?: number) => number;
type SurvivalVillageGeometryFactory = (chunk: SurvivalChunkInfo) => THREE.BufferGeometry;
function makeDesertVillageSurfaceStripGeometry(
  chunk: SurvivalChunkInfo,
  width: number,
  length: number,
  rotation: number,
  yOffset: number,
  villageBaseHeightForChunk: SurvivalVillageBaseHeightForChunk,
  villagePadHeightForChunk: SurvivalVillagePadHeightForChunk,
  lateralOffset = 0,
  lengthOffset = 0,
  lateralSegments = 2,
  lengthSegments = SURVIVAL_VILLAGE_PAD_SEGMENTS,
) {
  const baseHeight = villageBaseHeightForChunk(chunk);
  const geo = new THREE.PlaneGeometry(width, length, Math.max(1, lateralSegments), Math.max(1, lengthSegments));
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);

  for (let i = 0; i < pos.count; i += 1) {
    const stripX = pos.getX(i) + lateralOffset;
    const stripZ = pos.getZ(i) + lengthOffset;
    const localX = stripX * cos + stripZ * sin;
    const localZ = -stripX * sin + stripZ * cos;
    const height = villagePadHeightForChunk(chunk, localX, localZ, baseHeight);
    pos.setX(i, localX);
    pos.setY(i, height + yOffset);
    pos.setZ(i, localZ);
  }

  geo.computeVertexNormals();
  return geo;
}

type DesertVillageBuilding = {
  key: string;
  localX: number;
  localZ: number;
  width: number;
  depth: number;
  height: number;
  rotation: number;
  color: string;
  roofColor: string;
  variant: number;
};

type DesertVillageWallSegment = {
  key: string;
  localX: number;
  localZ: number;
  rotation: number;
  width: number;
  height: number;
  depth: number;
};

type DesertVillageMarketStall = {
  key: string;
  localX: number;
  localZ: number;
  rotation: number;
  color: string;
};

type DesertVillagePalm = {
  key: string;
  localX: number;
  localY: number;
  localZ: number;
  scale: number;
  rotation: number;
};

type DesertVillageLadder = {
  key: string;
  localX: number;
  localZ: number;
  rotation: number;
  height: number;
  width: number;
};

type DesertVillageFence = {
  key: string;
  localX: number;
  localZ: number;
  rotation: number;
  length: number;
};

type DesertVillageClothesLine = {
  key: string;
  startX: number;
  startZ: number;
  endX: number;
  endZ: number;
  y: number;
  colors: [string, string, string];
};

type DesertVillageStreetProp = {
  key: string;
  kind: "barrel" | "crate" | "sack";
  localX: number;
  localZ: number;
  rotation: number;
  scale: number;
};

type DesertVillageLayout = {
  buildings: DesertVillageBuilding[];
  huts: HutInfo[];
  wallSegments: DesertVillageWallSegment[];
  marketStalls: DesertVillageMarketStall[];
  palms: DesertVillagePalm[];
  ladders: DesertVillageLadder[];
  fences: DesertVillageFence[];
  clothesLines: DesertVillageClothesLine[];
  streetProps: DesertVillageStreetProp[];
};

const DESERT_WALL_SEGMENT_COUNT = 72;
const DESERT_WALL_SEGMENT_WIDTH = (Math.PI * 2 * DESERT_VILLAGE_RADIUS / DESERT_WALL_SEGMENT_COUNT) * 1.16;
const DESERT_GATE_HALF_WIDTH = 50;
const DESERT_BUILDING_COLORS = ["#d8b06f", "#c99a55", "#e0bd82", "#bf8542", "#d1a062"];
const DESERT_ROOF_COLORS = ["#a96835", "#8f552e", "#bd7a3d", "#7a462a"];
const DESERT_MARKET_COLORS = ["#2f9bb2", "#d95f3d", "#d6b145", "#7f5bb8", "#52a35a"];
const DESERT_CLOTH_COLORS = ["#e9d7a0", "#c94f3f", "#3f9fb5", "#dfb548", "#8d6bbb", "#f2eee3"];
const DESERT_FENCE_POST_OFFSETS = [-0.5, 0, 0.5] as const;
const DESERT_BUILDING_WALL_THICKNESS = 1.05;
const DESERT_BUILDING_DOOR_WIDTH = 5.4;
const DESERT_BUILDING_DOOR_HEIGHT = 7.25;
const DESERT_UNIT_BOX_GEOMETRY = new THREE.BoxGeometry(1, 1, 1);
const DESERT_BUILDING_ROOF_MATERIAL = new THREE.MeshBasicMaterial({ color: "#6f3e22" });
const DESERT_BUILDING_OUTLINE_MATERIAL = new THREE.MeshBasicMaterial({ color: "#160d08", side: THREE.BackSide });
const DESERT_BUILDING_TRIM_MATERIAL = new THREE.MeshBasicMaterial({ color: "#1c1009" });
const DESERT_BUILDING_DOOR_MATERIAL = new THREE.MeshBasicMaterial({ color: "#3b2414" });
const DESERT_BUILDING_WINDOW_MATERIAL = new THREE.MeshBasicMaterial({ color: "#6ac7d6" });
const DESERT_BUILDING_FLOOR_MATERIAL = new THREE.MeshBasicMaterial({ color: "#70401f" });

function makeDesertVillageWallSegments(): DesertVillageWallSegment[] {
  const segments: DesertVillageWallSegment[] = [];

  for (let index = 0; index < DESERT_WALL_SEGMENT_COUNT; index += 1) {
    const angle = (Math.PI * 2 * index) / DESERT_WALL_SEGMENT_COUNT;
    const sin = Math.sin(angle);
    const cos = Math.cos(angle);
    const northSouthGate = Math.abs(sin * DESERT_VILLAGE_RADIUS) < DESERT_GATE_HALF_WIDTH && Math.abs(cos) > 0.78;
    const eastWestGate = Math.abs(cos * DESERT_VILLAGE_RADIUS) < DESERT_GATE_HALF_WIDTH && Math.abs(sin) > 0.78;
    const isGate = northSouthGate || eastWestGate;
    if (isGate) continue;

    segments.push({
      key: `desert-wall-${index}`,
      localX: sin * DESERT_VILLAGE_RADIUS,
      localZ: cos * DESERT_VILLAGE_RADIUS,
      rotation: angle,
      width: DESERT_WALL_SEGMENT_WIDTH,
      height: 15.5,
      depth: 8,
    });
  }

  return segments;
}

function getBuildingLocalPoint(building: DesertVillageBuilding, offsetX: number, offsetZ: number) {
  const sin = Math.sin(building.rotation);
  const cos = Math.cos(building.rotation);
  return {
    localX: building.localX + cos * offsetX + sin * offsetZ,
    localZ: building.localZ - sin * offsetX + cos * offsetZ,
  };
}

function makeDesertVillageLayout(
  chunk: SurvivalChunkInfo,
  baseHeight: number,
  terrainHeightForChunk: SurvivalTerrainHeightForChunk,
): DesertVillageLayout {
  const buildings: DesertVillageBuilding[] = [];
  const huts: HutInfo[] = [];
  const ladders: DesertVillageLadder[] = [];
  const fences: DesertVillageFence[] = [];
  const clothesLines: DesertVillageClothesLine[] = [];
  const streetProps: DesertVillageStreetProp[] = [];
  const wallSegments = makeDesertVillageWallSegments();
  const rings = [
    { radius: 78, count: 10, width: 18, depth: 16, height: 11, phase: 0.18 },
    { radius: 122, count: 16, width: 20, depth: 18, height: 12.5, phase: 0.02 },
    { radius: 166, count: 22, width: 22, depth: 19, height: 13.5, phase: 0.12 },
    { radius: 207, count: 26, width: 20, depth: 18, height: 12, phase: 0.05 },
  ];

  let buildingIndex = 0;
  for (let ringIndex = 0; ringIndex < rings.length; ringIndex += 1) {
    const ring = rings[ringIndex];
    for (let index = 0; index < ring.count; index += 1) {
      if (chunk.lod === "mid" && index % 2 === 1) continue;

      const angleStep = (Math.PI * 2) / ring.count;
      const jitter = (survivalHash01(chunk.cx + ringIndex * 17, chunk.cz + index, 640) - 0.5) * angleStep * 0.34;
      const angle = index * angleStep + ring.phase + jitter;
      const tangentJitter = (survivalHash01(chunk.cx - ringIndex * 9, chunk.cz + index, 641) - 0.5) * 9;
      const localX = Math.sin(angle) * ring.radius + Math.cos(angle) * tangentJitter;
      const localZ = Math.cos(angle) * ring.radius - Math.sin(angle) * tangentJitter;
      const roadClearance = ring.radius > 190 ? 38 : 26;
      if (Math.abs(localX) < roadClearance || Math.abs(localZ) < roadClearance || isNearDesertGate(localX, localZ)) {
        continue;
      }

      const variant = survivalHash01(chunk.cx + buildingIndex, chunk.cz - buildingIndex, 642);
      const width = ring.width + Math.round(variant * 7);
      const depth = ring.depth + Math.round(survivalHash01(chunk.cx - buildingIndex, chunk.cz + buildingIndex, 643) * 6);
      const height = ring.height + Math.round(survivalHash01(chunk.cx + ringIndex, chunk.cz + index, 644) * 6);
      const rotation = Math.atan2(-localX, -localZ);
      const color = DESERT_BUILDING_COLORS[Math.floor(variant * DESERT_BUILDING_COLORS.length) % DESERT_BUILDING_COLORS.length];
      const roofColor = DESERT_ROOF_COLORS[Math.floor(variant * DESERT_ROOF_COLORS.length * 1.7) % DESERT_ROOF_COLORS.length];
      const key = `${chunk.key}-desert-building-${buildingIndex}`;

      const building: DesertVillageBuilding = {
        key,
        localX,
        localZ,
        width,
        depth,
        height,
        rotation,
        color,
        roofColor,
        variant,
      };

      buildings.push(building);

      huts.push({
        id: key,
        x: chunk.x + localX,
        y: baseHeight,
        z: chunk.z + localZ,
        hutType: 2,
        colorIndex: Math.floor(variant * 4) % 4,
        rotation,
        hasPath: true,
        pathRot: rotation,
        isMushroom: false,
      });

      const side = survivalHash01(chunk.cx + buildingIndex, chunk.cz, 660) > 0.5 ? 1 : -1;
      if (buildingIndex % 3 !== 1) {
        const ladderPoint = getBuildingLocalPoint(building, side * (building.width / 2 + 0.32), -building.depth * 0.08);
        ladders.push({
          key: `${key}-ladder`,
          localX: ladderPoint.localX,
          localZ: ladderPoint.localZ,
          rotation: building.rotation + side * Math.PI / 2,
          height: Math.max(8, building.height - 1.1),
          width: 3.2,
        });
      }

      if (buildingIndex % 4 !== 2) {
        const fencePoint = getBuildingLocalPoint(building, side * (building.width / 2 + 6.2), -building.depth * 0.32);
        fences.push({
          key: `${key}-fence`,
          localX: fencePoint.localX,
          localZ: fencePoint.localZ,
          rotation: building.rotation + (survivalHash01(chunk.cx, chunk.cz + buildingIndex, 661) - 0.5) * 0.34,
          length: 9 + survivalHash01(chunk.cx - buildingIndex, chunk.cz, 662) * 8,
        });
      }

      const sidePropCount = buildingIndex % 2 === 0 ? 2 : 1;
      for (let propIndex = 0; propIndex < sidePropCount; propIndex += 1) {
        const propSide = survivalHash01(chunk.cx + propIndex, chunk.cz - buildingIndex, 663) > 0.42 ? side : -side;
        const propPoint = getBuildingLocalPoint(
          building,
          propSide * (building.width / 2 + 2.6 + propIndex * 1.8),
          (survivalHash01(chunk.cx, chunk.cz + propIndex + buildingIndex, 664) - 0.5) * building.depth * 0.7,
        );
        const propRoll = survivalHash01(chunk.cx - propIndex, chunk.cz + buildingIndex, 665);
        streetProps.push({
          key: `${key}-side-prop-${propIndex}`,
          kind: propRoll > 0.66 ? "barrel" : propRoll > 0.33 ? "crate" : "sack",
          localX: propPoint.localX,
          localZ: propPoint.localZ,
          rotation: building.rotation + propRoll * Math.PI,
          scale: 0.82 + survivalHash01(chunk.cx + buildingIndex, chunk.cz - propIndex, 666) * 0.36,
        });
      }

      buildingIndex += 1;
    }
  }

  const usedClothesLineBuildings = new Set<string>();
  for (let index = 0; index < buildings.length; index += 1) {
    const building = buildings[index];
    if (clothesLines.length >= 20 || usedClothesLineBuildings.has(building.key) || index % 3 !== 0) continue;

    let nearest: DesertVillageBuilding | null = null;
    let nearestDistanceSq = Infinity;
    for (const candidate of buildings) {
      if (candidate.key === building.key || usedClothesLineBuildings.has(candidate.key)) continue;
      const candidateDx = candidate.localX - building.localX;
      const candidateDz = candidate.localZ - building.localZ;
      const distanceSq = candidateDx * candidateDx + candidateDz * candidateDz;
      if (distanceSq < 576 || distanceSq > 3844 || distanceSq >= nearestDistanceSq) continue;
      nearest = candidate;
      nearestDistanceSq = distanceSq;
    }

    if (!nearest) continue;

    const target = nearest;
    const dx = target.localX - building.localX;
    const dz = target.localZ - building.localZ;
    const distance = Math.max(1, Math.sqrt(nearestDistanceSq));
    const startInset = Math.min(building.width, building.depth) * 0.52;
    const endInset = Math.min(target.width, target.depth) * 0.52;
    const colorIndex = Math.floor(survivalHash01(chunk.cx + index, chunk.cz, 667) * DESERT_CLOTH_COLORS.length) % DESERT_CLOTH_COLORS.length;

    clothesLines.push({
      key: `${building.key}-clothesline-${target.key}`,
      startX: building.localX + (dx / distance) * startInset,
      startZ: building.localZ + (dz / distance) * startInset,
      endX: target.localX - (dx / distance) * endInset,
      endZ: target.localZ - (dz / distance) * endInset,
      y: Math.min(building.height, target.height) + 4.2,
      colors: [
        DESERT_CLOTH_COLORS[colorIndex],
        DESERT_CLOTH_COLORS[(colorIndex + 2) % DESERT_CLOTH_COLORS.length],
        DESERT_CLOTH_COLORS[(colorIndex + 4) % DESERT_CLOTH_COLORS.length],
      ],
    });
    usedClothesLineBuildings.add(building.key);
    usedClothesLineBuildings.add(target.key);
  }

  const marketStallCount = chunk.lod === "mid" ? 5 : 10;
  const marketStalls: DesertVillageMarketStall[] = [];
  for (let index = 0; index < marketStallCount; index += 1) {
    const angle = (Math.PI * 2 * index) / (chunk.lod === "mid" ? 5 : 10) + 0.22;
    const radius = 50 + survivalHash01(chunk.cx, chunk.cz, 700 + index) * 18;
    marketStalls.push({
      key: `${chunk.key}-market-${index}`,
      localX: Math.sin(angle) * radius,
      localZ: Math.cos(angle) * radius,
      rotation: angle + Math.PI / 2,
      color: DESERT_MARKET_COLORS[index % DESERT_MARKET_COLORS.length],
    });
  }

  const streetClutterCount = chunk.lod === "mid" ? 8 : 22;
  for (let index = 0; index < streetClutterCount; index += 1) {
    const ring = index % 2 === 0 ? 92 : 138;
    const angle = (Math.PI * 2 * index) / streetClutterCount + survivalHash01(chunk.cx, chunk.cz, 790 + index) * 0.28;
    const roadOffset = (survivalHash01(chunk.cx, chunk.cz, 800 + index) - 0.5) * 18;
    const localX = Math.sin(angle) * ring + Math.cos(angle) * roadOffset;
    const localZ = Math.cos(angle) * ring - Math.sin(angle) * roadOffset;
    if (Math.abs(localX) < 36 || Math.abs(localZ) < 36 || isNearDesertGate(localX, localZ)) continue;

    streetProps.push({
      key: `${chunk.key}-street-prop-${index}`,
      kind: index % 5 === 0 ? "barrel" : index % 3 === 0 ? "sack" : "crate",
      localX,
      localZ,
      rotation: angle + Math.PI / 2,
      scale: 0.9 + survivalHash01(chunk.cx, chunk.cz, 810 + index) * 0.42,
    });
  }

  const palmCount = chunk.lod === "mid" ? 10 : 22;
  const palms: DesertVillagePalm[] = [];
  for (let index = 0; index < palmCount; index += 1) {
    const cluster = index < 12;
    const angle = cluster
      ? -Math.PI * 0.72 + (index / 12) * Math.PI * 0.56
      : Math.PI * 0.15 + (index / 10) * Math.PI * 0.32;
    const radius = cluster
      ? 248 + survivalHash01(chunk.cx, chunk.cz, 750 + index) * 34
      : 178 + survivalHash01(chunk.cx, chunk.cz, 760 + index) * 42;
    const localX = Math.sin(angle) * radius;
    const localZ = Math.cos(angle) * radius;
    palms.push({
      key: `${chunk.key}-date-palm-${index}`,
      localX,
      localY: terrainHeightForChunk(chunk, localX, localZ),
      localZ,
      scale: 0.85 + survivalHash01(chunk.cx, chunk.cz, 770 + index) * 0.7,
      rotation: survivalHash01(chunk.cx, chunk.cz, 780 + index) * Math.PI * 2,
    });
  }

  return { buildings, huts, wallSegments, marketStalls, palms, ladders, fences, clothesLines, streetProps };
}

function DesertVillageSurface({
  geometry,
  baseHeight,
  chunk,
  villageBaseHeightForChunk,
  villagePadHeightForChunk,
}: {
  geometry: THREE.BufferGeometry;
  baseHeight: number;
  chunk: SurvivalChunkInfo;
  villageBaseHeightForChunk: SurvivalVillageBaseHeightForChunk;
  villagePadHeightForChunk: SurvivalVillagePadHeightForChunk;
}) {
  const sandTexture = useMemo(() => getDesertSandTexture(), []);
  const hasMeadowOverlap = isSurvivalRestoredMeadowWaterSuppressed(chunk.x, chunk.z, SURVIVAL_BLOCK_SIZE * 0.58);
  const isStrictDesertSurface = chunk.biome === "desert" &&
    isStrictSurvivalDesertTerrainAtWorld(chunk.x, chunk.z) &&
    !hasMeadowOverlap;
  const northSouthRoadGeometry = useMemo(
    () => makeDesertVillageSurfaceStripGeometry(chunk, 48, SURVIVAL_BLOCK_SIZE - 4, 0, 0.18, villageBaseHeightForChunk, villagePadHeightForChunk),
    [chunk, villageBaseHeightForChunk, villagePadHeightForChunk],
  );
  const eastWestRoadGeometry = useMemo(
    () => makeDesertVillageSurfaceStripGeometry(chunk, 48, SURVIVAL_BLOCK_SIZE - 4, Math.PI / 2, 0.18, villageBaseHeightForChunk, villagePadHeightForChunk),
    [chunk, villageBaseHeightForChunk, villagePadHeightForChunk],
  );
  const diagonalRoadAGeometry = useMemo(
    () => makeDesertVillageSurfaceStripGeometry(chunk, 26, 360, Math.PI / 4, 0.17, villageBaseHeightForChunk, villagePadHeightForChunk),
    [chunk, villageBaseHeightForChunk, villagePadHeightForChunk],
  );
  const diagonalRoadBGeometry = useMemo(
    () => makeDesertVillageSurfaceStripGeometry(chunk, 26, 360, -Math.PI / 4, 0.17, villageBaseHeightForChunk, villagePadHeightForChunk),
    [chunk, villageBaseHeightForChunk, villagePadHeightForChunk],
  );
  const sidewalkGeometries = useMemo(() => [
    { key: "north-south-left", geometry: makeDesertVillageSurfaceStripGeometry(chunk, 7, SURVIVAL_BLOCK_SIZE - 4, 0, 0.22, villageBaseHeightForChunk, villagePadHeightForChunk, -30), opacity: 0.76 },
    { key: "north-south-right", geometry: makeDesertVillageSurfaceStripGeometry(chunk, 7, SURVIVAL_BLOCK_SIZE - 4, 0, 0.22, villageBaseHeightForChunk, villagePadHeightForChunk, 30), opacity: 0.76 },
    { key: "east-west-left", geometry: makeDesertVillageSurfaceStripGeometry(chunk, 7, SURVIVAL_BLOCK_SIZE - 4, Math.PI / 2, 0.22, villageBaseHeightForChunk, villagePadHeightForChunk, -30), opacity: 0.76 },
    { key: "east-west-right", geometry: makeDesertVillageSurfaceStripGeometry(chunk, 7, SURVIVAL_BLOCK_SIZE - 4, Math.PI / 2, 0.22, villageBaseHeightForChunk, villagePadHeightForChunk, 30), opacity: 0.76 },
    { key: "diagonal-a-left", geometry: makeDesertVillageSurfaceStripGeometry(chunk, 5, 360, Math.PI / 4, 0.2, villageBaseHeightForChunk, villagePadHeightForChunk, -18), opacity: 0.62 },
    { key: "diagonal-a-right", geometry: makeDesertVillageSurfaceStripGeometry(chunk, 5, 360, Math.PI / 4, 0.2, villageBaseHeightForChunk, villagePadHeightForChunk, 18), opacity: 0.62 },
    { key: "diagonal-b-left", geometry: makeDesertVillageSurfaceStripGeometry(chunk, 5, 360, -Math.PI / 4, 0.2, villageBaseHeightForChunk, villagePadHeightForChunk, -18), opacity: 0.62 },
    { key: "diagonal-b-right", geometry: makeDesertVillageSurfaceStripGeometry(chunk, 5, 360, -Math.PI / 4, 0.2, villageBaseHeightForChunk, villagePadHeightForChunk, 18), opacity: 0.62 },
  ], [chunk, villageBaseHeightForChunk, villagePadHeightForChunk]);

  if (!isStrictDesertSurface) {
    return null;
  }

  return (
    <group>
      <mesh geometry={geometry} receiveShadow dispose={null}>
        <meshBasicMaterial map={sandTexture} vertexColors />
      </mesh>
      <mesh geometry={geometry} receiveShadow dispose={null} renderOrder={1}>
        <meshBasicMaterial
          color="#d0a15c"
          transparent
          opacity={0.58}
          depthWrite={false}
          polygonOffset
          polygonOffsetFactor={-2}
          polygonOffsetUnits={-2}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, baseHeight + 0.08, 0]}>
            <circleGeometry args={[66, 36]} />
            <meshBasicMaterial map={sandTexture} color="#d7a15c" />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, baseHeight + 0.16, 0]}>
            <ringGeometry args={[67, 74, 36]} />
            <meshBasicMaterial color="#4b3020" transparent opacity={0.66} depthWrite={false} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, baseHeight + 0.1, 0]}>
            <ringGeometry args={[118, 128, 56]} />
            <meshBasicMaterial map={sandTexture} color="#cb8f4c" />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, baseHeight + 0.17, 0]}>
            <ringGeometry args={[110, 115, 56]} />
            <meshBasicMaterial color="#4b3020" transparent opacity={0.68} depthWrite={false} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, baseHeight + 0.18, 0]}>
            <ringGeometry args={[131, 137, 56]} />
            <meshBasicMaterial color="#4b3020" transparent opacity={0.64} depthWrite={false} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, baseHeight + 0.11, 0]}>
            <ringGeometry args={[188, 198, 72]} />
            <meshBasicMaterial map={sandTexture} color="#c28749" />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, baseHeight + 0.19, 0]}>
            <ringGeometry args={[180, 184, 72]} />
            <meshBasicMaterial color="#4b3020" transparent opacity={0.64} depthWrite={false} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, baseHeight + 0.2, 0]}>
            <ringGeometry args={[202, 207, 72]} />
            <meshBasicMaterial color="#4b3020" transparent opacity={0.6} depthWrite={false} />
          </mesh>
          <mesh geometry={northSouthRoadGeometry}>
            <meshBasicMaterial map={sandTexture} color="#d49f5d" />
          </mesh>
          <mesh geometry={eastWestRoadGeometry}>
            <meshBasicMaterial map={sandTexture} color="#d49f5d" />
          </mesh>
          <mesh geometry={diagonalRoadAGeometry}>
            <meshBasicMaterial map={sandTexture} color="#c9884b" transparent opacity={0.78} />
          </mesh>
          <mesh geometry={diagonalRoadBGeometry}>
            <meshBasicMaterial map={sandTexture} color="#c9884b" transparent opacity={0.78} />
          </mesh>
          {sidewalkGeometries.map((sidewalk) => (
            <mesh key={sidewalk.key} geometry={sidewalk.geometry}>
              <meshBasicMaterial color="#3f281a" transparent opacity={sidewalk.opacity} depthWrite={false} />
            </mesh>
          ))}
    </group>
  );
}

function DesertVillageBuildings({
  buildings,
  baseHeight,
  showDetails,
}: {
  buildings: DesertVillageBuilding[];
  baseHeight: number;
  showDetails: boolean;
}) {
  const bodyRef = useRef<THREE.InstancedMesh>(null);
  const roofRef = useRef<THREE.InstancedMesh>(null);
  const outlineBodyRef = useRef<THREE.InstancedMesh>(null);
  const outlineRoofRef = useRef<THREE.InstancedMesh>(null);
  const adobeTexture = useMemo(() => getDesertAdobeWallTexture(), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const adobeMaterial = useMemo(() => new THREE.MeshBasicMaterial({ map: adobeTexture, color: "#b68145" }), [adobeTexture]);

  useEffect(() => {
    const bodyMesh = bodyRef.current;
    const roofMesh = roofRef.current;
    const outlineBodyMesh = outlineBodyRef.current;
    const outlineRoofMesh = outlineRoofRef.current;
    if (!bodyMesh || !roofMesh) return;

    for (let index = 0; index < buildings.length; index += 1) {
      const building = buildings[index];
      if (outlineBodyMesh) {
        dummy.position.set(building.localX, baseHeight + building.height / 2, building.localZ);
        dummy.rotation.set(0, building.rotation, 0);
        dummy.scale.set(building.width + 1.1, building.height + 0.75, building.depth + 1.1);
        dummy.updateMatrix();
        outlineBodyMesh.setMatrixAt(index, dummy.matrix);
      }

      dummy.position.set(building.localX, baseHeight + building.height / 2, building.localZ);
      dummy.rotation.set(0, building.rotation, 0);
      dummy.scale.set(building.width, building.height, building.depth);
      dummy.updateMatrix();
      bodyMesh.setMatrixAt(index, dummy.matrix);

      if (outlineRoofMesh) {
        dummy.position.set(building.localX, baseHeight + building.height + 0.75, building.localZ);
        dummy.rotation.set(0, building.rotation, 0);
        dummy.scale.set(building.width + 4.2, 2.05, building.depth + 4.2);
        dummy.updateMatrix();
        outlineRoofMesh.setMatrixAt(index, dummy.matrix);
      }

      dummy.position.set(building.localX, baseHeight + building.height + 0.75, building.localZ);
      dummy.rotation.set(0, building.rotation, 0);
      dummy.scale.set(building.width + 2.8, 1.5, building.depth + 2.8);
      dummy.updateMatrix();
      roofMesh.setMatrixAt(index, dummy.matrix);
    }

    bodyMesh.instanceMatrix.needsUpdate = true;
    roofMesh.instanceMatrix.needsUpdate = true;
    if (outlineBodyMesh) outlineBodyMesh.instanceMatrix.needsUpdate = true;
    if (outlineRoofMesh) outlineRoofMesh.instanceMatrix.needsUpdate = true;
  }, [baseHeight, buildings, dummy]);

  return (
    <>
      {!showDetails && (
        <>
          <instancedMesh ref={outlineBodyRef} args={[DESERT_UNIT_BOX_GEOMETRY, DESERT_BUILDING_OUTLINE_MATERIAL, buildings.length]} castShadow={false} receiveShadow={false} frustumCulled={false} />
          <instancedMesh ref={bodyRef} args={[DESERT_UNIT_BOX_GEOMETRY, adobeMaterial, buildings.length]} castShadow={false} receiveShadow frustumCulled={false} />
          <instancedMesh ref={outlineRoofRef} args={[DESERT_UNIT_BOX_GEOMETRY, DESERT_BUILDING_OUTLINE_MATERIAL, buildings.length]} castShadow={false} receiveShadow={false} frustumCulled={false} />
          <instancedMesh ref={roofRef} args={[DESERT_UNIT_BOX_GEOMETRY, DESERT_BUILDING_ROOF_MATERIAL, buildings.length]} castShadow={false} receiveShadow frustumCulled={false} />
        </>
      )}
      {showDetails && buildings.map((building) => {
        const wallThickness = Math.min(DESERT_BUILDING_WALL_THICKNESS, building.width * 0.16, building.depth * 0.16);
        const doorWidth = Math.min(DESERT_BUILDING_DOOR_WIDTH, building.width - wallThickness * 4);
        const doorHeight = Math.min(DESERT_BUILDING_DOOR_HEIGHT, building.height - 1.2);
        const frontWallWidth = Math.max(1.2, (building.width - doorWidth) / 2);
        const lintelHeight = Math.max(0.8, building.height - doorHeight);
        const windowY = Math.min(building.height - 2.3, 6.2);
        const sideWindowZ = building.depth * 0.22;
        const sideWindowWidth = Math.min(3.1, building.depth * 0.24);

        return (
        <group
          key={`${building.key}-details`}
          position={[building.localX, baseHeight, building.localZ]}
          rotation={[0, building.rotation, 0]}
        >
          <mesh geometry={DESERT_UNIT_BOX_GEOMETRY} material={DESERT_BUILDING_OUTLINE_MATERIAL} position={[0, building.height / 2, 0]} scale={[building.width + 1.1, building.height + 0.75, building.depth + 1.1]} castShadow={false} />
          <mesh geometry={DESERT_UNIT_BOX_GEOMETRY} material={DESERT_BUILDING_OUTLINE_MATERIAL} position={[0, building.height + 0.75, 0]} scale={[building.width + 4.2, 2.05, building.depth + 4.2]} castShadow={false} />
          {[
            [-building.width / 2 - 0.08, building.depth / 2 + 0.08],
            [building.width / 2 + 0.08, building.depth / 2 + 0.08],
            [-building.width / 2 - 0.08, -building.depth / 2 - 0.08],
            [building.width / 2 + 0.08, -building.depth / 2 - 0.08],
          ].map(([x, z], index) => (
            <mesh key={`${building.key}-corner-outline-${index}`} geometry={DESERT_UNIT_BOX_GEOMETRY} material={DESERT_BUILDING_TRIM_MATERIAL} position={[x, building.height / 2, z]} scale={[0.62, building.height + 0.38, 0.62]} castShadow={false} />
          ))}
          <mesh geometry={DESERT_UNIT_BOX_GEOMETRY} material={DESERT_BUILDING_TRIM_MATERIAL} position={[0, building.height + 0.14, building.depth / 2 + 0.08]} scale={[building.width + 0.65, 0.36, 0.5]} castShadow={false} />
          <mesh geometry={DESERT_UNIT_BOX_GEOMETRY} material={DESERT_BUILDING_TRIM_MATERIAL} position={[0, building.height + 0.14, -building.depth / 2 - 0.08]} scale={[building.width + 0.65, 0.36, 0.5]} castShadow={false} />
          <mesh geometry={DESERT_UNIT_BOX_GEOMETRY} material={DESERT_BUILDING_TRIM_MATERIAL} position={[-building.width / 2 - 0.08, building.height + 0.14, 0]} scale={[0.5, 0.36, building.depth + 0.65]} castShadow={false} />
          <mesh geometry={DESERT_UNIT_BOX_GEOMETRY} material={DESERT_BUILDING_TRIM_MATERIAL} position={[building.width / 2 + 0.08, building.height + 0.14, 0]} scale={[0.5, 0.36, building.depth + 0.65]} castShadow={false} />
          <mesh geometry={DESERT_UNIT_BOX_GEOMETRY} material={DESERT_BUILDING_FLOOR_MATERIAL} position={[0, 0.08, 0]} scale={[building.width - wallThickness * 1.4, 0.16, building.depth - wallThickness * 1.4]} castShadow={false} receiveShadow />
          <mesh geometry={DESERT_UNIT_BOX_GEOMETRY} material={adobeMaterial} position={[-building.width / 2 + wallThickness / 2, building.height / 2, 0]} scale={[wallThickness, building.height, building.depth]} castShadow={false} receiveShadow />
          <mesh geometry={DESERT_UNIT_BOX_GEOMETRY} material={adobeMaterial} position={[building.width / 2 - wallThickness / 2, building.height / 2, 0]} scale={[wallThickness, building.height, building.depth]} castShadow={false} receiveShadow />
          <mesh geometry={DESERT_UNIT_BOX_GEOMETRY} material={adobeMaterial} position={[0, building.height / 2, -building.depth / 2 + wallThickness / 2]} scale={[building.width, building.height, wallThickness]} castShadow={false} receiveShadow />
          <mesh geometry={DESERT_UNIT_BOX_GEOMETRY} material={adobeMaterial} position={[-doorWidth / 2 - frontWallWidth / 2, building.height / 2, building.depth / 2 - wallThickness / 2]} scale={[frontWallWidth, building.height, wallThickness]} castShadow={false} receiveShadow />
          <mesh geometry={DESERT_UNIT_BOX_GEOMETRY} material={adobeMaterial} position={[doorWidth / 2 + frontWallWidth / 2, building.height / 2, building.depth / 2 - wallThickness / 2]} scale={[frontWallWidth, building.height, wallThickness]} castShadow={false} receiveShadow />
          <mesh geometry={DESERT_UNIT_BOX_GEOMETRY} material={adobeMaterial} position={[0, doorHeight + lintelHeight / 2, building.depth / 2 - wallThickness / 2]} scale={[doorWidth, lintelHeight, wallThickness]} castShadow={false} receiveShadow />
          <mesh geometry={DESERT_UNIT_BOX_GEOMETRY} material={DESERT_BUILDING_ROOF_MATERIAL} position={[0, building.height + 0.75, 0]} scale={[building.width + 2.8, 1.5, building.depth + 2.8]} castShadow={false} receiveShadow />
          <mesh geometry={DESERT_UNIT_BOX_GEOMETRY} material={DESERT_BUILDING_DOOR_MATERIAL} position={[0, doorHeight / 2 - 0.25, building.depth / 2 + 0.16]} scale={[doorWidth * 0.82, doorHeight - 0.5, 0.34]} castShadow={false}>
          </mesh>
          <mesh geometry={DESERT_UNIT_BOX_GEOMETRY} material={DESERT_BUILDING_TRIM_MATERIAL} position={[-building.width * 0.28, windowY, building.depth / 2 + 0.14]} scale={[3.7, 3.0, 0.36]} castShadow={false}>
          </mesh>
          <mesh geometry={DESERT_UNIT_BOX_GEOMETRY} material={DESERT_BUILDING_WINDOW_MATERIAL} position={[-building.width * 0.28, windowY, building.depth / 2 + 0.2]} scale={[3.1, 2.4, 0.32]} castShadow={false}>
          </mesh>
          <mesh geometry={DESERT_UNIT_BOX_GEOMETRY} material={DESERT_BUILDING_TRIM_MATERIAL} position={[building.width * 0.28, windowY, building.depth / 2 + 0.14]} scale={[3.7, 3.0, 0.36]} castShadow={false}>
          </mesh>
          <mesh geometry={DESERT_UNIT_BOX_GEOMETRY} material={DESERT_BUILDING_WINDOW_MATERIAL} position={[building.width * 0.28, windowY, building.depth / 2 + 0.2]} scale={[3.1, 2.4, 0.32]} castShadow={false}>
          </mesh>
          <mesh geometry={DESERT_UNIT_BOX_GEOMETRY} material={DESERT_BUILDING_TRIM_MATERIAL} position={[-building.width / 2 - 0.16, windowY, sideWindowZ]} scale={[0.36, 2.9, sideWindowWidth + 0.62]} castShadow={false}>
          </mesh>
          <mesh geometry={DESERT_UNIT_BOX_GEOMETRY} material={DESERT_BUILDING_WINDOW_MATERIAL} position={[-building.width / 2 - 0.22, windowY, sideWindowZ]} scale={[0.32, 2.15, sideWindowWidth]} castShadow={false}>
          </mesh>
          <mesh geometry={DESERT_UNIT_BOX_GEOMETRY} material={DESERT_BUILDING_TRIM_MATERIAL} position={[building.width / 2 + 0.16, windowY, -sideWindowZ]} scale={[0.36, 2.9, sideWindowWidth + 0.62]} castShadow={false}>
          </mesh>
          <mesh geometry={DESERT_UNIT_BOX_GEOMETRY} material={DESERT_BUILDING_WINDOW_MATERIAL} position={[building.width / 2 + 0.22, windowY, -sideWindowZ]} scale={[0.32, 2.15, sideWindowWidth]} castShadow={false}>
          </mesh>
          {building.variant > 0.72 && (
            <mesh position={[0, building.height + 3.2, 0]} castShadow={false}>
              <sphereGeometry args={[Math.min(building.width, building.depth) * 0.32, 10, 6]} />
              <meshBasicMaterial color="#b88345" />
            </mesh>
          )}
        </group>
        );
      })}
    </>
  );
}

function DesertVillageLadder({ ladder, baseHeight }: { ladder: DesertVillageLadder; baseHeight: number }) {
  const rungCount = Math.max(4, Math.floor(ladder.height / 1.7));

  return (
    <group position={[ladder.localX, baseHeight, ladder.localZ]} rotation={[0, ladder.rotation, 0]}>
      <mesh position={[-ladder.width / 2, ladder.height / 2, 0]} castShadow={false}>
        <boxGeometry args={[0.26, ladder.height, 0.22]} />
        <meshBasicMaterial color="#2d1b10" />
      </mesh>
      <mesh position={[ladder.width / 2, ladder.height / 2, 0]} castShadow={false}>
        <boxGeometry args={[0.26, ladder.height, 0.22]} />
        <meshBasicMaterial color="#2d1b10" />
      </mesh>
      {getCachedIndexRange(rungCount).map((index) => (
        <mesh key={index} position={[0, 1.15 + index * ((ladder.height - 2.3) / Math.max(1, rungCount - 1)), 0.08]} castShadow={false}>
          <boxGeometry args={[ladder.width + 0.36, 0.22, 0.28]} />
          <meshBasicMaterial color="#442917" />
        </mesh>
      ))}
    </group>
  );
}

function DesertVillageFence({ fence, baseHeight }: { fence: DesertVillageFence; baseHeight: number }) {
  return (
    <group position={[fence.localX, baseHeight, fence.localZ]} rotation={[0, fence.rotation, 0]}>
      {DESERT_FENCE_POST_OFFSETS.map((offset) => (
        <mesh key={offset} position={[offset * fence.length, 1.7, 0]} castShadow={false}>
          <boxGeometry args={[0.66, 3.4, 0.58]} />
          <meshBasicMaterial color="#2f1d12" />
        </mesh>
      ))}
      <mesh position={[0, 1.55, 0]} castShadow={false}>
        <boxGeometry args={[fence.length, 0.38, 0.38]} />
        <meshBasicMaterial color="#442917" />
      </mesh>
      <mesh position={[0, 2.72, 0]} castShadow={false}>
        <boxGeometry args={[fence.length, 0.34, 0.34]} />
        <meshBasicMaterial color="#352014" />
      </mesh>
    </group>
  );
}

function DesertClothesLine({ line, baseHeight }: { line: DesertVillageClothesLine; baseHeight: number }) {
  const rope = useMemo(() => {
    const start = new THREE.Vector3(line.startX, baseHeight + line.y, line.startZ);
    const end = new THREE.Vector3(line.endX, baseHeight + line.y - 0.6, line.endZ);
    const direction = new THREE.Vector3().subVectors(end, start);
    const length = Math.max(0.1, direction.length());
    const midpoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      direction.clone().normalize(),
    );
    const yaw = Math.atan2(direction.x, direction.z);

    return { start, end, midpoint, length, quaternion, yaw };
  }, [baseHeight, line]);

  return (
    <group>
      <mesh position={rope.midpoint} quaternion={rope.quaternion} castShadow={false}>
        <cylinderGeometry args={[0.08, 0.08, rope.length, 5]} />
        <meshBasicMaterial color="#4a2d18" />
      </mesh>
      {line.colors.map((color, index) => {
        const t = 0.26 + index * 0.24;
        const x = lerpNumber(rope.start.x, rope.end.x, t);
        const y = lerpNumber(rope.start.y, rope.end.y, t) - 1.45;
        const z = lerpNumber(rope.start.z, rope.end.z, t);
        return (
          <mesh key={`${line.key}-cloth-${index}`} position={[x, y, z]} rotation={[0, rope.yaw, 0]} castShadow={false}>
            <boxGeometry args={[2.8, 2.8 + (index % 2) * 0.65, 0.12]} />
            <meshBasicMaterial color={color} />
          </mesh>
        );
      })}
    </group>
  );
}

function DesertStreetProp({ prop, baseHeight }: { prop: DesertVillageStreetProp; baseHeight: number }) {
  if (prop.kind === "barrel") {
    return (
      <group position={[prop.localX, baseHeight, prop.localZ]} rotation={[0, prop.rotation, 0]} scale={[prop.scale, prop.scale, prop.scale]}>
        <mesh position={[0, 1.55, 0]} castShadow={false}>
          <cylinderGeometry args={[1.25, 1.45, 3.1, 8]} />
          <meshBasicMaterial color="#4a2a17" />
        </mesh>
        <mesh position={[0, 2.55, 0]} castShadow={false}>
          <cylinderGeometry args={[1.48, 1.48, 0.22, 8]} />
          <meshBasicMaterial color="#1d120b" />
        </mesh>
        <mesh position={[0, 0.62, 0]} castShadow={false}>
          <cylinderGeometry args={[1.42, 1.42, 0.22, 8]} />
          <meshBasicMaterial color="#1d120b" />
        </mesh>
      </group>
    );
  }

  if (prop.kind === "crate") {
    return (
      <group position={[prop.localX, baseHeight, prop.localZ]} rotation={[0, prop.rotation, 0]} scale={[prop.scale, prop.scale, prop.scale]}>
        <mesh position={[0, 1.35, 0]} castShadow={false} receiveShadow>
          <boxGeometry args={[2.85, 2.7, 2.85]} />
          <meshBasicMaterial color="#3d2414" />
        </mesh>
        <mesh position={[0, 1.38, 1.48]} castShadow={false}>
          <boxGeometry args={[3.05, 0.28, 0.26]} />
          <meshBasicMaterial color="#21140b" />
        </mesh>
        <mesh position={[0, 1.38, -1.48]} castShadow={false}>
          <boxGeometry args={[3.05, 0.28, 0.26]} />
          <meshBasicMaterial color="#21140b" />
        </mesh>
        <mesh position={[1.48, 1.38, 0]} castShadow={false}>
          <boxGeometry args={[0.26, 0.28, 3.05]} />
          <meshBasicMaterial color="#21140b" />
        </mesh>
      </group>
    );
  }

  return (
    <group position={[prop.localX, baseHeight + 0.58 * prop.scale, prop.localZ]} rotation={[0, prop.rotation, 0]} scale={[prop.scale * 1.35, prop.scale * 0.72, prop.scale]}>
      <mesh castShadow={false} receiveShadow>
        <sphereGeometry args={[1.55, 8, 5]} />
        <meshBasicMaterial color="#c7a46b" />
      </mesh>
      <mesh position={[0.2, 1.05, 0]} scale={[0.78, 0.22, 0.55]} castShadow={false}>
        <sphereGeometry args={[0.9, 7, 4]} />
        <meshBasicMaterial color="#dfc18a" />
      </mesh>
    </group>
  );
}

function DesertVillageDressing({
  layout,
  baseHeight,
  showDetails,
}: {
  layout: DesertVillageLayout;
  baseHeight: number;
  showDetails: boolean;
}) {
  if (!showDetails) return null;

  return (
    <>
      {layout.fences.map((fence) => (
        <DesertVillageFence key={fence.key} fence={fence} baseHeight={baseHeight} />
      ))}
      {layout.ladders.map((ladder) => (
        <DesertVillageLadder key={ladder.key} ladder={ladder} baseHeight={baseHeight} />
      ))}
      {layout.clothesLines.map((line) => (
        <DesertClothesLine key={line.key} line={line} baseHeight={baseHeight} />
      ))}
      {layout.streetProps.map((prop) => (
        <DesertStreetProp key={prop.key} prop={prop} baseHeight={baseHeight} />
      ))}
    </>
  );
}

function DesertMarketStall({ stall, baseHeight }: { stall: DesertVillageMarketStall; baseHeight: number }) {
  return (
    <group position={[stall.localX, baseHeight, stall.localZ]} rotation={[0, stall.rotation, 0]}>
      <mesh position={[0, 2.4, 0]} castShadow={false}>
        <boxGeometry args={[10, 4.8, 5.5]} />
        <meshBasicMaterial color="#80512a" />
      </mesh>
      <mesh position={[0, 5.4, 0]} castShadow={false}>
        <boxGeometry args={[12.5, 1.1, 7.2]} />
        <meshBasicMaterial color={stall.color} />
      </mesh>
      <mesh position={[0, 5.95, 0]} rotation={[0, 0, 0.16]} castShadow={false}>
        <boxGeometry args={[13.5, 0.7, 7.8]} />
        <meshBasicMaterial color={stall.color} />
      </mesh>
    </group>
  );
}

function DesertPalm({ palm }: { palm: DesertVillagePalm }) {
  return (
    <group position={[palm.localX, palm.localY, palm.localZ]} rotation={[0, palm.rotation, 0]} scale={[palm.scale, palm.scale, palm.scale]}>
      <mesh position={[0, 12.4, 0]} rotation={[0.12, 0, 0.08]} castShadow={false}>
        <cylinderGeometry args={[0.95, 1.42, 24.8, 6]} />
        <meshBasicMaterial color="#6b3f20" />
      </mesh>
      {getCachedIndexRange(9).map((index) => {
        const angle = (Math.PI * 2 * index) / 9;
        return (
          <group key={index} position={[Math.sin(angle) * 4.2, 25.2, Math.cos(angle) * 4.2]} rotation={[0.5, angle, 0.18]}>
            <mesh scale={[0.79, 0.23, 8.34]} castShadow={false} renderOrder={3}>
              <dodecahedronGeometry args={[1, 0]} />
              <meshBasicMaterial color={PLANT_EDGE_COLOR} wireframe transparent opacity={0.42} depthWrite={false} />
            </mesh>
            <mesh scale={[0.775, 0.22, 8.25]} castShadow={false}>
              <dodecahedronGeometry args={[1, 0]} />
              <meshBasicMaterial color={index % 2 === 0 ? "#2f7a3f" : "#3e8f48"} />
            </mesh>
          </group>
        );
      })}
      <mesh position={[-1.15, 22.6, 0.95]} castShadow={false}>
        <sphereGeometry args={[0.72, 6, 4]} />
        <meshBasicMaterial color="#8b5c21" />
      </mesh>
      <mesh position={[0.25, 22.1, 1.15]} castShadow={false}>
        <sphereGeometry args={[0.62, 6, 4]} />
        <meshBasicMaterial color="#a06a28" />
      </mesh>
      <mesh position={[1.25, 22.8, 0.5]} castShadow={false}>
        <sphereGeometry args={[0.58, 6, 4]} />
        <meshBasicMaterial color="#7f4d1f" />
      </mesh>
    </group>
  );
}

function DesertVillageGateArch({ side, baseHeight }: { side: GateSide; baseHeight: number }) {
  const z = side === "north" ? -DESERT_VILLAGE_RADIUS : side === "south" ? DESERT_VILLAGE_RADIUS : 0;
  const x = side === "east" ? DESERT_VILLAGE_RADIUS : side === "west" ? -DESERT_VILLAGE_RADIUS : 0;
  const isNorthSouth = side === "north" || side === "south";
  const adobeTexture = useMemo(() => getDesertAdobeWallTexture(), []);
  const trim = "#e1bd78";

  if (isNorthSouth) {
    return (
      <group>
        <mesh position={[-36, baseHeight + 8.2, z]} castShadow={false} receiveShadow>
          <boxGeometry args={[10, 16.4, 12]} />
          <meshBasicMaterial map={adobeTexture} />
        </mesh>
        <mesh position={[36, baseHeight + 8.2, z]} castShadow={false} receiveShadow>
          <boxGeometry args={[10, 16.4, 12]} />
          <meshBasicMaterial map={adobeTexture} />
        </mesh>
        <mesh position={[0, baseHeight + 18.4, z]} castShadow={false} receiveShadow>
          <boxGeometry args={[84, 5.6, 12]} />
          <meshBasicMaterial map={adobeTexture} />
        </mesh>
        <mesh position={[0, baseHeight + 22.2, z]} castShadow={false}>
          <boxGeometry args={[34, 4.8, 12]} />
          <meshBasicMaterial color={trim} />
        </mesh>
      </group>
    );
  }

  return (
    <group>
      <mesh position={[x, baseHeight + 8.2, -36]} castShadow={false} receiveShadow>
        <boxGeometry args={[12, 16.4, 10]} />
        <meshBasicMaterial map={adobeTexture} />
      </mesh>
      <mesh position={[x, baseHeight + 8.2, 36]} castShadow={false} receiveShadow>
        <boxGeometry args={[12, 16.4, 10]} />
        <meshBasicMaterial map={adobeTexture} />
      </mesh>
      <mesh position={[x, baseHeight + 18.4, 0]} castShadow={false} receiveShadow>
        <boxGeometry args={[12, 5.6, 84]} />
        <meshBasicMaterial map={adobeTexture} />
      </mesh>
      <mesh position={[x, baseHeight + 22.2, 0]} castShadow={false}>
        <boxGeometry args={[12, 4.8, 34]} />
        <meshBasicMaterial color={trim} />
      </mesh>
    </group>
  );
}

function DesertVillageWallVisuals({
  wallSegments,
  baseHeight,
}: {
  wallSegments: DesertVillageWallSegment[];
  baseHeight: number;
}) {
  const wallRef = useRef<THREE.InstancedMesh>(null);
  const adobeTexture = useMemo(() => getDesertAdobeWallTexture(), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    const wallMesh = wallRef.current;
    if (!wallMesh) return;

    for (let index = 0; index < wallSegments.length; index += 1) {
      const segment = wallSegments[index];
      dummy.position.set(segment.localX, baseHeight + segment.height / 2, segment.localZ);
      dummy.rotation.set(0, segment.rotation, 0);
      dummy.scale.set(segment.width, segment.height, segment.depth);
      dummy.updateMatrix();
      wallMesh.setMatrixAt(index, dummy.matrix);
    }

    wallMesh.instanceMatrix.needsUpdate = true;
  }, [baseHeight, dummy, wallSegments]);

  return (
    <>
      <instancedMesh ref={wallRef} args={[undefined, undefined, wallSegments.length]} castShadow={false} receiveShadow frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial map={adobeTexture} />
      </instancedMesh>
      <DesertVillageGateArch side="north" baseHeight={baseHeight} />
      <DesertVillageGateArch side="south" baseHeight={baseHeight} />
      <DesertVillageGateArch side="east" baseHeight={baseHeight} />
      <DesertVillageGateArch side="west" baseHeight={baseHeight} />
    </>
  );
}

function DesertVillageWell({ baseHeight }: { baseHeight: number }) {
  return (
    <group name="desert-village-well">
      <mesh position={[0, baseHeight + 3.5, 0]} castShadow={false} receiveShadow>
        <cylinderGeometry args={[28, 31, 7, 20]} />
        <meshBasicMaterial color="#9a6b3e" />
      </mesh>
      <mesh position={[0, baseHeight + 7.25, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow={false}>
        <circleGeometry args={[22, 20]} />
        <meshBasicMaterial color="#3aa0b8" transparent opacity={0.86} />
      </mesh>
      <mesh position={[0, baseHeight + 8.15, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow={false}>
        <ringGeometry args={[27.5, 32, 20]} />
        <meshBasicMaterial color="#d5aa64" />
      </mesh>
      <mesh position={[-18, baseHeight + 16, 0]} castShadow={false}>
        <boxGeometry args={[3.4, 17, 3.4]} />
        <meshBasicMaterial color="#7a4a2b" />
      </mesh>
      <mesh position={[18, baseHeight + 16, 0]} castShadow={false}>
        <boxGeometry args={[3.4, 17, 3.4]} />
        <meshBasicMaterial color="#7a4a2b" />
      </mesh>
      <mesh position={[0, baseHeight + 25.2, 0]} castShadow={false}>
        <boxGeometry args={[45, 4.2, 5]} />
        <meshBasicMaterial color="#704026" />
      </mesh>
    </group>
  );
}

function DesertVillageColliders({
  chunk,
  baseHeight,
  layout,
  groundGeometry,
  detailsReady,
}: {
  chunk: SurvivalChunkInfo;
  baseHeight: number;
  layout: DesertVillageLayout;
  groundGeometry: THREE.BufferGeometry;
  detailsReady: boolean;
}) {
  if (!shouldBuildSurvivalChunkColliders(chunk)) return null;

  return (
    <>
      <RigidBody type="fixed" colliders="trimesh" friction={0.25} restitution={0} position={[chunk.x, 0, chunk.z]}>
        <mesh geometry={groundGeometry} dispose={null}>
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </RigidBody>
      {detailsReady && <RigidBody type="fixed" colliders={false} friction={0.25} restitution={0} position={[chunk.x, 0, chunk.z]}>
        <CylinderCollider args={[3.5, 31]} position={[0, baseHeight + 3.5, 0]} />
        <CuboidCollider args={[1.7, 8.5, 1.7]} position={[-18, baseHeight + 16, 0]} />
        <CuboidCollider args={[1.7, 8.5, 1.7]} position={[18, baseHeight + 16, 0]} />
        <CuboidCollider args={[22.5, 2.1, 2.5]} position={[0, baseHeight + 25.2, 0]} />
        {layout.wallSegments.map((segment) => (
          <CuboidCollider
            key={`${segment.key}-collider`}
            args={[segment.width / 2, segment.height / 2, segment.depth / 2]}
            position={[segment.localX, baseHeight + segment.height / 2, segment.localZ]}
            rotation={[0, segment.rotation, 0]}
          />
        ))}
        {layout.buildings.map((building) => {
          const wallThickness = Math.min(DESERT_BUILDING_WALL_THICKNESS, building.width * 0.16, building.depth * 0.16);
          const doorWidth = Math.min(DESERT_BUILDING_DOOR_WIDTH, building.width - wallThickness * 4);
          const doorHeight = Math.min(DESERT_BUILDING_DOOR_HEIGHT, building.height - 1.2);
          const frontWallWidth = Math.max(1.2, (building.width - doorWidth) / 2);
          const lintelHeight = Math.max(0.8, building.height - doorHeight);

          return (
            <group key={`${building.key}-colliders`} position={[building.localX, baseHeight, building.localZ]} rotation={[0, building.rotation, 0]}>
              <CuboidCollider
                args={[wallThickness / 2, building.height / 2, building.depth / 2]}
                position={[-building.width / 2 + wallThickness / 2, building.height / 2, 0]}
              />
              <CuboidCollider
                args={[wallThickness / 2, building.height / 2, building.depth / 2]}
                position={[building.width / 2 - wallThickness / 2, building.height / 2, 0]}
              />
              <CuboidCollider
                args={[building.width / 2, building.height / 2, wallThickness / 2]}
                position={[0, building.height / 2, -building.depth / 2 + wallThickness / 2]}
              />
              <CuboidCollider
                args={[frontWallWidth / 2, building.height / 2, wallThickness / 2]}
                position={[-doorWidth / 2 - frontWallWidth / 2, building.height / 2, building.depth / 2 - wallThickness / 2]}
              />
              <CuboidCollider
                args={[frontWallWidth / 2, building.height / 2, wallThickness / 2]}
                position={[doorWidth / 2 + frontWallWidth / 2, building.height / 2, building.depth / 2 - wallThickness / 2]}
              />
              <CuboidCollider
                args={[doorWidth / 2, lintelHeight / 2, wallThickness / 2]}
                position={[0, doorHeight + lintelHeight / 2, building.depth / 2 - wallThickness / 2]}
              />
            </group>
          );
        })}
        {layout.fences.map((fence) => (
          <group key={`${fence.key}-colliders`} position={[fence.localX, baseHeight, fence.localZ]} rotation={[0, fence.rotation, 0]}>
            {DESERT_FENCE_POST_OFFSETS.map((offset) => (
              <CuboidCollider key={`${fence.key}-post-${offset}`} args={[0.33, 1.7, 0.29]} position={[offset * fence.length, 1.7, 0]} />
            ))}
            <CuboidCollider args={[fence.length / 2, 0.19, 0.19]} position={[0, 1.55, 0]} />
            <CuboidCollider args={[fence.length / 2, 0.17, 0.17]} position={[0, 2.72, 0]} />
          </group>
        ))}
        {layout.streetProps.map((prop) => {
          if (prop.kind === "barrel") {
            return (
              <CylinderCollider
                key={`${prop.key}-collider`}
                args={[1.55 * prop.scale, 1.48 * prop.scale]}
                position={[prop.localX, baseHeight + 1.55 * prop.scale, prop.localZ]}
              />
            );
          }

          if (prop.kind === "crate") {
            return (
              <CuboidCollider
                key={`${prop.key}-collider`}
                args={[1.525 * prop.scale, 1.35 * prop.scale, 1.525 * prop.scale]}
                position={[prop.localX, baseHeight + 1.35 * prop.scale, prop.localZ]}
                rotation={[0, prop.rotation, 0]}
              />
            );
          }

          return (
            <CuboidCollider
              key={`${prop.key}-collider`}
              args={[1.75 * prop.scale, 0.58 * prop.scale, 1.2 * prop.scale]}
              position={[prop.localX, baseHeight + 0.58 * prop.scale, prop.localZ]}
              rotation={[0, prop.rotation, 0]}
            />
          );
        })}
        {layout.marketStalls.map((stall) => (
          <group key={`${stall.key}-colliders`} position={[stall.localX, baseHeight, stall.localZ]} rotation={[0, stall.rotation, 0]}>
            <CuboidCollider args={[5, 2.4, 2.75]} position={[0, 2.4, 0]} />
            <CuboidCollider args={[6.75, 0.55, 3.9]} position={[0, 5.95, 0]} />
          </group>
        ))}
        {layout.palms.map((palm) => (
          <CylinderCollider
            key={`${palm.key}-trunk-collider`}
            args={[12.4 * palm.scale, 1.42 * palm.scale]}
            position={[palm.localX, palm.localY + 12.4 * palm.scale, palm.localZ]}
          />
        ))}
      </RigidBody>}
    </>
  );
}

export function SurvivalDesertVillage({
  chunk,
  terrainHeightForChunk,
  villageBaseHeightForChunk,
  villagePadHeightForChunk,
  makeVillagePadGeometry,
  makeVillagePadSkirtGeometry,
}: {
  chunk: SurvivalChunkInfo;
  terrainHeightForChunk: SurvivalTerrainHeightForChunk;
  villageBaseHeightForChunk: SurvivalVillageBaseHeightForChunk;
  villagePadHeightForChunk: SurvivalVillagePadHeightForChunk;
  makeVillagePadGeometry: SurvivalVillageGeometryFactory;
  makeVillagePadSkirtGeometry: SurvivalVillageGeometryFactory;
}) {
  const [phase, setPhase] = useState(() => (typeof window === "undefined" ? 3 : 0));
  const villageBaseHeight = useMemo(() => villageBaseHeightForChunk(chunk), [chunk, villageBaseHeightForChunk]);
  const villagePadGeometry = useMemo(() => makeVillagePadGeometry(chunk), [chunk, makeVillagePadGeometry]);
  const hasVillagePadSkirt = shouldRenderSurvivalChunkSkirt(chunk);
  const villagePadSkirtGeometry = useMemo(
    () => hasVillagePadSkirt ? makeVillagePadSkirtGeometry(chunk) : null,
    [chunk, hasVillagePadSkirt, makeVillagePadSkirtGeometry]
  );
  const villagePadCollisionGeometry = useMemo(() => makeVillagePadGeometry(chunk), [chunk, makeVillagePadGeometry]);
  const layout = useMemo(
    () => makeDesertVillageLayout(chunk, villageBaseHeight, terrainHeightForChunk),
    [chunk, terrainHeightForChunk, villageBaseHeight],
  );
  useSurvivalFeatureCount(
    "desertVillageBuildings",
    `survival-desert-village-buildings-${chunk.key}`,
    phase >= 2 ? layout.buildings.length : 0,
  );

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    setPhase(0);
    const collisionAndWalls = window.setTimeout(() => {
      startTransition(() => setPhase(1));
    }, 90);
    const buildings = window.setTimeout(() => {
      startTransition(() => setPhase(2));
    }, 280);
    const dressing = window.setTimeout(() => {
      startTransition(() => setPhase(3));
    }, 620);

    return () => {
      window.clearTimeout(collisionAndWalls);
      window.clearTimeout(buildings);
      window.clearTimeout(dressing);
    };
  }, [chunk.key]);

  return (
    <>
      <DesertVillageColliders
        chunk={chunk}
        baseHeight={villageBaseHeight}
        layout={layout}
        groundGeometry={villagePadCollisionGeometry}
        detailsReady={phase >= 1}
      />
      <group name={`survival-desert-village-${chunk.key}`} position={[chunk.x, 0, chunk.z]}>
        {villagePadSkirtGeometry && (
          <mesh geometry={villagePadSkirtGeometry} dispose={null}>
            <meshBasicMaterial vertexColors side={THREE.DoubleSide} />
          </mesh>
        )}
        <DesertVillageSurface
          geometry={villagePadGeometry}
          baseHeight={villageBaseHeight}
          chunk={chunk}
          villageBaseHeightForChunk={villageBaseHeightForChunk}
          villagePadHeightForChunk={villagePadHeightForChunk}
        />
        {phase >= 1 && <DesertVillageWallVisuals wallSegments={layout.wallSegments} baseHeight={villageBaseHeight} />}
        {phase >= 2 && <DesertVillageBuildings
          buildings={layout.buildings}
          baseHeight={villageBaseHeight}
          showDetails={chunk.distance === 0}
        />}
        {phase >= 3 && <DesertVillageDressing
          layout={layout}
          baseHeight={villageBaseHeight}
          showDetails={chunk.distance === 0}
        />}
        {phase >= 1 && <DesertVillageWell baseHeight={villageBaseHeight} />}
        {phase >= 3 && layout.marketStalls.map((stall) => (
          <DesertMarketStall key={stall.key} stall={stall} baseHeight={villageBaseHeight} />
        ))}
        {phase >= 3 && layout.palms.map((palm) => (
          <DesertPalm key={palm.key} palm={palm} />
        ))}
      </group>
      {phase >= 3 && chunk.distance === 0 && (
        <Villagers
          key={`survival-desert-villagers-${chunk.key}`}
          huts={layout.huts}
          name={`survival-desert-villagers-${chunk.key}`}
        />
      )}
    </>
  );
}

