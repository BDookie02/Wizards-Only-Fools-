import { type CharacterCustomization } from "../../../../store/gameStore";
import { clamp01, survivalHash01 } from "../survival/survivalMath";
import { type SurvivalChunkInfo } from "../survival/survivalWorldConfig";
import { CHICAGO_FACADE_STYLE_COUNT } from "./survivalChicagoCityTextures";

export type ChicagoBuilding = {
  key: string;
  localX: number;
  localZ: number;
  width: number;
  depth: number;
  height: number;
  rotation: number;
  color: string;
  roofColor: string;
  facadeStyle: number;
  enterable: boolean;
  operatorCharacter: CharacterCustomization;
  landmark?: "willis" | "hancock" | "watertower" | "skyscraper";
};

export type ChicagoPedestrian = {
  key: string;
  route: "horizontal" | "vertical";
  lane: number;
  sideOffset: number;
  offset: number;
  speed: number;
  direction: 1 | -1;
  character: CharacterCustomization;
};

export type ChicagoCar = {
  key: string;
  route: "horizontal" | "vertical" | "lakeshore";
  vehicleType: "sedan" | "taxi" | "police" | "ambulance" | "firetruck" | "bus";
  lane: number;
  offset: number;
  speed: number;
  direction: 1 | -1;
  color: string;
  scale: number;
};

export type ChicagoLayout = {
  buildings: ChicagoBuilding[];
  pedestrians: ChicagoPedestrian[];
  cars: ChicagoCar[];
};

export type ChicagoTrafficLightIntersection = { key: string; x: number; z: number };
export type ChicagoLamp = { key: string; x: number; z: number; rotation: number };
export type ChicagoStreetTree = { key: string; x: number; z: number; scale: number };

export const CHICAGO_CITY_HALF_SIZE = 236;
export const CHICAGO_ROAD_POSITIONS = [-150, -75, 75, 150];
export const CHICAGO_BLOCK_CENTERS = [-194, -112, -38, 38, 112, 186];
export const CHICAGO_BUILDING_COLORS = ["#d7e3ee", "#c2d2df", "#e7eef5", "#b6c8d6", "#ccd8e3", "#bfcedd"];
export const CHICAGO_ROOF_COLORS = ["#1e293b", "#263241", "#334155", "#172033"];
export const CHICAGO_CAR_COLORS = ["#facc15", "#ef4444", "#2563eb", "#f8fafc", "#22c55e", "#f97316", "#ec4899", "#06b6d4"];
export const CHICAGO_CLOTHING_COLORS = ["#1d4ed8", "#dc2626", "#16a34a", "#7c3aed", "#0f172a", "#ea580c", "#be123c", "#0891b2"];
export const CHICAGO_BEAN_PARK_X = -36;
export const CHICAGO_BEAN_PARK_Z = 118;
export const CHICAGO_LED_SIGN_UPDATE_INTERVAL_SECONDS = 1 / 24;
export const MOBILE_CHICAGO_LED_SIGN_UPDATE_INTERVAL_SECONDS = 1 / 16;
export const CHICAGO_TRAFFIC_UPDATE_INTERVAL_SECONDS = 1 / 30;
export const MOBILE_CHICAGO_TRAFFIC_UPDATE_INTERVAL_SECONDS = 1 / 20;
export const CHICAGO_PEDESTRIAN_UPDATE_INTERVAL_SECONDS = 1 / 24;
export const MOBILE_CHICAGO_PEDESTRIAN_UPDATE_INTERVAL_SECONDS = 1 / 16;
export const CHICAGO_SKYSCRAPER_X = -38;
export const CHICAGO_SKYSCRAPER_Z = 186;
export const CHICAGO_INTERSECTION_CLEARANCE = 30;
export const CHICAGO_SIDEWALK_PROP_OFFSET = 20.4;
export const CHICAGO_SIDEWALK_SEGMENT_GAP = 29;
export const CHICAGO_SAFE_STREET_OFFSETS = [-207, -112, -38, 38, 112, 207];
export const CHICAGO_LAMP_OFFSETS = [-202, -126, -34, 34, 126, 202] as const;
export const CHICAGO_HYDRANT_OFFSETS = [-186, -62, 62, 186] as const;
export const CHICAGO_SIDE_SIGNS = [-1, 1] as const;
export const CHICAGO_CROSSWALK_BAR_OFFSETS = [-9, -5.4, -1.8, 1.8, 5.4, 9] as const;
export const CHICAGO_PARKING_LINE_INDICES = [0, 1, 2, 3, 4, 5, 6, 7] as const;
export const CHICAGO_CAR_WHEEL_SIDES = [-1, 1] as const;
export const CHICAGO_BENCH_LEG_X = [-2.2, 2.2] as const;
export const CHICAGO_BEAN_BOLLARD_X = [-18, -6, 6, 18] as const;
export const CHICAGO_TRAFFIC_LIGHT_POLES = [
  { key: "northwest", offsetX: -18, offsetZ: -18, yaw: 0 },
  { key: "southeast", offsetX: 18, offsetZ: 18, yaw: Math.PI },
] as const;
export const CHICAGO_TRAFFIC_SIGNAL_LIGHTS = [
  { color: "#ef4444", y: 8.42 },
  { color: "#facc15", y: 7.55 },
  { color: "#22c55e", y: 6.68 },
] as const;

export function isNearChicagoIntersectionBand(value: number, clearance = CHICAGO_INTERSECTION_CLEARANCE) {
  for (let index = 0; index < CHICAGO_ROAD_POSITIONS.length; index += 1) {
    const road = CHICAGO_ROAD_POSITIONS[index];
    if (Math.abs(value - road) < clearance) return true;
  }
  return false;
}

export function makeChicagoTrafficLightIntersections(): ChicagoTrafficLightIntersection[] {
  const items: ChicagoTrafficLightIntersection[] = [];
  for (let xIndex = 0; xIndex < CHICAGO_ROAD_POSITIONS.length; xIndex += 1) {
    const x = CHICAGO_ROAD_POSITIONS[xIndex];
    for (let zIndex = 0; zIndex < CHICAGO_ROAD_POSITIONS.length; zIndex += 1) {
      const z = CHICAGO_ROAD_POSITIONS[zIndex];
      items.push({ key: `${x}:${z}`, x, z });
    }
  }
  return items;
}

export function makeChicagoLampLayout(): ChicagoLamp[] {
  const items: ChicagoLamp[] = [];
  const aimToward = (x: number, z: number, targetX: number, targetZ: number) => Math.atan2(targetX - x, targetZ - z);

  for (let roadIndex = 0; roadIndex < CHICAGO_ROAD_POSITIONS.length; roadIndex += 1) {
    const road = CHICAGO_ROAD_POSITIONS[roadIndex];
    for (let index = 0; index < CHICAGO_LAMP_OFFSETS.length; index += 1) {
      const offset = CHICAGO_LAMP_OFFSETS[index];
      const side = index % 2 === 0 ? -1 : 1;
      const verticalX = road + side * 17.4;
      const horizontalZ = road + side * 17.4;
      items.push({
        key: `lamp-v-${road}-${offset}`,
        x: verticalX,
        z: offset,
        rotation: aimToward(verticalX, offset, road, offset),
      });
      items.push({
        key: `lamp-h-${road}-${offset}`,
        x: offset,
        z: horizontalZ,
        rotation: aimToward(offset, horizontalZ, offset, road),
      });
    }
  }

  return items;
}

export function makeChicagoStreetTreeLayout(): ChicagoStreetTree[] {
  const items: ChicagoStreetTree[] = [];
  for (let roadIndex = 0; roadIndex < CHICAGO_ROAD_POSITIONS.length; roadIndex += 1) {
    const road = CHICAGO_ROAD_POSITIONS[roadIndex];
    for (let index = 0; index < CHICAGO_SAFE_STREET_OFFSETS.length; index += 1) {
      const offset = CHICAGO_SAFE_STREET_OFFSETS[index];
      if (isNearChicagoIntersectionBand(offset)) continue;
      const side = index % 2 === 0 ? -1 : 1;
      items.push({
        key: `tree-v-${road}-${offset}`,
        x: road + side * (CHICAGO_SIDEWALK_PROP_OFFSET + 0.6),
        z: offset + (roadIndex % 2 === 0 ? 2.2 : -2.2),
        scale: 0.62 + ((index + roadIndex) % 4) * 0.06,
      });
      if (index % 3 !== 1) {
        items.push({
          key: `tree-h-${road}-${offset}`,
          x: offset,
          z: road - side * (CHICAGO_SIDEWALK_PROP_OFFSET + 0.6),
          scale: 0.66 + ((index + roadIndex) % 3) * 0.07,
        });
      }
    }
  }
  return items;
}

export function makeChicagoSidewalkSegments() {
  const cityMin = -CHICAGO_CITY_HALF_SIZE;
  const cityMax = CHICAGO_CITY_HALF_SIZE;
  const segments: Array<{ key: string; center: number; length: number }> = [];
  let cursor = cityMin;

  for (let index = 0; index < CHICAGO_ROAD_POSITIONS.length; index += 1) {
    const road = CHICAGO_ROAD_POSITIONS[index];
    const gap = {
      start: Math.max(cityMin, road - CHICAGO_SIDEWALK_SEGMENT_GAP),
      end: Math.min(cityMax, road + CHICAGO_SIDEWALK_SEGMENT_GAP),
    };
    if (gap.start - cursor > 8) {
      segments.push({
        key: `segment-${index}-before`,
        center: (cursor + gap.start) / 2,
        length: gap.start - cursor,
      });
    }
    cursor = Math.max(cursor, gap.end);
  }

  if (cityMax - cursor > 8) {
    segments.push({
      key: "segment-end",
      center: (cursor + cityMax) / 2,
      length: cityMax - cursor,
    });
  }

  return segments;
}

export function getChicagoStreetFacingRotation(x: number, z: number, targetX: number, targetZ: number) {
  return Math.atan2(targetX - x, targetZ - z);
}

export function makeChicagoCharacter(chunk: SurvivalChunkInfo, index: number): CharacterCustomization {
  const topColor = CHICAGO_CLOTHING_COLORS[Math.floor(survivalHash01(chunk.cx + index, chunk.cz, 9100) * CHICAGO_CLOTHING_COLORS.length) % CHICAGO_CLOTHING_COLORS.length];
  const pantsColor = survivalHash01(chunk.cx, chunk.cz + index, 9101) > 0.5 ? "#111827" : "#334155";
  const skinRoll = survivalHash01(chunk.cx - index, chunk.cz + index, 9102);
  const skinColor = skinRoll > 0.72 ? "#8d5524" : skinRoll > 0.44 ? "#c68642" : skinRoll > 0.18 ? "#e0ac69" : "#f1c27d";
  const hairColor = survivalHash01(chunk.cx + index, chunk.cz - index, 9103) > 0.5 ? "#1f130d" : "#5a3825";

  return {
    skinColor,
    topColor,
    pantsColor,
    shoesColor: "#111827",
    hatColor: topColor,
    hairColor,
    facialHairColor: hairColor,
    topStyle: "simple",
    pantsStyle: "pants",
    shoesStyle: "shoes",
    hatStyle: index % 5 === 0 ? "cap" : "none",
    hairStyle: index % 4 === 0 ? "short" : index % 4 === 1 ? "bob" : "none",
    facialHairStyle: index % 9 === 0 ? "mustache" : "none",
    eyeStyle: index % 7 === 0 ? "content" : index % 6 === 0 ? "sus" : "calm",
    mouthStyle: index % 6 === 0 ? "smile" : "neutral",
  };
}

export function makeChicagoLayout(chunk: SurvivalChunkInfo): ChicagoLayout {
  const buildings: ChicagoBuilding[] = [];
  const pedestrians: ChicagoPedestrian[] = [];
  const cars: ChicagoCar[] = [];

  let buildingIndex = 0;
  for (let xIndex = 0; xIndex < CHICAGO_BLOCK_CENTERS.length; xIndex += 1) {
    const localX = CHICAGO_BLOCK_CENTERS[xIndex];
    for (let zIndex = 0; zIndex < CHICAGO_BLOCK_CENTERS.length; zIndex += 1) {
      const localZ = CHICAGO_BLOCK_CENTERS[zIndex];
      if (localX > 205 || Math.abs(localZ) < 18) continue;
      const isSkyscraper = localX === CHICAGO_SKYSCRAPER_X && localZ === CHICAGO_SKYSCRAPER_Z;
      if (chunk.lod === "mid" && (xIndex + zIndex) % 2 === 1 && !isSkyscraper) continue;

      const downtownDx = localX + 32;
      const downtownDz = localZ + 26;
      const downtown = 1 - clamp01(Math.sqrt(downtownDx * downtownDx + downtownDz * downtownDz) / 250);
      const hash = survivalHash01(chunk.cx + xIndex * 13, chunk.cz + zIndex * 17, 9140);
      const beanDx = localX - CHICAGO_BEAN_PARK_X;
      const beanDz = localZ - CHICAGO_BEAN_PARK_Z;
      const clearsBeanPark = beanDx * beanDx + beanDz * beanDz < 1764;
      if (clearsBeanPark && !isSkyscraper) continue;

      const isWillis = localX === -38 && localZ === -38;
      const isHancock = localX === 112 && localZ === -112;
      const isWaterTower = localX === -112 && localZ === 112;
      const width = isSkyscraper ? 46 : isWillis ? 34 : isHancock ? 30 : 24 + Math.round(hash * 18);
      const depth = isSkyscraper ? 42 : isWillis ? 32 : isHancock ? 34 : 24 + Math.round(survivalHash01(chunk.cx - xIndex, chunk.cz + zIndex, 9141) * 18);
      const height = isSkyscraper
        ? 320
        : isWillis
          ? 188
          : isHancock
            ? 148
            : isWaterTower
              ? 48
              : 26 + Math.round(downtown * downtown * 118) + Math.round(hash * 36);
      const color = isSkyscraper
        ? "#b9d7ea"
        : isWillis
        ? "#9fb2c6"
        : isHancock
          ? "#a7b7c6"
          : isWaterTower
            ? "#d6d3c8"
            : CHICAGO_BUILDING_COLORS[Math.floor(hash * CHICAGO_BUILDING_COLORS.length) % CHICAGO_BUILDING_COLORS.length];
      const roofColor = CHICAGO_ROOF_COLORS[Math.floor(survivalHash01(chunk.cx + zIndex, chunk.cz - xIndex, 9142) * CHICAGO_ROOF_COLORS.length) % CHICAGO_ROOF_COLORS.length];
      const facadeStyle = isSkyscraper
        ? 0
        : isWillis
        ? 0
        : isHancock
          ? 3
          : isWaterTower
            ? 2
            : Math.floor(survivalHash01(chunk.cx + xIndex * 19, chunk.cz - zIndex * 23, 9144) * CHICAGO_FACADE_STYLE_COUNT) % CHICAGO_FACADE_STYLE_COUNT;
      const enterable = true;

      buildings.push({
        key: `${chunk.key}-chicago-building-${buildingIndex}`,
        localX,
        localZ,
        width,
        depth,
        height,
        rotation: (survivalHash01(chunk.cx + buildingIndex, chunk.cz, 9143) - 0.5) * 0.08,
        color,
        roofColor,
        facadeStyle,
        enterable,
        operatorCharacter: makeChicagoCharacter(chunk, 420 + buildingIndex),
        landmark: isSkyscraper ? "skyscraper" : isWillis ? "willis" : isHancock ? "hancock" : isWaterTower ? "watertower" : undefined,
      });
      buildingIndex += 1;
    }
  }

  const pedestrianCount = chunk.distance === 0 ? 220 : 0;
  for (let index = 0; index < pedestrianCount; index += 1) {
    const horizontal = index % 2 === 0;
    const roadIndex = Math.floor(survivalHash01(chunk.cx + index, chunk.cz, 9160) * CHICAGO_ROAD_POSITIONS.length) % CHICAGO_ROAD_POSITIONS.length;
    const direction = survivalHash01(chunk.cx, chunk.cz + index, 9161) > 0.5 ? 1 : -1;
    const side = index % 4 < 2 ? -1 : 1;
    pedestrians.push({
      key: `${chunk.key}-chicago-ped-${index}`,
      route: horizontal ? "horizontal" : "vertical",
      lane: CHICAGO_ROAD_POSITIONS[roadIndex],
      sideOffset: side * (15.8 + survivalHash01(chunk.cx - index, chunk.cz, 9162) * 1.55),
      offset: survivalHash01(chunk.cx + index, chunk.cz - index, 9163),
      speed: 0.018 + survivalHash01(chunk.cx, chunk.cz + index, 9164) * 0.018,
      direction,
      character: makeChicagoCharacter(chunk, index),
    });
  }

  const carCount = chunk.distance === 0 ? 46 : 0;
  for (let index = 0; index < carCount; index += 1) {
    const routeRoll = index % 5;
    const route = routeRoll === 4 ? "lakeshore" : routeRoll % 2 === 0 ? "horizontal" : "vertical";
    const roadIndex = Math.floor(survivalHash01(chunk.cx - index, chunk.cz, 9180) * CHICAGO_ROAD_POSITIONS.length) % CHICAGO_ROAD_POSITIONS.length;
    const vehicleRoll = survivalHash01(chunk.cx + index * 5, chunk.cz - index * 7, 9185);
    const vehicleType: ChicagoCar["vehicleType"] = index % 13 === 0
      ? "bus"
      : index % 11 === 0
        ? "police"
        : index % 17 === 0
          ? "ambulance"
          : index % 23 === 0
            ? "firetruck"
            : vehicleRoll > 0.48
              ? "taxi"
              : "sedan";
    cars.push({
      key: `${chunk.key}-chicago-car-${index}`,
      route,
      vehicleType,
      lane: route === "lakeshore" ? 196 : CHICAGO_ROAD_POSITIONS[roadIndex],
      offset: survivalHash01(chunk.cx + index, chunk.cz + index, 9181),
      speed: vehicleType === "bus" ? 0.018 : vehicleType === "firetruck" ? 0.024 : 0.03 + survivalHash01(chunk.cx, chunk.cz - index, 9182) * 0.022,
      direction: survivalHash01(chunk.cx - index, chunk.cz + index, 9183) > 0.5 ? 1 : -1,
      color: vehicleType === "taxi"
        ? "#facc15"
        : vehicleType === "police"
          ? "#f8fafc"
          : vehicleType === "ambulance"
            ? "#f8fafc"
            : vehicleType === "firetruck"
              ? "#dc2626"
              : vehicleType === "bus"
                ? "#f8fafc"
                : CHICAGO_CAR_COLORS[index % CHICAGO_CAR_COLORS.length],
      scale: vehicleType === "bus" ? 1.42 : vehicleType === "firetruck" ? 1.52 : vehicleType === "ambulance" ? 1.28 : 0.86 + survivalHash01(chunk.cx + index, chunk.cz, 9184) * 0.28,
    });
  }

  return { buildings, pedestrians, cars };
}
