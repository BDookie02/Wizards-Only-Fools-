import * as THREE from "three";
import type { HutInfo } from "./baseVillageHutLayout";
import { DESERT_VILLAGE_RADIUS, isNearDesertGate } from "./survivalDesertVillageTerrain";
import { lerpNumber, survivalHash01 } from "../survival/survivalMath";
import type { SurvivalChunkInfo } from "../survival/survivalWorldConfig";

export type DesertVillageClothesLine = {
  key: string;
  startX: number;
  startZ: number;
  endX: number;
  endZ: number;
  y: number;
  colors: [string, string, string];
};

export type DesertVillageBuilding = {
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

export type DesertVillageWallSegment = {
  key: string;
  localX: number;
  localZ: number;
  rotation: number;
  width: number;
  height: number;
  depth: number;
};

export type DesertVillageMarketStall = {
  key: string;
  localX: number;
  localZ: number;
  rotation: number;
  color: string;
};

export type DesertVillagePalm = {
  key: string;
  localX: number;
  localY: number;
  localZ: number;
  scale: number;
  rotation: number;
};

export type DesertVillageLadder = {
  key: string;
  localX: number;
  localZ: number;
  rotation: number;
  height: number;
  width: number;
};

export type DesertVillageFence = {
  key: string;
  localX: number;
  localZ: number;
  rotation: number;
  length: number;
};

export type DesertVillageStreetProp = {
  key: string;
  kind: "barrel" | "crate" | "sack";
  localX: number;
  localZ: number;
  rotation: number;
  scale: number;
};

export type DesertVillageLayout = {
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

export type DesertVillageTerrainHeightForChunk = (chunk: SurvivalChunkInfo, localX: number, localZ: number) => number;

export type DesertClothesLineClothDescriptor = {
  key: string;
  color: string;
  height: number;
  position: [number, number, number];
  rotation: [number, number, number];
};

export type DesertClothesLineRenderDescriptor = {
  midpoint: THREE.Vector3;
  quaternion: THREE.Quaternion;
  length: number;
  cloths: DesertClothesLineClothDescriptor[];
};

const DESERT_CLOTHESLINE_UP = new THREE.Vector3(0, 1, 0);
const DESERT_CLOTH_START_T = 0.26;
const DESERT_CLOTH_STEP_T = 0.24;
const DESERT_CLOTH_DROP = 1.45;
const DESERT_WALL_SEGMENT_COUNT = 72;
const DESERT_WALL_SEGMENT_WIDTH = (Math.PI * 2 * DESERT_VILLAGE_RADIUS / DESERT_WALL_SEGMENT_COUNT) * 1.16;
const DESERT_GATE_HALF_WIDTH = 50;
const DESERT_BUILDING_COLORS = ["#d8b06f", "#c99a55", "#e0bd82", "#bf8542", "#d1a062"];
const DESERT_ROOF_COLORS = ["#a96835", "#8f552e", "#bd7a3d", "#7a462a"];
const DESERT_MARKET_COLORS = ["#2f9bb2", "#d95f3d", "#d6b145", "#7f5bb8", "#52a35a"];
const DESERT_CLOTH_COLORS = ["#e9d7a0", "#c94f3f", "#3f9fb5", "#dfb548", "#8d6bbb", "#f2eee3"];

export function makeDesertVillageWallSegments(): DesertVillageWallSegment[] {
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

export function makeDesertVillageLayout(
  chunk: SurvivalChunkInfo,
  baseHeight: number,
  terrainHeightForChunk: DesertVillageTerrainHeightForChunk,
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

export function getDesertClothesLineRenderDescriptor(
  line: DesertVillageClothesLine,
  baseHeight: number,
): DesertClothesLineRenderDescriptor {
  const start = new THREE.Vector3(line.startX, baseHeight + line.y, line.startZ);
  const end = new THREE.Vector3(line.endX, baseHeight + line.y - 0.6, line.endZ);
  const direction = new THREE.Vector3().subVectors(end, start);
  const directionLength = direction.length();
  const length = Math.max(0.1, directionLength);
  const midpoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
  const normalizedDirection = directionLength > 0.0001
    ? direction.clone().normalize()
    : DESERT_CLOTHESLINE_UP;
  const quaternion = new THREE.Quaternion().setFromUnitVectors(DESERT_CLOTHESLINE_UP, normalizedDirection);
  const yaw = Math.atan2(direction.x, direction.z);
  const cloths = new Array<DesertClothesLineClothDescriptor>(line.colors.length);

  for (let index = 0; index < line.colors.length; index += 1) {
    const t = DESERT_CLOTH_START_T + index * DESERT_CLOTH_STEP_T;
    cloths[index] = {
      key: `${line.key}-cloth-${index}`,
      color: line.colors[index],
      height: 2.8 + (index % 2) * 0.65,
      position: [
        lerpNumber(start.x, end.x, t),
        lerpNumber(start.y, end.y, t) - DESERT_CLOTH_DROP,
        lerpNumber(start.z, end.z, t),
      ],
      rotation: [0, yaw, 0],
    };
  }

  return { midpoint, quaternion, length, cloths };
}
