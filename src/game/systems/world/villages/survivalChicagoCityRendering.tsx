import { Fragment, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { CuboidCollider, CylinderCollider, RigidBody } from "@react-three/rapier";
import * as THREE from "three";
import { SURVIVAL_BLOCK_SIZE, type CharacterCustomization } from "../../../../store/gameStore";
import { AvatarBillboard, NPC_AVATAR_GROUND_LIFT, NPC_AVATAR_SCALE } from "../../../PixelAvatar";
import { getCachedIndexRange } from "../../rendering/indexRange";
import { configurePixelSpriteTexture } from "../../rendering/textures/pixelSpriteTexture";
import { isMobilePerformanceMode } from "../../input/performanceMode";
import { shouldBuildSurvivalChunkColliders, shouldRenderSurvivalChunkSkirt } from "../survival/survivalChunks";
import { clamp01, lerpNumber, survivalHash01 } from "../survival/survivalMath";
import type { SurvivalChunkInfo } from "../survival/survivalWorldConfig";
import { useLazyRef } from "../../react/useLazyRef";
import { FoliageDodeca } from "../vegetation/SurvivalFoliagePrimitives";
import { finalizeSurvivalInstancedMesh } from "../vegetation/survivalInstancing";
import { useSurvivalFeatureCount } from "../../../tools/qa/survivalFeatureCounters";

type SurvivalVillageBaseHeightForChunk = (chunk: SurvivalChunkInfo) => number;
type SurvivalVillageGeometryFactory = (chunk: SurvivalChunkInfo) => THREE.BufferGeometry;

type ChicagoBuilding = {
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

type ChicagoPedestrian = {
  key: string;
  route: "horizontal" | "vertical";
  lane: number;
  sideOffset: number;
  offset: number;
  speed: number;
  direction: 1 | -1;
  character: CharacterCustomization;
};

type ChicagoCar = {
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

type ChicagoLayout = {
  buildings: ChicagoBuilding[];
  pedestrians: ChicagoPedestrian[];
  cars: ChicagoCar[];
};

type ChicagoFlatPlanePatch = { x: number; z: number; width: number; depth: number };
type ChicagoGrassPatch = ChicagoFlatPlanePatch & { key: string; color: string };
type ChicagoCrosswalkStripe = ChicagoFlatPlanePatch & { key: string; opacity: number };
type ChicagoGrassGroup = { color: string; items: ChicagoGrassPatch[] };
type ChicagoCrosswalkGroup = { opacity: number; items: ChicagoCrosswalkStripe[] };
type ChicagoBuildingGroup = ChicagoBuilding[];

const CHICAGO_CITY_HALF_SIZE = 236;
const CHICAGO_ROAD_POSITIONS = [-150, -75, 75, 150];
const CHICAGO_BLOCK_CENTERS = [-194, -112, -38, 38, 112, 186];
const CHICAGO_BUILDING_COLORS = ["#d7e3ee", "#c2d2df", "#e7eef5", "#b6c8d6", "#ccd8e3", "#bfcedd"];
const CHICAGO_ROOF_COLORS = ["#1e293b", "#263241", "#334155", "#172033"];
const CHICAGO_CAR_COLORS = ["#facc15", "#ef4444", "#2563eb", "#f8fafc", "#22c55e", "#f97316", "#ec4899", "#06b6d4"];
const CHICAGO_CLOTHING_COLORS = ["#1d4ed8", "#dc2626", "#16a34a", "#7c3aed", "#0f172a", "#ea580c", "#be123c", "#0891b2"];
const CHICAGO_FACADE_STYLE_COUNT = 6;
const CHICAGO_BEAN_PARK_X = -36;
const CHICAGO_BEAN_PARK_Z = 118;
const CHICAGO_LED_SIGN_UPDATE_INTERVAL_SECONDS = 1 / 24;
const MOBILE_CHICAGO_LED_SIGN_UPDATE_INTERVAL_SECONDS = 1 / 16;
const CHICAGO_TRAFFIC_UPDATE_INTERVAL_SECONDS = 1 / 30;
const MOBILE_CHICAGO_TRAFFIC_UPDATE_INTERVAL_SECONDS = 1 / 20;
const CHICAGO_PEDESTRIAN_UPDATE_INTERVAL_SECONDS = 1 / 24;
const MOBILE_CHICAGO_PEDESTRIAN_UPDATE_INTERVAL_SECONDS = 1 / 16;
const CHICAGO_SKYSCRAPER_X = -38;
const CHICAGO_SKYSCRAPER_Z = 186;
const CHICAGO_INTERSECTION_CLEARANCE = 30;
const CHICAGO_SIDEWALK_PROP_OFFSET = 20.4;
const CHICAGO_SIDEWALK_SEGMENT_GAP = 29;
const CHICAGO_SAFE_STREET_OFFSETS = [-207, -112, -38, 38, 112, 207];
const CHICAGO_LAMP_OFFSETS = [-202, -126, -34, 34, 126, 202] as const;
const CHICAGO_HYDRANT_OFFSETS = [-186, -62, 62, 186] as const;
const CHICAGO_SIDE_SIGNS = [-1, 1] as const;
const CHICAGO_CROSSWALK_BAR_OFFSETS = [-9, -5.4, -1.8, 1.8, 5.4, 9] as const;
const CHICAGO_PARKING_LINE_INDICES = [0, 1, 2, 3, 4, 5, 6, 7] as const;
const CHICAGO_CAR_WHEEL_SIDES = [-1, 1] as const;
const CHICAGO_BENCH_LEG_X = [-2.2, 2.2] as const;
const CHICAGO_BEAN_BOLLARD_X = [-18, -6, 6, 18] as const;

let cachedChicagoWindowTexture: THREE.Texture | null = null;
let cachedChicagoFacadeTextures: THREE.Texture[] | null = null;
let cachedChicagoSignTexture: THREE.Texture | null = null;
let cachedChicagoLedSignTexture: THREE.Texture | null = null;
let cachedChicagoStoreSignTextures: THREE.Texture[] | null = null;
let cachedChicagoAdTextures: THREE.Texture[] | null = null;
let cachedChicagoFacadeMaterials: THREE.MeshBasicMaterial[] | null = null;

const CHICAGO_UNIT_BOX_GEOMETRY = new THREE.BoxGeometry(1, 1, 1);
const CHICAGO_BUILDING_ROOF_MATERIAL = new THREE.MeshBasicMaterial({ color: "#475569" });

function isNearChicagoIntersectionBand(value: number, clearance = CHICAGO_INTERSECTION_CLEARANCE) {
  for (let index = 0; index < CHICAGO_ROAD_POSITIONS.length; index += 1) {
    const road = CHICAGO_ROAD_POSITIONS[index];
    if (Math.abs(value - road) < clearance) return true;
  }
  return false;
}

type ChicagoTrafficLightIntersection = { key: string; x: number; z: number };
type ChicagoLamp = { key: string; x: number; z: number; rotation: number };
type ChicagoStreetTree = { key: string; x: number; z: number; scale: number };

function makeChicagoTrafficLightIntersections(): ChicagoTrafficLightIntersection[] {
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

function makeChicagoLampLayout(): ChicagoLamp[] {
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

function makeChicagoStreetTreeLayout(): ChicagoStreetTree[] {
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

function makeChicagoSidewalkSegments() {
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

function getChicagoStreetFacingRotation(x: number, z: number, targetX: number, targetZ: number) {
  return Math.atan2(targetX - x, targetZ - z);
}

function getChicagoWindowTexture() {
  if (cachedChicagoWindowTexture) return cachedChicagoWindowTexture;

  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 192;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    cachedChicagoWindowTexture = configurePixelSpriteTexture(new THREE.CanvasTexture(canvas));
    return cachedChicagoWindowTexture;
  }

  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#7f8da0";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#5f6f82";
  for (let x = 0; x < canvas.width; x += 16) {
    ctx.fillRect(x, 0, 2, canvas.height);
  }
  for (let y = 0; y < canvas.height; y += 14) {
    ctx.fillStyle = y % 28 === 0 ? "#c3ccd8" : "#64758a";
    ctx.fillRect(0, y, canvas.width, 2);
  }
  for (let y = 7; y < canvas.height - 6; y += 14) {
    for (let x = 6; x < canvas.width - 9; x += 16) {
      const lit = ((x * 17 + y * 31) % 11) > 4;
      ctx.fillStyle = lit ? "#ffe9a6" : "#1f3b5a";
      ctx.fillRect(x, y, 9, 6);
      ctx.fillStyle = lit ? "#fff7c2" : "#355774";
      ctx.fillRect(x + 1, y + 1, 7, 1);
    }
  }
  ctx.fillStyle = "rgba(15,23,42,0.35)";
  for (let x = 0; x < canvas.width; x += 32) {
    ctx.fillRect(x, 0, 3, canvas.height);
  }
  ctx.fillStyle = "rgba(255,255,255,0.22)";
  for (let x = 12; x < canvas.width; x += 32) {
    ctx.fillRect(x, 0, 2, canvas.height);
  }

  cachedChicagoWindowTexture = configurePixelSpriteTexture(new THREE.CanvasTexture(canvas));
  cachedChicagoWindowTexture.wrapS = THREE.RepeatWrapping;
  cachedChicagoWindowTexture.wrapT = THREE.RepeatWrapping;
  cachedChicagoWindowTexture.repeat.set(1.35, 5.6);
  cachedChicagoWindowTexture.needsUpdate = true;
  return cachedChicagoWindowTexture;
}

function makeChicagoFacadeTexture(style: number) {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 192;
  const ctx = canvas.getContext("2d");
  if (!ctx) return configurePixelSpriteTexture(new THREE.CanvasTexture(canvas));

  ctx.imageSmoothingEnabled = false;
  const palettes = [
    { base: "#86a7bf", grid: "#36566f", window: "#164260", lit: "#ffe7a3", shine: "#dbeafe" },
    { base: "#9b6048", grid: "#70422f", window: "#1f2937", lit: "#fed7aa", shine: "#fef3c7" },
    { base: "#d9c49d", grid: "#b69b6f", window: "#31506a", lit: "#fff1b8", shine: "#f8fafc" },
    { base: "#55616f", grid: "#233142", window: "#0f2538", lit: "#bfdbfe", shine: "#e0f2fe" },
    { base: "#b68a68", grid: "#7a543a", window: "#263241", lit: "#fde68a", shine: "#fef9c3" },
    { base: "#7ca7a2", grid: "#315d63", window: "#12333b", lit: "#a7f3d0", shine: "#ecfeff" },
  ];
  const palette = palettes[style % palettes.length];

  ctx.fillStyle = palette.base;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (style === 1) {
    for (let y = 0; y < canvas.height; y += 36) {
      ctx.fillStyle = y % 72 === 0 ? "#ad7558" : palette.base;
      ctx.fillRect(0, y, canvas.width, 32);
      ctx.fillStyle = palette.grid;
      ctx.fillRect(0, y + 32, canvas.width, 4);
      for (let x = (y / 36) % 2 === 0 ? 0 : 36; x < canvas.width; x += 72) {
        ctx.fillRect(x, y, 4, 32);
      }
    }
  } else if (style === 2) {
    for (let x = 0; x < canvas.width; x += 54) {
      ctx.fillStyle = x % 108 === 0 ? "#ead8b6" : "#c7ad7f";
      ctx.fillRect(x, 0, 9, canvas.height);
    }
    for (let y = 0; y < canvas.height; y += 92) {
      ctx.fillStyle = "#bda174";
      ctx.fillRect(0, y, canvas.width, 7);
      ctx.fillStyle = "#f4e6c9";
      ctx.fillRect(0, y + 7, canvas.width, 3);
    }
  } else if (style === 3) {
    for (let y = 0; y < canvas.height; y += 32) {
      ctx.fillStyle = y % 64 === 0 ? "#6b7786" : "#3f4d5d";
      ctx.fillRect(0, y, canvas.width, 13);
    }
    for (let x = 0; x < canvas.width; x += 42) {
      ctx.fillStyle = "#182233";
      ctx.fillRect(x, 0, 4, canvas.height);
    }
  } else if (style === 4) {
    for (let y = 22; y < canvas.height; y += 62) {
      ctx.fillStyle = "#6f4a35";
      ctx.fillRect(0, y + 30, canvas.width, 5);
      for (let x = 14; x < canvas.width - 12; x += 52) {
        ctx.fillRect(x - 4, y + 17, 30, 5);
      }
    }
  } else {
    for (let x = 0; x < canvas.width; x += 48) {
      ctx.fillStyle = x % 96 === 0 ? palette.grid : "rgba(255,255,255,0.16)";
      ctx.fillRect(x, 0, x % 96 === 0 ? 5 : 3, canvas.height);
    }
    for (let y = 0; y < canvas.height; y += 56) {
      ctx.fillStyle = "rgba(15,23,42,0.34)";
      ctx.fillRect(0, y, canvas.width, 4);
    }
  }

  for (let y = 0; y < canvas.height; ) {
    const panelHeight = 42 + ((y * 7 + style * 13) % 4) * 18;
    for (let x = 0; x < canvas.width; ) {
      const panelWidth = 38 + ((x * 11 + y * 5 + style * 19) % 5) * 17;
      const isLargePanel = (x + y + style * 17) % 3 === 0;
      ctx.fillStyle = isLargePanel ? "rgba(255,255,255,0.075)" : "rgba(15,23,42,0.105)";
      ctx.fillRect(x + 1, y + 1, Math.min(panelWidth - 2, canvas.width - x - 1), Math.min(panelHeight - 2, canvas.height - y - 1));
      ctx.fillStyle = style === 1 ? "rgba(73,39,25,0.32)" : "rgba(15,23,42,0.22)";
      ctx.fillRect(x, y, Math.min(panelWidth, canvas.width - x), 2);
      ctx.fillRect(x, y, 2, Math.min(panelHeight, canvas.height - y));
      x += panelWidth;
    }
    y += panelHeight;
  }

  const windowWidth = style === 2 ? 14 : style === 4 ? 16 : 15;
  const windowHeight = style === 4 ? 13 : 11;
  const xStep = style === 2 ? 48 : style === 4 ? 58 : 46;
  const yStep = style === 3 ? 42 : style === 4 ? 62 : 48;

  for (let y = 8; y < canvas.height - 8; y += yStep) {
    for (let x = 7; x < canvas.width - 8; x += xStep) {
      const variant = (x * 7 + y * 11 + style * 23) % 13;
      if (variant === 6 && style !== 0) continue;
      const localWindowWidth = Math.min(
        windowWidth + (variant === 0 || variant === 7 ? 8 : variant === 3 ? 4 : 0),
        canvas.width - x - 4,
      );
      const localWindowHeight = Math.min(
        windowHeight + (variant === 1 || variant === 8 ? 5 : variant === 4 ? 3 : 0),
        canvas.height - y - 5,
      );
      const lit = ((x * 13 + y * 29 + style * 17) % 10) > (style === 3 ? 5 : 4);
      ctx.fillStyle = palette.window;
      ctx.fillRect(x - 1, y - 1, localWindowWidth + 2, localWindowHeight + 2);
      ctx.fillStyle = lit ? palette.lit : style === 5 ? "#1c5360" : "#24435a";
      ctx.fillRect(x, y, localWindowWidth, localWindowHeight);
      if (lit || style === 0 || style === 5) {
        ctx.fillStyle = palette.shine;
        ctx.fillRect(x + 1, y + 1, Math.max(2, localWindowWidth - 3), 1);
      }
      const paneColor = lit ? "rgba(64,44,16,0.42)" : "rgba(226,232,240,0.2)";
      ctx.fillStyle = paneColor;
      ctx.fillRect(x + Math.floor(localWindowWidth / 2), y, 1, localWindowHeight);
      if (localWindowHeight >= 10) {
        ctx.fillRect(x, y + Math.floor(localWindowHeight / 2), localWindowWidth, 1);
      }
      ctx.fillStyle = style === 1 ? "#5f3426" : style === 2 ? "#a88e62" : style === 4 ? "#5a3828" : palette.grid;
      ctx.fillRect(x - 3, y + localWindowHeight + 2, localWindowWidth + 6, 2);
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.fillRect(x - 2, y + localWindowHeight + 1, localWindowWidth + 4, 1);
      if (style === 4) {
        ctx.fillStyle = "#2f1f18";
        ctx.fillRect(x - 4, y + localWindowHeight + 5, localWindowWidth + 8, 2);
      }
    }
  }

  if (style === 0 || style === 5) {
    ctx.fillStyle = "rgba(255,255,255,0.26)";
    ctx.fillRect(18, 0, 3, canvas.height);
    ctx.fillRect(79, 0, 2, canvas.height);
  }

  const texture = configurePixelSpriteTexture(new THREE.CanvasTexture(canvas));
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(style === 4 ? 0.44 : style === 2 ? 0.5 : 0.56, style === 3 ? 1.95 : style === 4 ? 1.45 : 1.7);
  texture.needsUpdate = true;
  return texture;
}

function getChicagoFacadeTextures() {
  if (cachedChicagoFacadeTextures) return cachedChicagoFacadeTextures;
  cachedChicagoFacadeTextures = new Array<THREE.Texture>(CHICAGO_FACADE_STYLE_COUNT);
  for (let style = 0; style < CHICAGO_FACADE_STYLE_COUNT; style += 1) {
    cachedChicagoFacadeTextures[style] = makeChicagoFacadeTexture(style);
  }
  return cachedChicagoFacadeTextures;
}

function getChicagoFacadeMaterials() {
  if (cachedChicagoFacadeMaterials) return cachedChicagoFacadeMaterials;
  const facadeTextures = getChicagoFacadeTextures();
  cachedChicagoFacadeMaterials = new Array<THREE.MeshBasicMaterial>(facadeTextures.length);
  for (let index = 0; index < facadeTextures.length; index += 1) {
    cachedChicagoFacadeMaterials[index] = new THREE.MeshBasicMaterial({ map: facadeTextures[index], color: "#ffffff" });
  }
  return cachedChicagoFacadeMaterials;
}

function getChicagoSignTexture() {
  if (cachedChicagoSignTexture) return cachedChicagoSignTexture;

  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 72;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    cachedChicagoSignTexture = configurePixelSpriteTexture(new THREE.CanvasTexture(canvas));
    return cachedChicagoSignTexture;
  }

  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(0, 8, canvas.width, 56);
  ctx.fillStyle = "#e11d48";
  ctx.fillRect(8, 16, canvas.width - 16, 40);
  ctx.fillStyle = "#f8fafc";
  ctx.font = "bold 32px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("CHICAGO", canvas.width / 2, canvas.height / 2 + 1);
  ctx.fillStyle = "#67e8f9";
  const sparkleXs = [38, 218];
  for (let index = 0; index < sparkleXs.length; index += 1) {
    const x = sparkleXs[index];
    ctx.fillRect(x, 28, 4, 4);
    ctx.fillRect(x + 8, 28, 4, 4);
    ctx.fillRect(x + 4, 36, 4, 4);
    ctx.fillRect(x + 12, 36, 4, 4);
  }

  cachedChicagoSignTexture = configurePixelSpriteTexture(new THREE.CanvasTexture(canvas));
  return cachedChicagoSignTexture;
}

function getChicagoLedSignTexture() {
  if (cachedChicagoLedSignTexture) return cachedChicagoLedSignTexture;

  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 192;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    cachedChicagoLedSignTexture = configurePixelSpriteTexture(new THREE.CanvasTexture(canvas));
    return cachedChicagoLedSignTexture;
  }

  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#020617";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#111827";
  ctx.fillRect(0, 22, canvas.width, 148);
  ctx.fillStyle = "#ef4444";
  ctx.fillRect(0, 8, canvas.width, 10);
  ctx.fillRect(0, 174, canvas.width, 10);
  ctx.fillStyle = "#22d3ee";
  ctx.fillRect(0, 24, canvas.width, 5);
  ctx.fillRect(0, 164, canvas.width, 5);

  for (let y = 38; y < 154; y += 12) {
    for (let x = 8; x < canvas.width; x += 12) {
      const lit = (x + y * 3) % 5 !== 0;
      ctx.fillStyle = lit ? "rgba(34,211,238,0.34)" : "rgba(15,23,42,0.8)";
      ctx.fillRect(x, y, 4, 4);
    }
  }

  ctx.font = "bold 68px monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const message = "WELCOME TO CHIGAGO";
  for (let x = -12; x < canvas.width + 260; x += 330) {
    ctx.fillStyle = "#22d3ee";
    ctx.fillText(message, x + 4, 100);
    ctx.fillStyle = "#fef08a";
    ctx.fillText(message, x, 94);
    ctx.fillStyle = "#fb7185";
    ctx.fillRect(x - 20, 82, 12, 12);
    ctx.fillRect(x + 420, 82, 12, 12);
  }

  cachedChicagoLedSignTexture = configurePixelSpriteTexture(new THREE.CanvasTexture(canvas));
  cachedChicagoLedSignTexture.wrapS = THREE.RepeatWrapping;
  cachedChicagoLedSignTexture.wrapT = THREE.ClampToEdgeWrapping;
  cachedChicagoLedSignTexture.repeat.set(1, 1);
  cachedChicagoLedSignTexture.needsUpdate = true;
  return cachedChicagoLedSignTexture;
}

function makeChicagoTextTexture(
  label: string,
  background: string,
  foreground: string,
  accent = "#facc15",
  width = 256,
  height = 96,
) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return configurePixelSpriteTexture(new THREE.CanvasTexture(canvas));

  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#020617";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = background;
  ctx.fillRect(5, 5, width - 10, height - 10);
  ctx.fillStyle = accent;
  ctx.fillRect(11, 11, width - 22, 6);
  ctx.fillRect(11, height - 17, width - 22, 6);
  ctx.fillStyle = foreground;
  const lines = label.split("\n");
  ctx.font = `bold ${Math.floor(height * (lines.length > 1 ? 0.24 : 0.34))}px monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const lineHeight = height * 0.26;
    ctx.fillText(line, width / 2, height / 2 + 2 + (index - (lines.length - 1) / 2) * lineHeight);
  }

  return configurePixelSpriteTexture(new THREE.CanvasTexture(canvas));
}

function getChicagoStoreSignTextures() {
  if (cachedChicagoStoreSignTextures) return cachedChicagoStoreSignTextures;

  cachedChicagoStoreSignTextures = [
    makeChicagoTextTexture("PIZZA", "#b91c1c", "#fff7ed", "#fed7aa"),
    makeChicagoTextTexture("CTA", "#1d4ed8", "#f8fafc", "#ef4444"),
    makeChicagoTextTexture("JAZZ", "#312e81", "#fde68a", "#f472b6"),
    makeChicagoTextTexture("HOTEL", "#0f766e", "#f0fdfa", "#99f6e4"),
    makeChicagoTextTexture("LOOP", "#374151", "#f8fafc", "#60a5fa"),
    makeChicagoTextTexture("MART", "#166534", "#ecfccb", "#bef264"),
  ];

  return cachedChicagoStoreSignTextures;
}

function getChicagoAdTextures() {
  if (cachedChicagoAdTextures) return cachedChicagoAdTextures;

  cachedChicagoAdTextures = [
    makeChicagoTextTexture("SPELL\nCOLA", "#0f172a", "#67e8f9", "#f472b6", 192, 256),
    makeChicagoTextTexture("MANA\nMAX", "#312e81", "#fef3c7", "#a78bfa", 192, 256),
    makeChicagoTextTexture("WIZ\nNEWS", "#7f1d1d", "#f8fafc", "#fb7185", 192, 256),
    makeChicagoTextTexture("LAKE\nTOURS", "#075985", "#ecfeff", "#38bdf8", 192, 256),
  ];

  return cachedChicagoAdTextures;
}

function makeChicagoCharacter(chunk: SurvivalChunkInfo, index: number): CharacterCustomization {
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

function makeChicagoLayout(chunk: SurvivalChunkInfo): ChicagoLayout {
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

function ChicagoCitySurface({
  geometry,
  baseHeight,
}: {
  geometry: THREE.BufferGeometry;
  baseHeight: number;
}) {
  const roadPositions = CHICAGO_ROAD_POSITIONS;

  return (
    <group>
      <mesh geometry={geometry} receiveShadow dispose={null}>
        <meshBasicMaterial color="#52664f" vertexColors />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, baseHeight + 0.075, 0]} receiveShadow>
        <planeGeometry args={[CHICAGO_CITY_HALF_SIZE * 2, CHICAGO_CITY_HALF_SIZE * 2]} />
        <meshBasicMaterial color="#4b5563" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[221, baseHeight + 0.16, 0]} renderOrder={1}>
        <planeGeometry args={[84, SURVIVAL_BLOCK_SIZE]} />
        <meshBasicMaterial color="#2563eb" transparent opacity={0.74} depthWrite={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[178, baseHeight + 0.23, 0]} renderOrder={2}>
        <planeGeometry args={[10, SURVIVAL_BLOCK_SIZE]} />
        <meshBasicMaterial color="#9ca3af" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[18, baseHeight + 0.24, 0]} renderOrder={3}>
        <planeGeometry args={[372, 24]} />
        <meshBasicMaterial color="#0f5d87" transparent opacity={0.92} />
      </mesh>
      {roadPositions.map((x) => (
        <group key={`chicago-vertical-road-${x}`}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[x, baseHeight + 0.28, 0]} renderOrder={4}>
            <planeGeometry args={[42, CHICAGO_CITY_HALF_SIZE * 2]} />
            <meshBasicMaterial color="#9ca3af" />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[x, baseHeight + 0.31, 0]} renderOrder={5}>
            <planeGeometry args={[28, CHICAGO_CITY_HALF_SIZE * 2]} />
            <meshBasicMaterial color="#1f2937" />
          </mesh>
        </group>
      ))}
      {roadPositions.map((z) => (
        <group key={`chicago-horizontal-road-${z}`}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, baseHeight + 0.29, z]} renderOrder={4}>
            <planeGeometry args={[CHICAGO_CITY_HALF_SIZE * 2, 42]} />
            <meshBasicMaterial color="#9ca3af" />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, baseHeight + 0.32, z]} renderOrder={5}>
            <planeGeometry args={[CHICAGO_CITY_HALF_SIZE * 2, 28]} />
            <meshBasicMaterial color="#1f2937" />
          </mesh>
          {getCachedIndexRange(9).map((index) => (
            <mesh key={`lane-dash-${z}-${index}`} rotation={[-Math.PI / 2, 0, 0]} position={[-198 + index * 48, baseHeight + 0.36, z]} renderOrder={6}>
              <planeGeometry args={[17, 1.4]} />
              <meshBasicMaterial color="#f8fafc" transparent opacity={0.72} />
            </mesh>
          ))}
        </group>
      ))}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[CHICAGO_BEAN_PARK_X, baseHeight + 0.42, CHICAGO_BEAN_PARK_Z]} renderOrder={7}>
        <circleGeometry args={[39, 52]} />
        <meshBasicMaterial color="#3f7c3b" side={THREE.DoubleSide} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[CHICAGO_BEAN_PARK_X, baseHeight + 0.455, CHICAGO_BEAN_PARK_Z]} renderOrder={8}>
        <ringGeometry args={[23, 34, 52]} />
        <meshBasicMaterial color="#cbd5e1" side={THREE.DoubleSide} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[CHICAGO_BEAN_PARK_X, baseHeight + 0.47, CHICAGO_BEAN_PARK_Z + 33]} renderOrder={9}>
        <planeGeometry args={[9, 18]} />
        <meshBasicMaterial color="#d8dee6" />
      </mesh>
    </group>
  );
}

function ChicagoRevolvingLedSign({
  width,
  depth,
  y,
}: {
  width: number;
  depth: number;
  y: number;
}) {
  const signRef = useRef<THREE.Group>(null);
  const lastSignUpdateRef = useRef(-1);
  const mobilePerformanceMode = useMemo(() => isMobilePerformanceMode(), []);
  const signTexture = useMemo(() => getChicagoLedSignTexture(), []);
  const radius = Math.max(width, depth) * 0.86;
  const signHeight = 22.5;

  useFrame(({ clock }) => {
    const elapsed = clock.getElapsedTime();
    const updateInterval = mobilePerformanceMode
      ? MOBILE_CHICAGO_LED_SIGN_UPDATE_INTERVAL_SECONDS
      : CHICAGO_LED_SIGN_UPDATE_INTERVAL_SECONDS;
    if (elapsed - lastSignUpdateRef.current < updateInterval) return;
    lastSignUpdateRef.current = elapsed;
    if (signRef.current) signRef.current.rotation.y = elapsed * 0.55;
    signTexture.offset.x = -elapsed * 0.12;
  });

  return (
    <group ref={signRef} position={[0, y, 0]} frustumCulled={false}>
      <mesh castShadow={false}>
        <cylinderGeometry args={[radius + 1.15, radius + 1.15, signHeight + 3.1, 48, 1, true]} />
        <meshBasicMaterial color="#020617" transparent opacity={0.9} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh castShadow={false}>
        <cylinderGeometry args={[radius, radius, signHeight, 64, 1, true]} />
        <meshBasicMaterial
          map={signTexture}
          color="#ffffff"
          transparent
          opacity={0.98}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

function ChicagoBuildings({
  buildings,
  baseHeight,
  showDetails,
}: {
  buildings: ChicagoBuilding[];
  baseHeight: number;
  showDetails: boolean;
}) {
  const bodyRefs = useLazyRef<Array<THREE.InstancedMesh | null>>(() => []);
  const roofRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const facadeTextures = useMemo(() => getChicagoFacadeTextures(), []);
  const bodyMaterials = useMemo(() => getChicagoFacadeMaterials(), []);
  const buildingGroups = useMemo(() => {
    const groups = new Array<ChicagoBuildingGroup>(facadeTextures.length);
    for (let style = 0; style < facadeTextures.length; style += 1) {
      groups[style] = [];
    }
    for (let index = 0; index < buildings.length; index += 1) {
      const building = buildings[index];
      const style = building.facadeStyle;
      if (style < 0 || style >= groups.length) continue;
      groups[style].push(building);
    }
    return groups;
  }, [buildings, facadeTextures]);

  useEffect(() => {
    const roofMesh = roofRef.current;
    if (!roofMesh) return;

    for (let styleIndex = 0; styleIndex < buildingGroups.length; styleIndex += 1) {
      const group = buildingGroups[styleIndex];
      const bodyMesh = bodyRefs.current[styleIndex];
      if (!bodyMesh) continue;

      bodyMesh.count = group.length;
      for (let index = 0; index < group.length; index += 1) {
        const building = group[index];
        dummy.position.set(building.localX, baseHeight + building.height / 2, building.localZ);
        dummy.rotation.set(0, building.rotation, 0);
        dummy.scale.set(building.width, building.height, building.depth);
        dummy.updateMatrix();
        bodyMesh.setMatrixAt(index, dummy.matrix);
      }

      bodyMesh.instanceMatrix.needsUpdate = true;
      finalizeSurvivalInstancedMesh(bodyMesh, 0, 0, CHICAGO_CITY_HALF_SIZE + 80, baseHeight + 92);
    }

    for (let index = 0; index < buildings.length; index += 1) {
      const building = buildings[index];
      dummy.position.set(building.localX, baseHeight + building.height + 1.3, building.localZ);
      dummy.rotation.set(0, building.rotation, 0);
      dummy.scale.set(building.width + 3.4, 2.6, building.depth + 3.4);
      dummy.updateMatrix();
      roofMesh.setMatrixAt(index, dummy.matrix);
    }

    roofMesh.count = buildings.length;
    finalizeSurvivalInstancedMesh(roofMesh, 0, 0, CHICAGO_CITY_HALF_SIZE + 80, baseHeight + 112);
  }, [baseHeight, buildingGroups, buildings, dummy]);

  const landmarks = useMemo(() => {
    if (!showDetails) return [] as ChicagoBuilding[];
    const items: ChicagoBuilding[] = [];
    for (let index = 0; index < buildings.length; index += 1) {
      const building = buildings[index];
      if (building.landmark) items.push(building);
    }
    return items;
  }, [buildings, showDetails]);

  return (
    <group>
      {buildingGroups.map((group, styleIndex) => (
        <instancedMesh
          key={`chicago-facade-style-${styleIndex}`}
          ref={(mesh) => {
            bodyRefs.current[styleIndex] = mesh;
          }}
          args={[CHICAGO_UNIT_BOX_GEOMETRY, bodyMaterials[styleIndex], Math.max(1, group.length)]}
          castShadow={false}
          receiveShadow
        />
      ))}
      <instancedMesh ref={roofRef} args={[CHICAGO_UNIT_BOX_GEOMETRY, CHICAGO_BUILDING_ROOF_MATERIAL, buildings.length]} castShadow={false} receiveShadow={false} />
      {landmarks.map((building) => (
        <group key={`${building.key}-landmark-details`} position={[building.localX, baseHeight, building.localZ]} rotation={[0, building.rotation, 0]}>
          {building.landmark === "willis" && (
            <>
              <mesh position={[-7.2, building.height + 18, -3]} castShadow={false}>
                <cylinderGeometry args={[0.55, 0.75, 34, 5]} />
                <meshBasicMaterial color="#475569" />
              </mesh>
              <mesh position={[7.2, building.height + 18, 3]} castShadow={false}>
                <cylinderGeometry args={[0.55, 0.75, 34, 5]} />
                <meshBasicMaterial color="#475569" />
              </mesh>
              <mesh position={[0, building.height + 4.6, 0]} castShadow={false}>
                <boxGeometry args={[building.width * 0.52, 4.4, building.depth * 0.52]} />
                <meshBasicMaterial color="#334155" />
              </mesh>
            </>
          )}
          {building.landmark === "hancock" && (
            <>
              {CHICAGO_SIDE_SIGNS.map((side) => (
                <mesh key={`x-brace-${side}`} position={[0, building.height * 0.56, side * (building.depth / 2 + 0.14)]} rotation={[0, 0, side * 0.74]} castShadow={false}>
                  <boxGeometry args={[building.width * 1.18, 1.25, 0.42]} />
                  <meshBasicMaterial color="#334155" />
                </mesh>
              ))}
              <mesh position={[0, building.height + 10, 0]} castShadow={false}>
                <cylinderGeometry args={[0.45, 0.65, 20, 5]} />
                <meshBasicMaterial color="#475569" />
              </mesh>
            </>
          )}
          {building.landmark === "watertower" && (
            <mesh position={[0, building.height + 6.2, 0]} castShadow={false}>
              <coneGeometry args={[9, 12, 4]} />
              <meshBasicMaterial color="#e5e7eb" />
            </mesh>
          )}
          {building.landmark === "skyscraper" && (
            <>
              <ChicagoRevolvingLedSign width={building.width} depth={building.depth} y={92} />
              <mesh position={[0, building.height + 7.4, 0]} castShadow={false}>
                <boxGeometry args={[building.width * 0.58, 12.2, building.depth * 0.58]} />
                <meshBasicMaterial color="#dbeafe" transparent opacity={0.88} />
              </mesh>
              <mesh position={[0, building.height + 21.5, 0]} castShadow={false}>
                <coneGeometry args={[building.width * 0.24, 20, 4]} />
                <meshBasicMaterial color="#cbd5e1" />
              </mesh>
              <mesh position={[0, building.height + 44, 0]} castShadow={false}>
                <cylinderGeometry args={[0.72, 1.1, 38, 6]} />
                <meshBasicMaterial color="#e5e7eb" />
              </mesh>
              {CHICAGO_SIDE_SIGNS.map((side) => (
                <Fragment key={`skyscraper-light-bars-${side}`}>
                  <mesh position={[side * (building.width / 2 + 0.24), building.height * 0.52, 0]} castShadow={false}>
                    <boxGeometry args={[0.42, building.height * 0.84, 1.2]} />
                    <meshBasicMaterial color="#bae6fd" transparent opacity={0.64} />
                  </mesh>
                  <mesh position={[0, building.height * 0.52, side * (building.depth / 2 + 0.24)]} castShadow={false}>
                    <boxGeometry args={[1.2, building.height * 0.84, 0.42]} />
                    <meshBasicMaterial color="#bae6fd" transparent opacity={0.64} />
                  </mesh>
                </Fragment>
              ))}
            </>
          )}
        </group>
      ))}
    </group>
  );
}

function ChicagoBuildingDetails({
  buildings,
  baseHeight,
  showDetails,
}: {
  buildings: ChicagoBuilding[];
  baseHeight: number;
  showDetails: boolean;
}) {
  const storeSigns = useMemo(() => getChicagoStoreSignTextures(), []);
  const adTextures = useMemo(() => getChicagoAdTextures(), []);
  if (!showDetails) return null;

  return (
    <group name="chicago-building-details">
      {buildings.map((building, index) => {
        const signTexture = storeSigns[index % storeSigns.length];
        const adTexture = adTextures[index % adTextures.length];
        const storefrontWidth = Math.min(building.width - 4, 26);
        const hasAdPanel = building.height > 72 && index % 3 === 0;

        return (
          <group
            key={`${building.key}-city-detail`}
            position={[building.localX, baseHeight, building.localZ]}
            rotation={[0, building.rotation, 0]}
          >
            <mesh position={[0, 3.55, building.depth / 2 + 0.24]} castShadow={false}>
              <boxGeometry args={[building.enterable ? 8.4 : 6.2, building.enterable ? 8.4 : 7.1, 0.5]} />
              <meshBasicMaterial color={building.enterable ? "#020617" : "#101827"} />
            </mesh>
            <mesh position={[0, 3.8, building.depth / 2 + 0.54]} castShadow={false}>
              <boxGeometry args={[building.enterable ? 5.9 : 4.35, building.enterable ? 6.5 : 5.6, 0.34]} />
              <meshBasicMaterial color={building.enterable ? "#0f172a" : "#7dd3fc"} transparent opacity={building.enterable ? 0.86 : 0.72} />
            </mesh>
            {building.enterable && (
              <mesh position={[0, 7.65, building.depth / 2 + 0.72]} castShadow={false}>
                <boxGeometry args={[5.8, 0.54, 0.4]} />
                <meshBasicMaterial color="#22c55e" transparent opacity={0.88} />
              </mesh>
            )}
            <mesh position={[0, 8.35, building.depth / 2 + 0.52]} castShadow={false}>
              <boxGeometry args={[storefrontWidth, 1.15, 0.48]} />
              <meshBasicMaterial color="#111827" />
            </mesh>
            <mesh position={[0, 10.15, building.depth / 2 + 0.62]} castShadow={false}>
              <planeGeometry args={[Math.min(building.width * 0.72, 24), 5.2]} />
              <meshBasicMaterial map={signTexture} transparent alphaTest={0.04} side={THREE.DoubleSide} />
            </mesh>
            {CHICAGO_SIDE_SIGNS.map((side) => (
              <mesh key={`${building.key}-store-window-${side}`} position={[side * storefrontWidth * 0.28, 4.4, building.depth / 2 + 0.42]} castShadow={false}>
                <boxGeometry args={[4.1, 4.7, 0.38]} />
                <meshBasicMaterial color="#bae6fd" transparent opacity={0.62} />
              </mesh>
            ))}
            {hasAdPanel && (
              <>
                <mesh position={[0, building.height * 0.55, building.depth / 2 + 0.72]} castShadow={false}>
                  <planeGeometry args={[Math.min(building.width * 0.68, 22), 31]} />
                  <meshBasicMaterial map={adTexture} transparent alphaTest={0.04} side={THREE.DoubleSide} />
                </mesh>
                <mesh position={[0, building.height * 0.55, building.depth / 2 + 0.56]} castShadow={false}>
                  <boxGeometry args={[Math.min(building.width * 0.72, 23.4), 32.4, 0.26]} />
                  <meshBasicMaterial color="#020617" transparent opacity={0.72} />
                </mesh>
              </>
            )}
          </group>
        );
      })}
    </group>
  );
}

function ChicagoInteriorVillager({ character }: { character: CharacterCustomization }) {
  return (
    <group
      name="chicago-interior-villager"
      position={[0, 0.95 + NPC_AVATAR_GROUND_LIFT, 0]}
      scale={[NPC_AVATAR_SCALE, NPC_AVATAR_SCALE, NPC_AVATAR_SCALE]}
    >
      <AvatarBillboard character={character} animation="idle" yaw={Math.PI} health={100} staticFrame fixedDirection={0} />
    </group>
  );
}

function ChicagoBuildingInteriors({
  buildings,
  baseHeight,
  showDetails,
}: {
  buildings: ChicagoBuilding[];
  baseHeight: number;
  showDetails: boolean;
}) {
  if (!showDetails) return null;
  const enterableBuildings: ChicagoBuilding[] = [];
  for (let index = 0; index < buildings.length; index += 1) {
    const building = buildings[index];
    if (building.enterable) enterableBuildings.push(building);
  }

  return (
    <group name="chicago-building-interiors">
      {enterableBuildings.map((building, index) => {
        const roomWidth = Math.max(10, Math.min(building.width - 4.8, 20));
        const roomDepth = Math.max(10, Math.min(building.depth - 5.2, 18));
        const frontZ = building.depth / 2;
        const roomCenterZ = frontZ - roomDepth / 2 - 2.2;

        return (
          <group
            key={`${building.key}-interior`}
            position={[building.localX, baseHeight + 0.5, building.localZ]}
            rotation={[0, building.rotation, 0]}
          >
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, roomCenterZ]} renderOrder={11}>
              <planeGeometry args={[roomWidth, roomDepth]} />
              <meshBasicMaterial color={index % 2 === 0 ? "#4b5563" : "#3f3f46"} side={THREE.DoubleSide} />
            </mesh>
            <mesh position={[0, 2.4, frontZ - roomDepth - 2.2]} castShadow={false}>
              <boxGeometry args={[roomWidth, 4.8, 0.5]} />
              <meshBasicMaterial color="#1f2937" transparent opacity={0.72} />
            </mesh>
            <mesh position={[0, 1.6, frontZ - roomDepth * 0.72]} castShadow={false}>
              <boxGeometry args={[Math.min(roomWidth - 2, 13), 2.1, 2.1]} />
              <meshBasicMaterial color="#7c4a2d" />
            </mesh>
            <mesh position={[0, 2.82, frontZ - roomDepth * 0.72 - 1.1]} castShadow={false}>
              <boxGeometry args={[Math.min(roomWidth - 2, 13.4), 0.42, 2.5]} />
              <meshBasicMaterial color="#a16207" />
            </mesh>
            {CHICAGO_SIDE_SIGNS.map((side) => (
              <mesh key={`${building.key}-interior-shelf-${side}`} position={[side * (roomWidth / 2 - 1.3), 2.2, roomCenterZ - 0.8]} castShadow={false}>
                <boxGeometry args={[1.1, 3.8, roomDepth * 0.52]} />
              <meshBasicMaterial color="#5b3a25" />
            </mesh>
            ))}
            <group position={[0, 0, frontZ - roomDepth * 0.82]}>
              <ChicagoInteriorVillager character={building.operatorCharacter} />
            </group>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, frontZ + 1.9]} renderOrder={12}>
              <planeGeometry args={[8.8, 3.2]} />
              <meshBasicMaterial color="#111827" transparent opacity={0.9} side={THREE.DoubleSide} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function ChicagoTrafficLights({ baseHeight }: { baseHeight: number }) {
  const intersections = useMemo(() => makeChicagoTrafficLightIntersections(), []);

  return (
    <group name="chicago-traffic-lights">
      {intersections.map((intersection, index) => (
        <group key={`traffic-light-${intersection.key}`}>
          {[
            [-18, -18, 0],
            [18, 18, Math.PI],
          ].map(([offsetX, offsetZ, yaw], poleIndex) => (
            <group
              key={`traffic-light-pole-${poleIndex}`}
              position={[intersection.x + offsetX, baseHeight + 0.36, intersection.z + offsetZ]}
              rotation={[0, yaw, 0]}
            >
              <mesh position={[0, 4.1, 0]} castShadow={false}>
                <cylinderGeometry args={[0.28, 0.34, 8.2, 6]} />
                <meshBasicMaterial color="#1f2937" />
              </mesh>
              <mesh position={[4.0, 8.1, 0]} rotation={[0, 0, Math.PI / 2]} castShadow={false}>
                <cylinderGeometry args={[0.18, 0.18, 8.1, 6]} />
                <meshBasicMaterial color="#1f2937" />
              </mesh>
              <mesh position={[8.3, 7.55, 0]} castShadow={false}>
                <boxGeometry args={[1.45, 3.4, 1.0]} />
                <meshBasicMaterial color="#111827" />
              </mesh>
              {[
                ["#ef4444", 8.42],
                ["#facc15", 7.55],
                ["#22c55e", 6.68],
              ].map(([color, y], lightIndex) => (
                <mesh key={`signal-light-${lightIndex}`} position={[8.32, Number(y), 0.55]} castShadow={false}>
                  <sphereGeometry args={[0.33, 8, 6]} />
                  <meshBasicMaterial
                    color={color}
                    transparent
                    opacity={(index + poleIndex + lightIndex) % 3 === 0 ? 1 : 0.42}
                  />
                </mesh>
              ))}
            </group>
          ))}
        </group>
      ))}
    </group>
  );
}

function ChicagoStreetDetails({ baseHeight }: { baseHeight: number }) {
  const sidewalkSegments = useMemo(() => makeChicagoSidewalkSegments(), []);
  const flatPlaneDummy = useMemo(() => new THREE.Object3D(), []);
  const sidewalkRef = useRef<THREE.InstancedMesh>(null);
  const parkingRef = useRef<THREE.InstancedMesh>(null);
  const grassRefs = useLazyRef<Array<THREE.InstancedMesh | null>>(() => []);
  const crosswalkRefs = useLazyRef<Array<THREE.InstancedMesh | null>>(() => []);

  const hydrants = useMemo(() => {
    const items: Array<{ key: string; x: number; z: number }> = [];
    for (let roadIndex = 0; roadIndex < CHICAGO_ROAD_POSITIONS.length; roadIndex += 1) {
      const road = CHICAGO_ROAD_POSITIONS[roadIndex];
      for (let index = 0; index < CHICAGO_HYDRANT_OFFSETS.length && items.length < 16; index += 1) {
        const offset = CHICAGO_HYDRANT_OFFSETS[index];
        const side = index % 2 === 0 ? -1 : 1;
        items.push({ key: `hydrant-v-${road}-${offset}`, x: road + side * 17.2, z: offset + roadIndex * 2 });
      }
      if (items.length >= 16) break;
    }
    return items;
  }, []);

  const lamps = useMemo(() => makeChicagoLampLayout(), []);

  const trashCans = useMemo(() => {
    const items: Array<{ key: string; x: number; z: number }> = [];
    for (let roadIndex = 0; roadIndex < CHICAGO_ROAD_POSITIONS.length; roadIndex += 1) {
      const road = CHICAGO_ROAD_POSITIONS[roadIndex];
      for (let index = 0; index < CHICAGO_SAFE_STREET_OFFSETS.length && items.length < 52; index += 1) {
        const offset = CHICAGO_SAFE_STREET_OFFSETS[index];
        if (isNearChicagoIntersectionBand(offset)) continue;
        const side = index % 2 === 0 ? -1 : 1;
        items.push({
          key: `trash-v-${road}-${offset}`,
          x: road + side * CHICAGO_SIDEWALK_PROP_OFFSET,
          z: offset + (roadIndex % 2 === 0 ? 2.4 : -2.4),
        });
        if (index % 2 === 0) {
          items.push({
            key: `trash-h-${road}-${offset}`,
            x: offset,
            z: road - side * CHICAGO_SIDEWALK_PROP_OFFSET,
          });
        }
      }
      if (items.length >= 52) break;
    }
    return items;
  }, []);

  const benches = useMemo(() => {
    const items: Array<{ key: string; x: number; z: number; rotation: number }> = [];
    for (let roadIndex = 0; roadIndex < CHICAGO_ROAD_POSITIONS.length; roadIndex += 1) {
      const road = CHICAGO_ROAD_POSITIONS[roadIndex];
      for (let index = 0; index < CHICAGO_SAFE_STREET_OFFSETS.length && items.length < 34; index += 1) {
        const offset = CHICAGO_SAFE_STREET_OFFSETS[index];
        if (isNearChicagoIntersectionBand(offset)) continue;
        const side = index % 2 === 0 ? -1 : 1;
        const verticalX = road + side * CHICAGO_SIDEWALK_PROP_OFFSET;
        items.push({
          key: `bench-v-${road}-${offset}`,
          x: verticalX,
          z: offset,
          rotation: getChicagoStreetFacingRotation(verticalX, offset, road, offset),
        });
        if (items.length >= 34) break;
        if ((index + roadIndex) % 2 === 0) {
          const horizontalZ = road + side * CHICAGO_SIDEWALK_PROP_OFFSET;
          items.push({
            key: `bench-h-${road}-${offset}`,
            x: offset,
            z: horizontalZ,
            rotation: getChicagoStreetFacingRotation(offset, horizontalZ, offset, road),
          });
        }
      }
      if (items.length >= 34) break;
    }
    return items;
  }, []);

  const streetTrees = useMemo(() => makeChicagoStreetTreeLayout(), []);

  const grassPatches = useMemo(() => {
    const items: ChicagoGrassPatch[] = [];
    for (let roadIndex = 0; roadIndex < CHICAGO_ROAD_POSITIONS.length; roadIndex += 1) {
      const road = CHICAGO_ROAD_POSITIONS[roadIndex];
      for (let index = 0; index < CHICAGO_SAFE_STREET_OFFSETS.length && items.length < 72; index += 1) {
        const offset = CHICAGO_SAFE_STREET_OFFSETS[index];
        if (isNearChicagoIntersectionBand(offset)) continue;
        const side = index % 2 === 0 ? -1 : 1;
        items.push({
          key: `grass-v-${road}-${offset}`,
          x: road + side * (CHICAGO_SIDEWALK_PROP_OFFSET + 0.2),
          z: offset,
          width: 5.2 + ((index + roadIndex) % 3) * 1.4,
          depth: 8.5 + ((index + roadIndex) % 4) * 2.2,
          color: (index + roadIndex) % 2 === 0 ? "#3f8f3f" : "#2f7d32",
        });
        if (index % 3 !== 0) {
          items.push({
            key: `grass-h-${road}-${offset}`,
            x: offset,
            z: road - side * (CHICAGO_SIDEWALK_PROP_OFFSET + 0.2),
            width: 8.5 + ((index + roadIndex) % 4) * 2.2,
            depth: 5.2 + ((index + roadIndex) % 3) * 1.4,
            color: (index + roadIndex) % 2 === 0 ? "#347d36" : "#4d9a42",
          });
        }
      }
      if (items.length >= 72) break;
    }
    return items;
  }, []);

  const crosswalks = useMemo(() => {
    const items: ChicagoCrosswalkStripe[] = [];
    const approachOffset = 18.8;
    const roadSpan = 24.6;
    const crosswalkLength = 6.4;
    const halfCrosswalk = crosswalkLength / 2;
    const barWidth = 1.05;
    for (let xIndex = 0; xIndex < CHICAGO_ROAD_POSITIONS.length; xIndex += 1) {
      const x = CHICAGO_ROAD_POSITIONS[xIndex];
      for (let zIndex = 0; zIndex < CHICAGO_ROAD_POSITIONS.length; zIndex += 1) {
        const z = CHICAGO_ROAD_POSITIONS[zIndex];
        for (let directionIndex = 0; directionIndex < CHICAGO_SIDE_SIGNS.length; directionIndex += 1) {
          const direction = CHICAGO_SIDE_SIGNS[directionIndex];
          const verticalCenterZ = z + direction * approachOffset;
          const horizontalCenterX = x + direction * approachOffset;

          items.push(
            { key: `cross-v-edge-a-${x}-${z}-${direction}`, x, z: verticalCenterZ - halfCrosswalk, width: roadSpan, depth: 0.46, opacity: 0.76 },
            { key: `cross-v-edge-b-${x}-${z}-${direction}`, x, z: verticalCenterZ + halfCrosswalk, width: roadSpan, depth: 0.46, opacity: 0.76 },
            { key: `cross-v-stop-${x}-${z}-${direction}`, x, z: verticalCenterZ + direction * (halfCrosswalk + 2.1), width: roadSpan + 1.0, depth: 0.48, opacity: 0.66 },
            { key: `cross-h-edge-a-${x}-${z}-${direction}`, x: horizontalCenterX - halfCrosswalk, z, width: 0.46, depth: roadSpan, opacity: 0.76 },
            { key: `cross-h-edge-b-${x}-${z}-${direction}`, x: horizontalCenterX + halfCrosswalk, z, width: 0.46, depth: roadSpan, opacity: 0.76 },
            { key: `cross-h-stop-${x}-${z}-${direction}`, x: horizontalCenterX + direction * (halfCrosswalk + 2.1), z, width: 0.48, depth: roadSpan + 1.0, opacity: 0.66 },
          );

          for (let stripeIndex = 0; stripeIndex < CHICAGO_CROSSWALK_BAR_OFFSETS.length; stripeIndex += 1) {
            const offset = CHICAGO_CROSSWALK_BAR_OFFSETS[stripeIndex];
            items.push({
              key: `cross-v-continental-${x}-${z}-${direction}-${stripeIndex}`,
              x: x + offset,
              z: verticalCenterZ,
              width: barWidth,
              depth: crosswalkLength,
              opacity: 0.82,
            });
            items.push({
              key: `cross-h-continental-${x}-${z}-${direction}-${stripeIndex}`,
              x: horizontalCenterX,
              z: z + offset,
              width: crosswalkLength,
              depth: barWidth,
              opacity: 0.82,
            });
          }
        }
      }
    }
    return items;
  }, []);

  const sidewalkPlanes = useMemo(() => {
    const items: ChicagoFlatPlanePatch[] = [];
    for (let roadIndex = 0; roadIndex < CHICAGO_ROAD_POSITIONS.length; roadIndex += 1) {
      const x = CHICAGO_ROAD_POSITIONS[roadIndex];
      for (let sideIndex = 0; sideIndex < CHICAGO_SIDE_SIGNS.length; sideIndex += 1) {
        const side = CHICAGO_SIDE_SIGNS[sideIndex] * 18;
        for (let segmentIndex = 0; segmentIndex < sidewalkSegments.length; segmentIndex += 1) {
          const segment = sidewalkSegments[segmentIndex];
          items.push({ x: x + side, z: segment.center, width: 6.5, depth: segment.length });
        }
      }
    }
    for (let roadIndex = 0; roadIndex < CHICAGO_ROAD_POSITIONS.length; roadIndex += 1) {
      const z = CHICAGO_ROAD_POSITIONS[roadIndex];
      for (let sideIndex = 0; sideIndex < CHICAGO_SIDE_SIGNS.length; sideIndex += 1) {
        const side = CHICAGO_SIDE_SIGNS[sideIndex] * 18;
        for (let segmentIndex = 0; segmentIndex < sidewalkSegments.length; segmentIndex += 1) {
          const segment = sidewalkSegments[segmentIndex];
          items.push({ x: segment.center, z: z + side, width: segment.length, depth: 6.5 });
        }
      }
    }
    return items;
  }, [sidewalkSegments]);

  const parkingLines = useMemo(() => {
    const items: ChicagoFlatPlanePatch[] = [];
    for (let roadIndex = 0; roadIndex < CHICAGO_ROAD_POSITIONS.length; roadIndex += 1) {
      const x = CHICAGO_ROAD_POSITIONS[roadIndex];
      for (let index = 0; index < CHICAGO_PARKING_LINE_INDICES.length; index += 1) {
        items.push({ x: x - 12.6, z: -198 + index * 56, width: 1.1, depth: 21 });
      }
    }
    for (let roadIndex = 0; roadIndex < CHICAGO_ROAD_POSITIONS.length; roadIndex += 1) {
      const z = CHICAGO_ROAD_POSITIONS[roadIndex];
      for (let index = 0; index < CHICAGO_PARKING_LINE_INDICES.length; index += 1) {
        items.push({ x: -198 + index * 56, z: z + 12.6, width: 21, depth: 1.1 });
      }
    }
    return items;
  }, []);

  const grassGroups = useMemo(() => {
    const groups: ChicagoGrassGroup[] = [];
    for (let patchIndex = 0; patchIndex < grassPatches.length; patchIndex += 1) {
      const patch = grassPatches[patchIndex];
      let group: ChicagoGrassGroup | undefined;
      for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
        if (groups[groupIndex].color === patch.color) {
          group = groups[groupIndex];
          break;
        }
      }
      if (!group) {
        group = { color: patch.color, items: [] };
        groups.push(group);
      }
      group.items.push(patch);
    }
    return groups;
  }, [grassPatches]);

  const crosswalkGroups = useMemo(() => {
    const groups: ChicagoCrosswalkGroup[] = [];
    for (let stripeIndex = 0; stripeIndex < crosswalks.length; stripeIndex += 1) {
      const stripe = crosswalks[stripeIndex];
      let group: ChicagoCrosswalkGroup | undefined;
      for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
        if (groups[groupIndex].opacity === stripe.opacity) {
          group = groups[groupIndex];
          break;
        }
      }
      if (!group) {
        group = { opacity: stripe.opacity, items: [] };
        groups.push(group);
      }
      group.items.push(stripe);
    }
    return groups;
  }, [crosswalks]);

  useEffect(() => {
    const setFlatPlane = (
      mesh: THREE.InstancedMesh,
      index: number,
      x: number,
      y: number,
      z: number,
      width: number,
      depth: number,
    ) => {
      flatPlaneDummy.position.set(x, y, z);
      flatPlaneDummy.rotation.set(-Math.PI / 2, 0, 0);
      flatPlaneDummy.scale.set(width, depth, 1);
      flatPlaneDummy.updateMatrix();
      mesh.setMatrixAt(index, flatPlaneDummy.matrix);
    };

    const sidewalkMesh = sidewalkRef.current;
    if (sidewalkMesh) {
      for (let index = 0; index < sidewalkPlanes.length; index += 1) {
        const item = sidewalkPlanes[index];
        setFlatPlane(sidewalkMesh, index, item.x, baseHeight + 0.37, item.z, item.width, item.depth);
      }
      sidewalkMesh.count = sidewalkPlanes.length;
      sidewalkMesh.instanceMatrix.needsUpdate = true;
    }

    const parkingMesh = parkingRef.current;
    if (parkingMesh) {
      for (let index = 0; index < parkingLines.length; index += 1) {
        const item = parkingLines[index];
        setFlatPlane(parkingMesh, index, item.x, baseHeight + 0.395, item.z, item.width, item.depth);
      }
      parkingMesh.count = parkingLines.length;
      parkingMesh.instanceMatrix.needsUpdate = true;
    }

    for (let groupIndex = 0; groupIndex < grassGroups.length; groupIndex += 1) {
      const group = grassGroups[groupIndex];
      const mesh = grassRefs.current[groupIndex];
      if (!mesh) continue;
      for (let index = 0; index < group.items.length; index += 1) {
        const patch = group.items[index];
        setFlatPlane(mesh, index, patch.x, baseHeight + 0.405, patch.z, patch.width, patch.depth);
      }
      mesh.count = group.items.length;
      mesh.instanceMatrix.needsUpdate = true;
    }

    for (let groupIndex = 0; groupIndex < crosswalkGroups.length; groupIndex += 1) {
      const group = crosswalkGroups[groupIndex];
      const mesh = crosswalkRefs.current[groupIndex];
      if (!mesh) continue;
      for (let index = 0; index < group.items.length; index += 1) {
        const stripe = group.items[index];
        setFlatPlane(mesh, index, stripe.x, baseHeight + 0.43, stripe.z, stripe.width, stripe.depth);
      }
      mesh.count = group.items.length;
      mesh.instanceMatrix.needsUpdate = true;
    }
  }, [baseHeight, crosswalkGroups, flatPlaneDummy, grassGroups, parkingLines, sidewalkPlanes]);

  return (
    <group name="chicago-street-details">
      <instancedMesh ref={sidewalkRef} args={[undefined, undefined, Math.max(1, sidewalkPlanes.length)]} renderOrder={7} frustumCulled={false}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color="#b6bec9" />
      </instancedMesh>
      <instancedMesh ref={parkingRef} args={[undefined, undefined, Math.max(1, parkingLines.length)]} renderOrder={8} frustumCulled={false}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color="#f8fafc" transparent opacity={0.58} />
      </instancedMesh>
      {grassGroups.map((group, groupIndex) => (
        <instancedMesh
          key={`grass-patches-${group.color}`}
          ref={(mesh) => {
            grassRefs.current[groupIndex] = mesh;
          }}
          args={[undefined, undefined, Math.max(1, group.items.length)]}
          renderOrder={8}
          frustumCulled={false}
        >
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial color={group.color} transparent opacity={0.82} />
        </instancedMesh>
      ))}
      {crosswalkGroups.map((group, groupIndex) => (
        <instancedMesh
          key={`crosswalks-${group.opacity}`}
          ref={(mesh) => {
            crosswalkRefs.current[groupIndex] = mesh;
          }}
          args={[undefined, undefined, Math.max(1, group.items.length)]}
          renderOrder={10}
          frustumCulled={false}
        >
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial color="#f8fafc" transparent opacity={group.opacity} side={THREE.DoubleSide} />
        </instancedMesh>
      ))}
      {hydrants.map((hydrant) => (
        <group key={hydrant.key} position={[hydrant.x, baseHeight + 0.56, hydrant.z]}>
          <mesh position={[0, 1.0, 0]} castShadow={false}>
            <cylinderGeometry args={[0.7, 0.74, 2.0, 8]} />
            <meshBasicMaterial color="#ef4444" />
          </mesh>
          <mesh position={[0, 2.25, 0]} castShadow={false}>
            <sphereGeometry args={[0.78, 8, 6]} />
            <meshBasicMaterial color="#f87171" />
          </mesh>
          <mesh position={[0, 1.55, 0]} rotation={[0, 0, Math.PI / 2]} castShadow={false}>
            <cylinderGeometry args={[0.24, 0.24, 2.2, 6]} />
            <meshBasicMaterial color="#b91c1c" />
          </mesh>
        </group>
      ))}
      {lamps.map((lamp) => (
        <group key={lamp.key} position={[lamp.x, baseHeight + 0.48, lamp.z]} rotation={[0, lamp.rotation, 0]}>
          <mesh position={[0, 5.7, 0]} castShadow={false}>
            <cylinderGeometry args={[0.28, 0.38, 11.4, 6]} />
            <meshBasicMaterial color="#1f2937" />
          </mesh>
          <mesh position={[0, 11.25, 1.4]} rotation={[Math.PI / 2, 0, 0]} castShadow={false}>
            <cylinderGeometry args={[0.18, 0.22, 3.1, 6]} />
            <meshBasicMaterial color="#1f2937" />
          </mesh>
          <mesh position={[0, 10.9, 2.95]} castShadow={false}>
            <boxGeometry args={[2.35, 1.22, 2.0]} />
            <meshBasicMaterial color="#fde68a" transparent opacity={0.96} />
          </mesh>
          <mesh position={[0, 10.9, 2.95]} castShadow={false}>
            <sphereGeometry args={[2.2, 10, 6]} />
            <meshBasicMaterial color="#fde68a" transparent opacity={0.18} depthWrite={false} />
          </mesh>
        </group>
      ))}
      {trashCans.map((can) => (
        <group key={can.key} position={[can.x, baseHeight + 0.56, can.z]}>
          <mesh position={[0, 1.05, 0]} castShadow={false}>
            <cylinderGeometry args={[1.05, 0.92, 2.1, 8]} />
            <meshBasicMaterial color="#374151" />
          </mesh>
          <mesh position={[0, 2.22, 0]} castShadow={false}>
            <cylinderGeometry args={[1.16, 1.16, 0.24, 8]} />
            <meshBasicMaterial color="#111827" />
          </mesh>
          <mesh position={[0, 1.25, 1.0]} castShadow={false}>
            <boxGeometry args={[1.25, 0.16, 0.12]} />
            <meshBasicMaterial color="#9ca3af" />
          </mesh>
        </group>
      ))}
      {benches.map((bench) => (
        <group key={bench.key} position={[bench.x, baseHeight + 0.58, bench.z]} rotation={[0, bench.rotation, 0]}>
          <mesh position={[0, 1.04, 0]} castShadow={false}>
            <boxGeometry args={[5.6, 0.36, 1.35]} />
            <meshBasicMaterial color="#7c4a2d" />
          </mesh>
          <mesh position={[0, 1.72, -0.64]} castShadow={false}>
            <boxGeometry args={[5.7, 1.1, 0.32]} />
            <meshBasicMaterial color="#5c331f" />
          </mesh>
          {CHICAGO_BENCH_LEG_X.map((x) => (
            <mesh key={`bench-leg-${x}`} position={[x, 0.52, 0]} castShadow={false}>
              <boxGeometry args={[0.32, 1.0, 0.32]} />
              <meshBasicMaterial color="#1f2937" />
            </mesh>
          ))}
        </group>
      ))}
      {streetTrees.map((tree) => (
        <group key={tree.key} position={[tree.x, baseHeight + 0.52, tree.z]} scale={[tree.scale, tree.scale, tree.scale]}>
          <mesh position={[0, 2.65, 0]} castShadow={false}>
            <cylinderGeometry args={[0.55, 0.78, 5.3, 7]} />
            <meshBasicMaterial color="#6b3f22" />
          </mesh>
          <FoliageDodeca position={[0, 6.2, 0]} radius={2.85} color="#15803d" />
          <FoliageDodeca position={[1.1, 5.55, -0.8]} radius={2.05} color="#166534" />
        </group>
      ))}
      <ChicagoTrafficLights baseHeight={baseHeight} />
    </group>
  );
}

function ChicagoBeanPark({ baseHeight }: { baseHeight: number }) {
  return (
    <group name="chicago-bean-park" position={[CHICAGO_BEAN_PARK_X, baseHeight, CHICAGO_BEAN_PARK_Z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.505, 0]} renderOrder={12}>
        <circleGeometry args={[15.5, 42]} />
        <meshBasicMaterial color="#94a3b8" transparent opacity={0.12} depthWrite={false} />
      </mesh>
      {CHICAGO_SIDE_SIGNS.map((side) => (
        <mesh
          key={`bean-lobe-${side}`}
          position={[side * 5.8, 8.55, side * 0.25]}
          rotation={[0, 0.32 + side * 0.05, -0.08 - side * 0.035]}
          scale={[14.6, 8.8, 14.2]}
          castShadow={false}
        >
          <sphereGeometry args={[1, 48, 24]} />
          <meshBasicMaterial color="#dce8f3" />
        </mesh>
      ))}
      {CHICAGO_SIDE_SIGNS.map((side) => (
        <mesh
          key={`bean-inner-shadow-${side}`}
          position={[side * 2.15, 8.35, side * 0.05]}
          rotation={[0, 0.32 + side * 0.035, -0.08 - side * 0.025]}
          scale={[2.85, 6.35, 12.35]}
          castShadow={false}
        >
          <sphereGeometry args={[1, 32, 16]} />
          <meshBasicMaterial color="#8ea0b4" transparent opacity={0.28} depthWrite={false} />
        </mesh>
      ))}
      {CHICAGO_SIDE_SIGNS.map((side) => (
        <mesh
          key={`bean-lower-shadow-${side}`}
          position={[side * 5.65, 5.72, side * 0.22]}
          rotation={[0, 0.32 + side * 0.05, -0.08 - side * 0.035]}
          scale={[12.2, 2.85, 12.4]}
          castShadow={false}
        >
          <sphereGeometry args={[1, 32, 12]} />
          <meshBasicMaterial color="#74879d" transparent opacity={0.22} depthWrite={false} />
        </mesh>
      ))}
      {CHICAGO_SIDE_SIGNS.map((side) => (
        <mesh
          key={`bean-cleft-rim-highlight-${side}`}
          position={[side * 1.08, 8.85, side * 0.06]}
          rotation={[0, 0.32 + side * 0.018, -0.08 - side * 0.018]}
          scale={[0.42, 6.7, 11.6]}
          castShadow={false}
        >
          <sphereGeometry args={[1, 24, 12]} />
          <meshBasicMaterial color="#f8fbff" transparent opacity={0.22} depthWrite={false} />
        </mesh>
      ))}
      <mesh position={[0, 8.25, 0]} rotation={[0, 0.32, -0.08]} scale={[0.74, 7.35, 13.2]} castShadow={false}>
        <sphereGeometry args={[1, 32, 16]} />
        <meshBasicMaterial color="#334155" transparent opacity={0.62} depthWrite={false} />
      </mesh>
      <mesh position={[0, 8.25, -0.35]} rotation={[0, 0.32, -0.08]} scale={[0.34, 7.8, 10.8]} castShadow={false}>
        <sphereGeometry args={[1, 24, 12]} />
        <meshBasicMaterial color="#111827" transparent opacity={0.42} depthWrite={false} />
      </mesh>
      <mesh position={[0, 4.6, 0]} rotation={[0, 0.32, -0.08]} scale={[0.46, 2.1, 9.8]} castShadow={false}>
        <sphereGeometry args={[1, 24, 10]} />
        <meshBasicMaterial color="#1f2937" transparent opacity={0.46} depthWrite={false} />
      </mesh>
      <mesh position={[-7.6, 12.4, -4.8]} rotation={[0, 0.25, -0.04]} scale={[5.8, 1.65, 3.3]} castShadow={false}>
        <sphereGeometry args={[1, 24, 12]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.38} depthWrite={false} />
      </mesh>
      <mesh position={[7.4, 11.7, 4.4]} rotation={[0, 0.36, -0.11]} scale={[4.6, 1.15, 2.4]} castShadow={false}>
        <sphereGeometry args={[1, 24, 12]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.24} depthWrite={false} />
      </mesh>
      {CHICAGO_SIDE_SIGNS.map((side) => (
        <group key={`bean-park-bollards-${side}`} rotation={[0, side * 0.68, 0]}>
          {CHICAGO_BEAN_BOLLARD_X.map((x) => (
            <mesh key={`bollard-${side}-${x}`} position={[x, 0.98, 31.5]} castShadow={false}>
              <cylinderGeometry args={[0.42, 0.5, 1.9, 8]} />
              <meshBasicMaterial color="#e5e7eb" />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

function writeChicagoVehicleTransform(target: ChicagoVehicleTransform, car: ChicagoCar, elapsedSeconds: number) {
  let t = (car.offset + elapsedSeconds * car.speed) % 1;
  if (car.direction < 0) t = 1 - t;
  const spanStart = -218;
  const spanEnd = 190;
  const position = lerpNumber(spanStart, spanEnd, t);

  if (car.route === "vertical" || car.route === "lakeshore") {
    target.x = car.route === "lakeshore" ? 190 : car.lane + car.direction * 4.2;
    target.z = position;
    target.yaw = car.direction > 0 ? 0 : Math.PI;
    return target;
  }

  target.x = position;
  target.z = car.lane - car.direction * 4.2;
  target.yaw = car.direction > 0 ? Math.PI / 2 : -Math.PI / 2;
  return target;
}

function getChicagoPedestrianTransform(pedestrian: ChicagoPedestrian, elapsedSeconds: number) {
  let t = (pedestrian.offset + elapsedSeconds * pedestrian.speed) % 1;
  if (pedestrian.direction < 0) t = 1 - t;
  const position = lerpNumber(-214, 174, t);

  if (pedestrian.route === "vertical") {
    return {
      x: pedestrian.lane + pedestrian.sideOffset,
      z: position,
      yaw: pedestrian.direction > 0 ? 0 : Math.PI,
    };
  }

  return {
    x: position,
    z: pedestrian.lane + pedestrian.sideOffset,
    yaw: pedestrian.direction > 0 ? Math.PI / 2 : -Math.PI / 2,
  };
}

function setChicagoInstancedPart(
  dummy: THREE.Object3D,
  mesh: THREE.InstancedMesh,
  index: number,
  baseX: number,
  baseY: number,
  baseZ: number,
  yaw: number,
  offsetX: number,
  offsetY: number,
  offsetZ: number,
  scaleX: number,
  scaleY: number,
  scaleZ: number,
  rotationX = 0,
  rotationZ = 0,
) {
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  dummy.position.set(
    baseX + cos * offsetX + sin * offsetZ,
    baseY + offsetY,
    baseZ - sin * offsetX + cos * offsetZ,
  );
  dummy.rotation.set(rotationX, yaw, rotationZ);
  dummy.scale.set(scaleX, scaleY, scaleZ);
  dummy.updateMatrix();
  mesh.setMatrixAt(index, dummy.matrix);
}

function getChicagoCarLengthScale(car: ChicagoCar) {
  return car.vehicleType === "bus" ? 1.85 : car.vehicleType === "firetruck" ? 1.22 : car.vehicleType === "ambulance" ? 1.12 : 1;
}

function getChicagoCarSideMarkColor(car: ChicagoCar) {
  return car.vehicleType === "taxi"
    ? "#111827"
    : car.vehicleType === "bus"
      ? "#2563eb"
      : car.vehicleType === "firetruck"
        ? "#f8fafc"
        : car.vehicleType === "sedan"
          ? "#fef3c7"
          : "#ef4444";
}

function getChicagoCarLightBarColor(car: ChicagoCar) {
  return car.vehicleType === "police" ? "#2563eb" : car.vehicleType === "ambulance" ? "#ef4444" : "#facc15";
}

type ChicagoCarInstance = {
  car: ChicagoCar;
  index: number;
};

type ChicagoCarColorGroup = {
  color: string;
  items: ChicagoCarInstance[];
};

type ChicagoVehicleTransform = {
  x: number;
  z: number;
  yaw: number;
};

function groupChicagoCarsByColor(
  cars: ChicagoCar[],
  getColor: (car: ChicagoCar) => string,
  shouldInclude: (car: ChicagoCar) => boolean = () => true,
) {
  const groups: ChicagoCarColorGroup[] = [];

  for (let index = 0; index < cars.length; index += 1) {
    const car = cars[index];
    if (!shouldInclude(car)) continue;
    const color = getColor(car);
    let group: ChicagoCarColorGroup | undefined;
    for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
      if (groups[groupIndex].color === color) {
        group = groups[groupIndex];
        break;
      }
    }
    if (!group) {
      group = { color, items: [] };
      groups.push(group);
    }
    group.items.push({ car, index });
  }

  return groups;
}

function ChicagoTraffic({ cars, baseHeight }: { cars: ChicagoCar[]; baseHeight: number }) {
  const bodyRefs = useLazyRef<Array<THREE.InstancedMesh | null>>(() => []);
  const sideMarkRefs = useLazyRef<Array<THREE.InstancedMesh | null>>(() => []);
  const lightBarRefs = useLazyRef<Array<THREE.InstancedMesh | null>>(() => []);
  const cabinRef = useRef<THREE.InstancedMesh>(null);
  const taxiSignRef = useRef<THREE.InstancedMesh>(null);
  const wheelRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const lastUpdateRef = useRef(-1);
  const mobilePerformanceMode = useMemo(() => isMobilePerformanceMode(), []);
  const transformBufferRef = useLazyRef<ChicagoVehicleTransform[]>(() => []);
  const carInstances = useMemo(() => {
    const items: ChicagoCarInstance[] = [];
    for (let index = 0; index < cars.length; index += 1) {
      items.push({ car: cars[index], index });
    }
    return items;
  }, [cars]);
  const bodyGroups = useMemo(() => groupChicagoCarsByColor(cars, (car) => car.color), [cars]);
  const sideMarkGroups = useMemo(() => groupChicagoCarsByColor(cars, getChicagoCarSideMarkColor), [cars]);
  const lightBarGroups = useMemo(
    () => groupChicagoCarsByColor(cars, getChicagoCarLightBarColor, (car) => car.vehicleType === "police" || car.vehicleType === "ambulance" || car.vehicleType === "firetruck"),
    [cars],
  );
  const taxiCars = useMemo(() => {
    const items: ChicagoCarInstance[] = [];
    for (let index = 0; index < carInstances.length; index += 1) {
      const instance = carInstances[index];
      if (instance.car.vehicleType === "taxi") items.push(instance);
    }
    return items;
  }, [carInstances]);

  const finalizeMesh = (mesh: THREE.InstancedMesh, count: number) => {
    mesh.count = count;
    mesh.instanceMatrix.needsUpdate = true;
  };

  const writeCarMatrices = (elapsedSeconds: number) => {
    const cabinMesh = cabinRef.current;
    const taxiSignMesh = taxiSignRef.current;
    const wheelMesh = wheelRef.current;
    if (!cabinMesh || !taxiSignMesh || !wheelMesh) return;

    const transforms = transformBufferRef.current;
    for (let index = 0; index < cars.length; index += 1) {
      let transform = transforms[index];
      if (!transform) {
        transform = { x: 0, z: 0, yaw: 0 };
        transforms[index] = transform;
      }
      writeChicagoVehicleTransform(transform, cars[index], elapsedSeconds);
    }
    transforms.length = cars.length;
    const placePart = (
      mesh: THREE.InstancedMesh,
      matrixIndex: number,
      car: ChicagoCar,
      carIndex: number,
      offsetX: number,
      offsetY: number,
      offsetZ: number,
      scaleX: number,
      scaleY: number,
      scaleZ: number,
      rotationX = 0,
    ) => {
      const transform = transforms[carIndex];
      if (!transform) return;
      const baseY = baseHeight + 0.1;
      setChicagoInstancedPart(dummy, mesh, matrixIndex, transform.x, baseY, transform.z, transform.yaw, offsetX, offsetY, offsetZ, scaleX, scaleY, scaleZ, rotationX);
    };

    for (let groupIndex = 0; groupIndex < bodyGroups.length; groupIndex += 1) {
      const group = bodyGroups[groupIndex];
      const mesh = bodyRefs.current[groupIndex];
      if (!mesh) continue;
      for (let matrixIndex = 0; matrixIndex < group.items.length; matrixIndex += 1) {
        const { car, index } = group.items[matrixIndex];
        const lengthScale = getChicagoCarLengthScale(car);
        placePart(mesh, matrixIndex, car, index, 0, 0.85 * car.scale, 0, 5.2 * car.scale, 1.35 * car.scale, 8.7 * car.scale * lengthScale);
      }
      finalizeMesh(mesh, group.items.length);
    }

    for (let carInstanceIndex = 0; carInstanceIndex < carInstances.length; carInstanceIndex += 1) {
      const { car, index } = carInstances[carInstanceIndex];
      placePart(
        cabinMesh,
        index,
        car,
        index,
        0,
        1.72 * car.scale,
        car.vehicleType === "bus" ? 0.2 * car.scale : -0.65 * car.scale,
        car.vehicleType === "bus" ? 4.3 * car.scale : 3.8 * car.scale,
        car.vehicleType === "bus" ? 1.02 * car.scale : 1.04 * car.scale,
        car.vehicleType === "bus" ? 8.4 * car.scale : 3.7 * car.scale,
      );
    }
    finalizeMesh(cabinMesh, cars.length);

    for (let groupIndex = 0; groupIndex < sideMarkGroups.length; groupIndex += 1) {
      const group = sideMarkGroups[groupIndex];
      const mesh = sideMarkRefs.current[groupIndex];
      if (!mesh) continue;
      for (let matrixIndex = 0; matrixIndex < group.items.length; matrixIndex += 1) {
        const { car, index } = group.items[matrixIndex];
        const lengthScale = getChicagoCarLengthScale(car);
        placePart(
          mesh,
          matrixIndex,
          car,
          index,
          0,
          1.34 * car.scale,
          4.42 * car.scale * lengthScale,
          car.vehicleType === "sedan" ? 3.6 * car.scale : 4.2 * car.scale,
          car.vehicleType === "sedan" ? 0.26 * car.scale : 0.34 * car.scale,
          car.vehicleType === "sedan" ? 0.26 * car.scale : 0.38 * car.scale,
        );
      }
      finalizeMesh(mesh, group.items.length);
    }

    for (let matrixIndex = 0; matrixIndex < taxiCars.length; matrixIndex += 1) {
      const { car, index } = taxiCars[matrixIndex];
      placePart(taxiSignMesh, matrixIndex, car, index, 0, 2.58 * car.scale, -0.75 * car.scale, 2.3 * car.scale, 0.6 * car.scale, 1.2 * car.scale);
    }
    finalizeMesh(taxiSignMesh, taxiCars.length);

    for (let groupIndex = 0; groupIndex < lightBarGroups.length; groupIndex += 1) {
      const group = lightBarGroups[groupIndex];
      const mesh = lightBarRefs.current[groupIndex];
      if (!mesh) continue;
      for (let matrixIndex = 0; matrixIndex < group.items.length; matrixIndex += 1) {
        const { car, index } = group.items[matrixIndex];
        placePart(mesh, matrixIndex, car, index, 0, 2.45 * car.scale, -0.92 * car.scale, 2.2 * car.scale, 0.32 * car.scale, 0.65 * car.scale);
      }
      finalizeMesh(mesh, group.items.length);
    }

    for (let carInstanceIndex = 0; carInstanceIndex < carInstances.length; carInstanceIndex += 1) {
      const { car, index } = carInstances[carInstanceIndex];
      const lengthScale = getChicagoCarLengthScale(car);
      let wheelIndex = index * 4;
      for (let xSideIndex = 0; xSideIndex < CHICAGO_CAR_WHEEL_SIDES.length; xSideIndex += 1) {
        const xSide = CHICAGO_CAR_WHEEL_SIDES[xSideIndex];
        for (let zSideIndex = 0; zSideIndex < CHICAGO_CAR_WHEEL_SIDES.length; zSideIndex += 1) {
          const zSide = CHICAGO_CAR_WHEEL_SIDES[zSideIndex];
          placePart(
            wheelMesh,
            wheelIndex,
            car,
            index,
            xSide * 2.65 * car.scale,
            0.42 * car.scale,
            zSide * 3.15 * car.scale * lengthScale,
            0.48 * car.scale,
            0.42 * car.scale,
            0.48 * car.scale,
            Math.PI / 2,
          );
          wheelIndex += 1;
        }
      }
    }
    finalizeMesh(wheelMesh, cars.length * 4);
  };

  useEffect(() => {
    writeCarMatrices(0);
  }, [baseHeight, bodyGroups, carInstances, cars, dummy, lightBarGroups, sideMarkGroups, taxiCars]);

  useFrame((state) => {
    const elapsedSeconds = state.clock.elapsedTime;
    const updateInterval = mobilePerformanceMode
      ? MOBILE_CHICAGO_TRAFFIC_UPDATE_INTERVAL_SECONDS
      : CHICAGO_TRAFFIC_UPDATE_INTERVAL_SECONDS;
    if (elapsedSeconds - lastUpdateRef.current < updateInterval) return;
    lastUpdateRef.current = elapsedSeconds;
    writeCarMatrices(elapsedSeconds);
  });

  return (
    <group name="chicago-traffic">
      {bodyGroups.map((group, groupIndex) => (
        <instancedMesh
          key={`chicago-car-body-${group.color}`}
          ref={(mesh) => {
            bodyRefs.current[groupIndex] = mesh;
          }}
          args={[undefined, undefined, Math.max(1, group.items.length)]}
          castShadow={false}
          receiveShadow={false}
          frustumCulled={false}
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial color={group.color} />
        </instancedMesh>
      ))}
      <instancedMesh ref={cabinRef} args={[undefined, undefined, cars.length]} castShadow={false} receiveShadow={false} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color="#dff9ff" transparent opacity={0.92} />
      </instancedMesh>
      {sideMarkGroups.map((group, groupIndex) => (
        <instancedMesh
          key={`chicago-car-side-mark-${group.color}`}
          ref={(mesh) => {
            sideMarkRefs.current[groupIndex] = mesh;
          }}
          args={[undefined, undefined, Math.max(1, group.items.length)]}
          castShadow={false}
          receiveShadow={false}
          frustumCulled={false}
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial color={group.color} />
        </instancedMesh>
      ))}
      <instancedMesh ref={taxiSignRef} args={[undefined, undefined, Math.max(1, taxiCars.length)]} castShadow={false} receiveShadow={false} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color="#f8fafc" />
      </instancedMesh>
      {lightBarGroups.map((group, groupIndex) => (
        <instancedMesh
          key={`chicago-car-lightbar-${group.color}`}
          ref={(mesh) => {
            lightBarRefs.current[groupIndex] = mesh;
          }}
          args={[undefined, undefined, Math.max(1, group.items.length)]}
          castShadow={false}
          receiveShadow={false}
          frustumCulled={false}
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial color={group.color} />
        </instancedMesh>
      ))}
      <instancedMesh ref={wheelRef} args={[undefined, undefined, Math.max(1, cars.length * 4)]} castShadow={false} receiveShadow={false} frustumCulled={false}>
        <cylinderGeometry args={[1, 1, 1, 8]} />
        <meshBasicMaterial color="#111827" />
      </instancedMesh>
    </group>
  );
}

function ChicagoPedestrians({ pedestrians, baseHeight }: { pedestrians: ChicagoPedestrian[]; baseHeight: number }) {
  const bodyRef = useRef<THREE.InstancedMesh>(null);
  const headRef = useRef<THREE.InstancedMesh>(null);
  const legLeftRef = useRef<THREE.InstancedMesh>(null);
  const legRightRef = useRef<THREE.InstancedMesh>(null);
  const armLeftRef = useRef<THREE.InstancedMesh>(null);
  const armRightRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const lastUpdateRef = useRef(-1);
  const mobilePerformanceMode = useMemo(() => isMobilePerformanceMode(), []);

  const writePedestrianMatrices = (elapsedSeconds: number) => {
    const bodyMesh = bodyRef.current;
    const headMesh = headRef.current;
    const legLeftMesh = legLeftRef.current;
    const legRightMesh = legRightRef.current;
    const armLeftMesh = armLeftRef.current;
    const armRightMesh = armRightRef.current;
    if (!bodyMesh || !headMesh || !legLeftMesh || !legRightMesh || !armLeftMesh || !armRightMesh) return;

    for (let index = 0; index < pedestrians.length; index += 1) {
      const pedestrian = pedestrians[index];
      const transform = getChicagoPedestrianTransform(pedestrian, elapsedSeconds);
      const groundY = baseHeight + 0.08;
      const step = Math.sin(elapsedSeconds * 9 + index * 0.73) * 0.16 * pedestrian.direction;
      setChicagoInstancedPart(dummy, bodyMesh, index, transform.x, groundY, transform.z, transform.yaw, 0, 1.85, 0, 0.78, 1.55, 0.48);
      setChicagoInstancedPart(dummy, headMesh, index, transform.x, groundY, transform.z, transform.yaw, 0, 3.0, -0.02, 0.94, 0.9, 0.72);
      setChicagoInstancedPart(dummy, legLeftMesh, index, transform.x, groundY, transform.z, transform.yaw, -0.22, 0.74, step, 0.26, 1.05, 0.26);
      setChicagoInstancedPart(dummy, legRightMesh, index, transform.x, groundY, transform.z, transform.yaw, 0.22, 0.74, -step, 0.26, 1.05, 0.26);
      setChicagoInstancedPart(dummy, armLeftMesh, index, transform.x, groundY, transform.z, transform.yaw, -0.58, 1.82, -step, 0.2, 1.05, 0.22);
      setChicagoInstancedPart(dummy, armRightMesh, index, transform.x, groundY, transform.z, transform.yaw, 0.58, 1.82, step, 0.2, 1.05, 0.22);
    }

    bodyMesh.instanceMatrix.needsUpdate = true;
    headMesh.instanceMatrix.needsUpdate = true;
    legLeftMesh.instanceMatrix.needsUpdate = true;
    legRightMesh.instanceMatrix.needsUpdate = true;
    armLeftMesh.instanceMatrix.needsUpdate = true;
    armRightMesh.instanceMatrix.needsUpdate = true;
  };

  useEffect(() => {
    const bodyMesh = bodyRef.current;
    const headMesh = headRef.current;
    const legLeftMesh = legLeftRef.current;
    const legRightMesh = legRightRef.current;
    const armLeftMesh = armLeftRef.current;
    const armRightMesh = armRightRef.current;
    if (!bodyMesh || !headMesh || !legLeftMesh || !legRightMesh || !armLeftMesh || !armRightMesh) return;

    bodyMesh.count = pedestrians.length;
    headMesh.count = pedestrians.length;
    legLeftMesh.count = pedestrians.length;
    legRightMesh.count = pedestrians.length;
    armLeftMesh.count = pedestrians.length;
    armRightMesh.count = pedestrians.length;
    writePedestrianMatrices(0);
  }, [baseHeight, dummy, pedestrians]);

  useFrame((state) => {
    const elapsedSeconds = state.clock.elapsedTime;
    const updateInterval = mobilePerformanceMode
      ? MOBILE_CHICAGO_PEDESTRIAN_UPDATE_INTERVAL_SECONDS
      : CHICAGO_PEDESTRIAN_UPDATE_INTERVAL_SECONDS;
    if (elapsedSeconds - lastUpdateRef.current < updateInterval) return;
    lastUpdateRef.current = elapsedSeconds;
    writePedestrianMatrices(elapsedSeconds);
  });

  return (
    <group name="chicago-pedestrians">
      <instancedMesh ref={bodyRef} args={[undefined, undefined, pedestrians.length]} castShadow={false} receiveShadow={false} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color="#2563eb" />
      </instancedMesh>
      <instancedMesh ref={headRef} args={[undefined, undefined, pedestrians.length]} castShadow={false} receiveShadow={false} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color="#e0ac69" />
      </instancedMesh>
      <instancedMesh ref={legLeftRef} args={[undefined, undefined, pedestrians.length]} castShadow={false} receiveShadow={false} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color="#334155" />
      </instancedMesh>
      <instancedMesh ref={legRightRef} args={[undefined, undefined, pedestrians.length]} castShadow={false} receiveShadow={false} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color="#334155" />
      </instancedMesh>
      <instancedMesh ref={armLeftRef} args={[undefined, undefined, pedestrians.length]} castShadow={false} receiveShadow={false} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color="#e0ac69" />
      </instancedMesh>
      <instancedMesh ref={armRightRef} args={[undefined, undefined, pedestrians.length]} castShadow={false} receiveShadow={false} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color="#e0ac69" />
      </instancedMesh>
    </group>
  );
}

function ChicagoCityColliders({
  chunk,
  baseHeight,
  buildings,
  groundGeometry,
}: {
  chunk: SurvivalChunkInfo;
  baseHeight: number;
  buildings: ChicagoBuilding[];
  groundGeometry: THREE.BufferGeometry;
}) {
  if (!shouldBuildSurvivalChunkColliders(chunk)) return null;

  const trafficLightIntersections = makeChicagoTrafficLightIntersections();
  const lamps = makeChicagoLampLayout();
  const streetTrees = makeChicagoStreetTreeLayout();

  return (
    <>
      <RigidBody type="fixed" colliders="trimesh" friction={0.38} restitution={0} position={[chunk.x, 0, chunk.z]}>
        <mesh geometry={groundGeometry} dispose={null}>
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </RigidBody>
      <RigidBody type="fixed" colliders={false} friction={0.35} restitution={0} position={[chunk.x, 0, chunk.z]}>
        {buildings.map((building) => {
          if (!building.enterable) {
            return (
              <CuboidCollider
                key={`${building.key}-collider`}
                args={[building.width / 2, building.height / 2, building.depth / 2]}
                position={[building.localX, baseHeight + building.height / 2, building.localZ]}
                rotation={[0, building.rotation, 0]}
              />
            );
          }

          const wallThickness = 1.15;
          const doorWidth = Math.min(8.6, building.width * 0.42);
          const frontSegmentWidth = Math.max(1.4, (building.width - doorWidth) / 2);
          const wallY = baseHeight + building.height / 2;
          const placeWall = (offsetX: number, offsetZ: number): [number, number, number] => {
            const cos = Math.cos(building.rotation);
            const sin = Math.sin(building.rotation);
            return [
              building.localX + cos * offsetX + sin * offsetZ,
              wallY,
              building.localZ - sin * offsetX + cos * offsetZ,
            ];
          };

          return (
            <Fragment key={`${building.key}-enterable-colliders`}>
              <CuboidCollider
                args={[building.width / 2, building.height / 2, wallThickness / 2]}
                position={placeWall(0, -building.depth / 2 + wallThickness / 2)}
                rotation={[0, building.rotation, 0]}
              />
              {CHICAGO_SIDE_SIGNS.map((side) => (
                <CuboidCollider
                  key={`${building.key}-side-wall-${side}`}
                  args={[wallThickness / 2, building.height / 2, building.depth / 2]}
                  position={placeWall(side * (building.width / 2 - wallThickness / 2), 0)}
                  rotation={[0, building.rotation, 0]}
                />
              ))}
              {CHICAGO_SIDE_SIGNS.map((side) => (
                <CuboidCollider
                  key={`${building.key}-front-wall-${side}`}
                  args={[frontSegmentWidth / 2, building.height / 2, wallThickness / 2]}
                  position={placeWall(side * (doorWidth / 2 + frontSegmentWidth / 2), building.depth / 2 - wallThickness / 2)}
                  rotation={[0, building.rotation, 0]}
                />
              ))}
            </Fragment>
          );
        })}
        {trafficLightIntersections.map((intersection) => (
          <Fragment key={`traffic-light-colliders-${intersection.key}`}>
            {([
              [-18, -18, 0],
              [18, 18, Math.PI],
            ] as const).map(([offsetX, offsetZ, yaw], poleIndex) => (
              <group
                key={`traffic-light-collider-${intersection.key}-${poleIndex}`}
                position={[intersection.x + offsetX, baseHeight + 0.36, intersection.z + offsetZ]}
                rotation={[0, yaw, 0]}
              >
                <CylinderCollider args={[4.1, 0.34]} position={[0, 4.1, 0]} />
                <CuboidCollider args={[4.05, 0.18, 0.18]} position={[4, 8.1, 0]} />
                <CuboidCollider args={[0.725, 1.7, 0.5]} position={[8.3, 7.55, 0]} />
              </group>
            ))}
          </Fragment>
        ))}
        {lamps.map((lamp) => (
          <group key={`${lamp.key}-colliders`} position={[lamp.x, baseHeight + 0.48, lamp.z]} rotation={[0, lamp.rotation, 0]}>
            <CylinderCollider args={[5.7, 0.38]} position={[0, 5.7, 0]} />
            <CuboidCollider args={[0.22, 0.22, 1.55]} position={[0, 11.25, 1.4]} />
            <CuboidCollider args={[1.175, 0.61, 1]} position={[0, 10.9, 2.95]} />
          </group>
        ))}
        {streetTrees.map((tree) => (
          <CylinderCollider
            key={`${tree.key}-trunk-collider`}
            args={[2.65 * tree.scale, 0.78 * tree.scale]}
            position={[tree.x, baseHeight + 0.52 + 2.65 * tree.scale, tree.z]}
          />
        ))}
      </RigidBody>
    </>
  );
}

export function SurvivalChicagoCity({
  chunk,
  villageBaseHeightForChunk,
  makeVillagePadGeometry,
  makeVillagePadSkirtGeometry,
}: {
  chunk: SurvivalChunkInfo;
  villageBaseHeightForChunk: SurvivalVillageBaseHeightForChunk;
  makeVillagePadGeometry: SurvivalVillageGeometryFactory;
  makeVillagePadSkirtGeometry: SurvivalVillageGeometryFactory;
}) {
  const cityBaseHeight = useMemo(() => villageBaseHeightForChunk(chunk), [chunk]);
  const cityPadGeometry = useMemo(() => makeVillagePadGeometry(chunk), [chunk]);
  const hasCityPadSkirt = shouldRenderSurvivalChunkSkirt(chunk);
  const cityPadSkirtGeometry = useMemo(
    () => hasCityPadSkirt ? makeVillagePadSkirtGeometry(chunk) : null,
    [chunk, hasCityPadSkirt]
  );
  const cityPadCollisionGeometry = useMemo(() => makeVillagePadGeometry(chunk), [chunk]);
  const layout = useMemo(() => makeChicagoLayout(chunk), [chunk]);
  const signTexture = useMemo(() => getChicagoSignTexture(), []);
  const showNearDetails = chunk.distance === 0;
  useSurvivalFeatureCount("chicagoBuildings", chunk.key, layout.buildings.length);
  useSurvivalFeatureCount("chicagoCars", chunk.key, showNearDetails ? layout.cars.length : 0);
  useSurvivalFeatureCount("chicagoPedestrians", chunk.key, showNearDetails ? layout.pedestrians.length : 0);

  return (
    <>
      <ChicagoCityColliders
        chunk={chunk}
        baseHeight={cityBaseHeight}
        buildings={layout.buildings}
        groundGeometry={cityPadCollisionGeometry}
      />
      <group name={`survival-chicago-city-${chunk.key}`} position={[chunk.x, 0, chunk.z]}>
        {cityPadSkirtGeometry && (
          <mesh geometry={cityPadSkirtGeometry} dispose={null}>
            <meshBasicMaterial vertexColors side={THREE.DoubleSide} />
          </mesh>
        )}
        <ChicagoCitySurface geometry={cityPadGeometry} baseHeight={cityBaseHeight} />
        <ChicagoBuildings buildings={layout.buildings} baseHeight={cityBaseHeight} showDetails={showNearDetails} />
        <ChicagoBuildingDetails buildings={layout.buildings} baseHeight={cityBaseHeight} showDetails={showNearDetails} />
        <ChicagoBuildingInteriors buildings={layout.buildings} baseHeight={cityBaseHeight} showDetails={showNearDetails} />
        {showNearDetails && <ChicagoStreetDetails baseHeight={cityBaseHeight} />}
        {showNearDetails && <ChicagoBeanPark baseHeight={cityBaseHeight} />}
        <group position={[-206, cityBaseHeight + 15, 214]}>
          <mesh position={[0, -6, 0]} castShadow={false}>
            <boxGeometry args={[4, 12, 3]} />
            <meshBasicMaterial color="#111827" />
          </mesh>
          <sprite scale={[72, 20, 1]} frustumCulled={false}>
            <spriteMaterial map={signTexture} transparent alphaTest={0.05} depthWrite={false} />
          </sprite>
        </group>
        {showNearDetails && (
          <>
            <ChicagoTraffic cars={layout.cars} baseHeight={cityBaseHeight} />
            <ChicagoPedestrians pedestrians={layout.pedestrians} baseHeight={cityBaseHeight} />
          </>
        )}
      </group>
    </>
  );
}
