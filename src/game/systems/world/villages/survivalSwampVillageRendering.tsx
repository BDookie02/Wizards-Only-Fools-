import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import * as THREE from "three";
import { useGameStore } from "../../../../store/gameStore";
import { getCachedIndexRange } from "../../rendering/indexRange";
import { Villagers } from "../../../Villagers";
import {
  createSurvivalDayNightCycle,
  getEffectiveSurvivalCycleElapsedSeconds,
  getSurvivalDayNightCycleInto,
} from "../../rendering/sky/survivalSkyCycleMath";
import { configurePixelSpriteTexture } from "../../rendering/textures/pixelSpriteTexture";
import { isMobilePerformanceMode } from "../../input/performanceMode";
import { getSurvivalTerrainDetailTexture } from "../terrain/survivalTerrainTextures";
import { shouldBuildSurvivalChunkColliders, shouldRenderSurvivalChunkSkirt } from "../survival/survivalChunks";
import type { SurvivalChunkInfo } from "../survival/survivalWorldConfig";
import { useSurvivalFeatureCount } from "../../../tools/qa/survivalFeatureCounters";
import { SWAMP_VILLAGE_RADIUS } from "./survivalSwampVillageTerrain";
import {
  getSwampVillageRopeLightBulbs,
  getSwampVillageRopeLightSegments,
  makeSwampVillageLayout,
  type SwampVillageHut,
  type SwampVillageLayout,
  type SwampVillageRamp as SwampVillageRampDescriptor,
  type SwampVillageReedPatch as SwampVillageReedPatchDescriptor,
  type SwampVillageRope,
  type SwampVillageWalkway as SwampVillageWalkwayDescriptor,
  type SwampVillageWaterLevelAtWorld,
} from "./survivalSwampVillageRuntime";

const MOBILE_SWAMP_TOAD_UPDATE_INTERVAL_SECONDS = 1 / 24;

type SurvivalVillageBaseHeightForChunk = (chunk: SurvivalChunkInfo) => number;
type SurvivalVillageGeometryFactory = (chunk: SurvivalChunkInfo) => THREE.BufferGeometry;

const SWAMP_VILLAGE_PLATFORM_SIZE = 76;
const SWAMP_MOSS_COLORS = ["#5d7d34", "#425f27", "#728644", "#30491f"];
const SWAMP_DARK_WOOD = "#21150c";
const SWAMP_WET_WOOD = "#2b1c12";
const SWAMP_SIDE_SIGNS = [-1, 1] as const;
const SWAMP_HUT_STILT_CORNERS = [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const;
const SWAMP_WATER_RIPPLE_INDICES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
const SWAMP_REED_STEM_INDICES = [0, 1, 2, 3, 4] as const;
const SWAMP_PLATFORM_PLANK_INDICES = [0, 1, 2, 3, 4, 5, 6, 7, 8] as const;
const SWAMP_PLATFORM_MOSS_INDICES = [0, 1, 2, 3, 4, 5, 6, 7] as const;

function makeSwampLilyPadGeometry() {
  const shape = new THREE.Shape();
  const cutAngle = 0.44;
  shape.moveTo(0, 0);
  for (let step = 0; step <= 28; step += 1) {
    const t = step / 28;
    const angle = cutAngle + t * (Math.PI * 2 - cutAngle * 2);
    shape.lineTo(Math.cos(angle), Math.sin(angle));
  }
  shape.lineTo(0, 0);

  const geo = new THREE.ShapeGeometry(shape);
  geo.rotateX(-Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

const SWAMP_TOAD_MANIFEST_SRC = "/sprites/swamp/toad/manifest.json";

type SwampToadAnimationManifest = {
  idle?: string[];
  yawn?: string[];
  sleep?: string;
  idleFrameMs?: number;
  yawnFrameMs?: number;
};

type SwampToadAnimationTextures = {
  idle: THREE.Texture[];
  yawn: THREE.Texture[];
  sleep: THREE.Texture;
  idleFrameMs: number;
  yawnFrameMs: number;
};

function makeSwampToadSleepZTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 160;
  canvas.height = 96;
  const ctx = canvas.getContext("2d");
  if (!ctx) return configurePixelSpriteTexture(new THREE.CanvasTexture(canvas));

  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const pixelRect = (x: number, y: number, width: number, height: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(width), Math.round(height));
  };

  const drawPixelZ = (x: number, y: number, unit: number, color: string, shadowColor: string) => {
    const rows = [
      "11111",
      "00010",
      "00100",
      "01000",
      "11111",
    ];

    const drawRows = (offsetX: number, offsetY: number, fill: string) => {
      for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
        const row = rows[rowIndex];
        for (let colIndex = 0; colIndex < row.length; colIndex += 1) {
          const cell = row[colIndex];
          if (cell !== "1") continue;
          pixelRect(
            x + offsetX + colIndex * unit,
            y + offsetY + rowIndex * unit,
            unit,
            unit,
            fill,
          );
        }
      }
    };

    drawRows(unit * 0.7, unit * 0.7, shadowColor);
    drawRows(0, 0, color);
  };

  drawPixelZ(8, 48, 8, "#e0f2fe", "rgba(30,64,175,0.72)");
  drawPixelZ(58, 30, 6, "#bfdbfe", "rgba(30,64,175,0.62)");
  drawPixelZ(96, 16, 5, "#93c5fd", "rgba(30,64,175,0.52)");
  drawPixelZ(126, 6, 4, "#dbeafe", "rgba(30,64,175,0.44)");

  return configurePixelSpriteTexture(new THREE.CanvasTexture(canvas));
}

function makeSwampToadTexture(isSleeping: boolean) {
  const canvas = document.createElement("canvas");
  canvas.width = 224;
  canvas.height = 176;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);

  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const pixelRect = (x: number, y: number, width: number, height: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(width), Math.round(height));
  };

  const ellipse = (x: number, y: number, radiusX: number, radiusY: number, color: string) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x, y, radiusX, radiusY, 0, 0, Math.PI * 2);
    ctx.fill();
  };

  const wart = (x: number, y: number, radius: number, color = "#8f6b43") => {
    ellipse(x, y, radius, Math.max(1.2, radius * 0.72), color);
    pixelRect(x - radius * 0.35, y - radius * 0.22, radius * 0.55, radius * 0.28, "#c49a69");
  };

  const pixelLine = (x: number, y: number, widths: number[], color: string) => {
    let cursor = x;
    for (let index = 0; index < widths.length; index += 1) {
      const width = widths[index];
      pixelRect(cursor, y + (index % 2), width, 3, color);
      cursor += width + 3;
    }
  };

  // Realistic squat silhouette: heavy body, low face, side weight, and a soft throat pouch.
  ellipse(112, 147, 93, 20, "#211912");
  ellipse(112, 132, 88, 34, "#6f4f35");
  ellipse(112, 120, 78, 43, "#9c7048");
  ellipse(112, 102, 72, 48, "#b98255");
  ellipse(112, 82, 62, 36, "#c99361");
  ellipse(112, 102, 58, 30, "#d4a06b");
  ellipse(112, 126, 56, 27, "#e1b98f");
  ellipse(112, 137, 45, 17, "#f0d0ae");
  ellipse(55, 121, 34, 26, "#7d5738");
  ellipse(169, 121, 34, 26, "#7d5738");
  ellipse(58, 132, 31, 13, "#b17f52");
  ellipse(166, 132, 31, 13, "#b17f52");

  // Eye mounds and brow shelves, with darker sockets like a real toad.
  ellipse(61, 61, 29, 26, "#8e6844");
  ellipse(163, 61, 29, 26, "#8e6844");
  ellipse(61, 64, 21, 19, "#dac5a5");
  ellipse(163, 64, 21, 19, "#dac5a5");
  ellipse(61, 66, 17, 15, "#403026");
  ellipse(163, 66, 17, 15, "#403026");
  pixelRect(33, 50, 55, 8, "#6b4a2f");
  pixelRect(136, 50, 55, 8, "#6b4a2f");
  pixelRect(42, 42, 40, 8, "#b98454");
  pixelRect(142, 42, 40, 8, "#b98454");
  pixelRect(54, 38, 21, 6, "#d3a678");
  pixelRect(149, 38, 21, 6, "#d3a678");

  if (isSleeping) {
    pixelRect(47, 64, 30, 5, "#241911");
    pixelRect(147, 64, 30, 5, "#241911");
    pixelRect(52, 70, 19, 3, "#6a4a31");
    pixelRect(153, 70, 19, 3, "#6a4a31");
    pixelRect(159, 18, 8, 4, "#dbeafe");
    pixelRect(167, 18, 17, 4, "#dbeafe");
    pixelRect(177, 22, 7, 4, "#dbeafe");
    pixelRect(144, 31, 8, 4, "#bfdbfe");
    pixelRect(152, 31, 13, 4, "#bfdbfe");
    pixelRect(160, 35, 5, 4, "#bfdbfe");
  } else {
    ellipse(61, 64, 11, 13, "#08090a");
    ellipse(163, 64, 11, 13, "#08090a");
    ellipse(66, 59, 4, 4, "#f8fafc");
    ellipse(168, 59, 4, 4, "#f8fafc");
    pixelRect(58, 53, 11, 4, "#030303");
    pixelRect(160, 53, 11, 4, "#030303");
    pixelRect(52, 75, 19, 4, "#2e2117");
    pixelRect(153, 75, 19, 4, "#2e2117");
  }

  // Mouth, nostrils, lower jaw, and throat folds.
  ellipse(86, 91, 4, 3, "#5b3924");
  ellipse(138, 91, 4, 3, "#5b3924");
  pixelRect(58, 103, 108, 4, "#6b4328");
  pixelRect(64, 108, 96, 4, "#3a281e");
  pixelRect(76, 113, 72, 3, "#a66f45");
  pixelRect(68, 97, 30, 4, "#e0b581");
  pixelRect(126, 97, 30, 4, "#e0b581");
  pixelLine(76, 123, [19, 32, 19], "#c89564");
  pixelLine(82, 130, [14, 42, 14], "#b98455");
  pixelLine(90, 137, [10, 34, 10], "#d5aa81");

  // Front feet, toes, and side folds.
  ellipse(47, 142, 31, 13, "#65462f");
  ellipse(177, 142, 31, 13, "#65462f");
  ellipse(64, 132, 29, 11, "#b37c4f");
  ellipse(160, 132, 29, 11, "#b37c4f");
  const toeXs = [38, 51, 65, 159, 173, 186];
  for (let index = 0; index < toeXs.length; index += 1) {
    const x = toeXs[index];
    pixelRect(x, 153 + (index % 2), 11, 4, "#3e291b");
    pixelRect(x + 2, 148 + (index % 2), 8, 4, "#c58c5a");
  }
  pixelRect(38, 119, 9, 21, "#4f3728");
  pixelRect(177, 119, 9, 21, "#4f3728");
  pixelRect(45, 116, 12, 24, "#8a6040");
  pixelRect(167, 116, 12, 24, "#8a6040");

  // Warts, freckles, and broken pixel patches add realism without smoothing away the pixel style.
  const wartSpots: Array<[number, number, number]> = [
    [76, 42, 5], [99, 46, 4], [122, 42, 5], [144, 49, 4],
    [69, 80, 3], [92, 72, 3], [116, 70, 3], [144, 78, 3],
    [51, 92, 4], [173, 92, 4], [86, 118, 3], [136, 118, 3],
    [58, 110, 3], [166, 110, 3], [105, 89, 2], [128, 91, 2],
  ];
  for (let index = 0; index < wartSpots.length; index += 1) {
    const [x, y, radius] = wartSpots[index];
    wart(x, y, radius, index % 2 === 0 ? "#7d5637" : "#9f7046");
  }

  const freckleSpots: Array<[number, number]> = [
    [90, 126], [101, 130], [117, 128], [130, 132], [74, 107],
    [150, 107], [96, 82], [128, 83], [112, 58], [82, 58],
    [142, 58], [92, 102], [132, 102], [99, 141], [122, 141],
  ];
  for (let index = 0; index < freckleSpots.length; index += 1) {
    const [x, y] = freckleSpots[index];
    pixelRect(x, y, index % 3 === 0 ? 4 : 3, 2, index % 2 === 0 ? "#6b4a31" : "#8f613b");
  }

  const highlightPatches: Array<[number, number, number, number, string]> = [
    [70, 86, 12, 3, "#e0b47c"], [142, 86, 12, 3, "#e0b47c"],
    [78, 62, 13, 3, "#f0c895"], [133, 62, 13, 3, "#f0c895"],
    [91, 111, 13, 3, "#f2cda5"], [120, 111, 13, 3, "#f2cda5"],
    [58, 134, 18, 3, "#c99461"], [148, 134, 18, 3, "#c99461"],
    [83, 151, 52, 3, "#4e3525"],
  ];
  for (let index = 0; index < highlightPatches.length; index += 1) {
    const [x, y, width, height, color] = highlightPatches[index];
    pixelRect(x, y, width, height, color);
  }

  return configurePixelSpriteTexture(new THREE.CanvasTexture(canvas));
}

function useSwampToadAnimationTextures(fallbackTexture: THREE.Texture) {
  const [textures, setTextures] = useState<SwampToadAnimationTextures>(() => ({
    idle: [fallbackTexture],
    yawn: [fallbackTexture],
    sleep: fallbackTexture,
    idleFrameMs: 220,
    yawnFrameMs: 130,
  }));

  useEffect(() => {
    let cancelled = false;
    const ownedTextures: THREE.Texture[] = [];
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");

    const loadTexture = (src: string) => new Promise<THREE.Texture>((resolve, reject) => {
      loader.load(
        src,
        (loadedTexture) => {
          configurePixelSpriteTexture(loadedTexture);
          ownedTextures.push(loadedTexture);
          resolve(loadedTexture);
        },
        undefined,
        reject,
      );
    });

    const loadOptionalTexture = async (src: string | undefined) => {
      if (!src) return fallbackTexture;
      try {
        return await loadTexture(src);
      } catch {
        return fallbackTexture;
      }
    };

    const loadFrameSet = async (srcs: string[] | undefined) => {
      if (!srcs?.length) return [fallbackTexture];
      const framePromises = new Array<Promise<THREE.Texture>>(srcs.length);
      for (let index = 0; index < srcs.length; index += 1) {
        framePromises[index] = loadOptionalTexture(srcs[index]);
      }
      const loadedFrames = await Promise.all(framePromises);
      let hasUsableFrame = false;
      for (let index = 0; index < loadedFrames.length; index += 1) {
        if (loadedFrames[index] !== fallbackTexture) {
          hasUsableFrame = true;
          break;
        }
      }
      return hasUsableFrame ? loadedFrames : [fallbackTexture];
    };

    const loadManifest = async () => {
      try {
        const response = await fetch(SWAMP_TOAD_MANIFEST_SRC, { cache: "no-cache" });
        if (!response.ok) throw new Error(`Unable to load swamp toad manifest: ${response.status}`);
        const manifest = await response.json() as SwampToadAnimationManifest;
        const [idle, yawn, sleep] = await Promise.all([
          loadFrameSet(manifest.idle),
          loadFrameSet(manifest.yawn),
          loadOptionalTexture(manifest.sleep),
        ]);

        if (cancelled) {
          return;
        }
        setTextures({
          idle,
          yawn,
          sleep,
          idleFrameMs: Math.max(80, manifest.idleFrameMs ?? 220),
          yawnFrameMs: Math.max(80, manifest.yawnFrameMs ?? 130),
        });
      } catch {
        if (!cancelled) {
          setTextures({
            idle: [fallbackTexture],
            yawn: [fallbackTexture],
            sleep: fallbackTexture,
            idleFrameMs: 220,
            yawnFrameMs: 130,
          });
        }
      }
    };

    void loadManifest();

    return () => {
      cancelled = true;
      for (let index = 0; index < ownedTextures.length; index += 1) {
        ownedTextures[index].dispose();
      }
    };
  }, [fallbackTexture]);

  return textures;
}

function SwampVillageWater({ layout, showDetails }: { layout: SwampVillageLayout; showDetails: boolean }) {
  const lilyGeometry = useMemo(() => makeSwampLilyPadGeometry(), []);

  return (
    <>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, layout.waterY - 0.08, 0]}
        scale={[SWAMP_VILLAGE_RADIUS + 72, SWAMP_VILLAGE_RADIUS + 48, 1]}
        renderOrder={-2}
      >
        <circleGeometry args={[1, 28]} />
        <meshBasicMaterial color="#253d2f" transparent opacity={0.72} depthWrite={false} />
      </mesh>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, layout.waterY + 0.02, 0]}
        scale={[SWAMP_VILLAGE_RADIUS + 50, SWAMP_VILLAGE_RADIUS + 30, 1]}
        renderOrder={-1}
      >
        <circleGeometry args={[1, 28]} />
        <meshBasicMaterial color="#1f5d58" transparent opacity={0.82} depthWrite={false} />
      </mesh>
      {showDetails && SWAMP_WATER_RIPPLE_INDICES.map((index) => {
        const angle = (index * Math.PI * 2) / 10 + 0.34;
        const radius = 34 + (index % 5) * 28;
        return (
          <mesh
            key={`swamp-water-ripple-${index}`}
            rotation={[-Math.PI / 2, 0, 0]}
            position={[Math.sin(angle) * radius, layout.waterY + 0.055, Math.cos(angle) * radius]}
            scale={[10 + (index % 3) * 4, 7 + (index % 4) * 2, 1]}
            renderOrder={0}
          >
            <ringGeometry args={[0.82, 1, 18]} />
            <meshBasicMaterial color="#8ad4c6" transparent opacity={0.18} depthWrite={false} />
          </mesh>
        );
      })}
      {layout.lilyPads.map((pad) => (
        <group key={pad.key} position={[pad.localX, layout.waterY + 0.26, pad.localZ]} rotation={[0, pad.rotation, 0]}>
          <mesh geometry={lilyGeometry} scale={[pad.scale * 1.28, 1, pad.scale]} renderOrder={1}>
            <meshBasicMaterial color={pad.color} />
          </mesh>
          {showDetails && (
            <>
              <mesh position={[pad.scale * 0.05, 0.13, 0]} castShadow={false}>
                <boxGeometry args={[pad.scale * 1.1, 0.08, 0.1]} />
                <meshBasicMaterial color="#b0d779" transparent opacity={0.74} />
              </mesh>
              <mesh position={[pad.scale * 0.06, 0.14, pad.scale * 0.16]} rotation={[0, 0.58, 0]} castShadow={false}>
                <boxGeometry args={[pad.scale * 0.62, 0.07, 0.08]} />
                <meshBasicMaterial color="#b0d779" transparent opacity={0.66} />
              </mesh>
              <mesh position={[pad.scale * 0.04, 0.14, -pad.scale * 0.18]} rotation={[0, -0.58, 0]} castShadow={false}>
                <boxGeometry args={[pad.scale * 0.58, 0.07, 0.08]} />
                <meshBasicMaterial color="#b0d779" transparent opacity={0.62} />
              </mesh>
            </>
          )}
          {pad.scale > 13 && (
            <mesh position={[pad.scale * 0.08, 0.12, -pad.scale * 0.12]} rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[0.72, 7]} />
              <meshBasicMaterial color="#e8b4d8" />
            </mesh>
          )}
        </group>
      ))}
      {layout.stumps.map((stump) => (
        <group key={stump.key} position={[stump.localX, layout.waterY, stump.localZ]}>
          <mesh position={[0, stump.height / 2, 0]} castShadow={false}>
            <cylinderGeometry args={[stump.radius * 0.8, stump.radius, stump.height, 7]} />
            <meshBasicMaterial color="#2f2417" />
          </mesh>
          <mesh position={[0, stump.height + 0.14, 0]} castShadow={false}>
            <cylinderGeometry args={[stump.radius * 0.9, stump.radius * 0.9, 0.28, 7]} />
            <meshBasicMaterial color="#5a4022" />
          </mesh>
        </group>
      ))}
      {showDetails && layout.reeds.map((reed) => (
        <SwampVillageReedPatch key={reed.key} reed={reed} waterY={layout.waterY} />
      ))}
    </>
  );
}

function SwampVillageReedPatch({ reed, waterY }: { reed: SwampVillageReedPatchDescriptor; waterY: number }) {
  return (
    <group position={[reed.localX, waterY + 0.12, reed.localZ]} rotation={[0, reed.rotation, 0]} scale={[reed.scale, reed.scale, reed.scale]}>
      {SWAMP_REED_STEM_INDICES.map((index) => {
        const offsetX = (index - 2) * 0.82 + (index % 2 === 0 ? 0.22 : -0.12);
        const offsetZ = (index % 3 - 1) * 0.58;
        const height = 4.2 + index * 0.72;
        return (
          <group key={index} position={[offsetX, 0, offsetZ]} rotation={[0.03 * (index - 2), 0, 0.08 * (index % 2 === 0 ? 1 : -1)]}>
            <mesh position={[0, height / 2, 0]} castShadow={false}>
              <cylinderGeometry args={[0.08, 0.16, height, 5]} />
              <meshBasicMaterial color={index % 2 === 0 ? "#465a28" : "#5e7434"} />
            </mesh>
            {index % 2 === 0 && (
              <mesh position={[0, height + 0.28, 0]} castShadow={false}>
                <cylinderGeometry args={[0.16, 0.2, 0.85, 6]} />
                <meshBasicMaterial color="#5a3620" />
              </mesh>
            )}
          </group>
        );
      })}
    </group>
  );
}

function SwampVillageRopeLights({ layout, showDetails }: { layout: SwampVillageLayout; showDetails: boolean }) {
  const ropeSegments = useMemo(() => {
    if (!showDetails) return [];
    return getSwampVillageRopeLightSegments(layout.ropes);
  }, [layout.ropes, showDetails]);

  const ropeBulbs = useMemo(() => {
    if (!showDetails) return [];
    return getSwampVillageRopeLightBulbs(layout.ropes);
  }, [layout.ropes, showDetails]);

  if (!showDetails || layout.ropes.length === 0) return null;

  return (
    <group name="swamp-village-rope-lights">
      {ropeSegments.map((segment) => (
        <mesh key={segment.key} position={segment.position} quaternion={segment.quaternion} castShadow={false}>
          <cylinderGeometry args={[0.16, 0.18, segment.length, 5]} />
          <meshBasicMaterial color="#2a1a0f" />
        </mesh>
      ))}
      {ropeBulbs.map((bulb) => (
        <group key={bulb.key}>
          <mesh position={bulb.cordPosition} castShadow={false}>
            <cylinderGeometry args={[0.045, 0.055, bulb.cordLength, 5]} />
            <meshBasicMaterial color="#1b120a" />
          </mesh>
          <mesh position={bulb.position} castShadow={false}>
            <sphereGeometry args={[0.58, 8, 6]} />
            <meshBasicMaterial color={bulb.color} transparent opacity={0.96} />
          </mesh>
          <mesh position={bulb.position} castShadow={false}>
            <sphereGeometry args={[1.45, 10, 8]} />
            <meshBasicMaterial color={bulb.color} transparent opacity={0.18} depthWrite={false} blending={THREE.AdditiveBlending} />
          </mesh>
          {bulb.hasPointLight && (
            <pointLight position={bulb.position} color={bulb.color} intensity={0.28} distance={18} decay={2} />
          )}
        </group>
      ))}
    </group>
  );
}

function SwampGiantToad({ layout }: { layout: SwampVillageLayout }) {
  const spriteRef = useRef<THREE.Sprite>(null);
  const sleepZRef = useRef<THREE.Sprite>(null);
  const materialRef = useRef<THREE.SpriteMaterial>(null);
  const sleepZMaterialRef = useRef<THREE.SpriteMaterial>(null);
  const mobilePerformanceMode = useMemo(() => isMobilePerformanceMode(), []);
  const lastToadUpdateAtRef = useRef(Number.NEGATIVE_INFINITY);
  const fallbackTexture = useMemo(() => makeSwampToadTexture(false), []);
  const sleepZTexture = useMemo(() => makeSwampToadSleepZTexture(), []);
  const toadTextures = useSwampToadAnimationTextures(fallbackTexture);
  const survivalTimeOverrideSeconds = useGameStore(s => s.survivalTimeOverrideSeconds);
  const cycleScratch = useMemo(createSurvivalDayNightCycle, []);
  const stateRef = useRef<{
    sleeping: boolean;
    nightCue: boolean;
    yawnStartedAt: number;
    yawnUntil: number;
    texture: THREE.Texture | null;
    mode: "idle" | "yawn" | "sleep";
  }>({
    sleeping: false,
    nightCue: false,
    yawnStartedAt: -Infinity,
    yawnUntil: -Infinity,
    texture: null,
    mode: "idle",
  });

  useFrame((state) => {
    const animationElapsedSeconds = state.clock.elapsedTime;
    if (
      mobilePerformanceMode &&
      animationElapsedSeconds - lastToadUpdateAtRef.current < MOBILE_SWAMP_TOAD_UPDATE_INTERVAL_SECONDS
    ) {
      return;
    }
    lastToadUpdateAtRef.current = animationElapsedSeconds;

    const cycleElapsedSeconds = getEffectiveSurvivalCycleElapsedSeconds(survivalTimeOverrideSeconds, animationElapsedSeconds);
    const cycle = getSurvivalDayNightCycleInto(cycleElapsedSeconds, cycleScratch);
    const nightCue = cycle.nightAmount > 0.42;
    const sleeping = cycle.nightAmount > 0.68;
    const yawnDuration = Math.max(2.6, (toadTextures.yawn.length * toadTextures.yawnFrameMs * 2.1) / 1000);
    const startYawn = () => {
      stateRef.current.yawnStartedAt = animationElapsedSeconds;
      stateRef.current.yawnUntil = animationElapsedSeconds + yawnDuration;
    };

    if (nightCue && !stateRef.current.nightCue) {
      startYawn();
    } else if (stateRef.current.sleeping && !sleeping) {
      startYawn();
    }
    stateRef.current.nightCue = nightCue;

    const yawning = animationElapsedSeconds < stateRef.current.yawnUntil;
    let mode: "idle" | "yawn" | "sleep" = "idle";
    let currentTexture = toadTextures.idle[
      Math.floor((animationElapsedSeconds * 1000) / toadTextures.idleFrameMs) % toadTextures.idle.length
    ] ?? fallbackTexture;

    if (yawning) {
      mode = "yawn";
      const yawnElapsedMs = Math.max(0, (animationElapsedSeconds - stateRef.current.yawnStartedAt) * 1000);
      const yawnIndex = Math.min(
        toadTextures.yawn.length - 1,
        Math.floor(yawnElapsedMs / (toadTextures.yawnFrameMs * 2.1)),
      );
      currentTexture = toadTextures.yawn[yawnIndex] ?? currentTexture;
    } else if (sleeping) {
      mode = "sleep";
      currentTexture = toadTextures.sleep;
    }

    if (
      materialRef.current
      && (
        stateRef.current.sleeping !== sleeping
        || stateRef.current.mode !== mode
        || stateRef.current.texture !== currentTexture
      )
    ) {
      materialRef.current.map = currentTexture;
      materialRef.current.needsUpdate = true;
      stateRef.current.sleeping = sleeping;
      stateRef.current.texture = currentTexture;
      stateRef.current.mode = mode;
    }

    if (spriteRef.current) {
      const breathWave = (Math.sin(animationElapsedSeconds * (sleeping ? 0.82 : 1.12)) + 1) * 0.5;
      const baseWidth = 56;
      const baseHeight = 36;
      const breathWidth = sleeping ? 1.8 : 2.2;
      const breathHeight = sleeping ? 0.7 : 1.35;
      const squat = sleeping ? 0.84 : 1;
      const currentHeight = (baseHeight * squat) + breathWave * breathHeight;
      const plantedBottomY = layout.platformY + 0.12;
      spriteRef.current.position.y = plantedBottomY + currentHeight / 2;
      spriteRef.current.scale.set(
        baseWidth + breathWave * breathWidth,
        currentHeight,
        1,
      );
    }

    if (sleepZRef.current && sleepZMaterialRef.current) {
      const sleepFade = yawning ? 0 : THREE.MathUtils.clamp((cycle.nightAmount - 0.68) / 0.22, 0, 1);
      const drift = (animationElapsedSeconds * 0.34) % 1;
      const bob = Math.sin(animationElapsedSeconds * 1.6) * 0.38;
      sleepZRef.current.visible = sleepFade > 0.02;
      sleepZRef.current.position.set(17.5 + drift * 3.5, layout.platformY + 38.5 + drift * 5.2 + bob, 0);
      sleepZRef.current.scale.set(12.5 + sleepFade * 2.5, 7.5 + sleepFade * 1.5, 1);
      sleepZMaterialRef.current.opacity = sleepFade * (0.62 + 0.28 * (1 - drift));
    }
  });

  return (
    <group name="swamp-giant-toad">
      <mesh position={[0, layout.platformY + 0.58, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow={false}>
        <circleGeometry args={[22, 20]} />
        <meshBasicMaterial color="#1b2a16" transparent opacity={0.52} depthWrite={false} />
      </mesh>
      <sprite ref={spriteRef} position={[0, layout.platformY + 18.12, 0]} scale={[56, 36, 1]} frustumCulled={false}>
        <spriteMaterial ref={materialRef} map={toadTextures.idle[0] ?? fallbackTexture} transparent depthWrite={false} />
      </sprite>
      <sprite ref={sleepZRef} position={[17.5, layout.platformY + 38.5, 0]} scale={[14, 8.5, 1]} frustumCulled={false} visible={false}>
        <spriteMaterial
          ref={sleepZMaterialRef}
          map={sleepZTexture}
          transparent
          opacity={0}
          depthWrite={false}
        />
      </sprite>
    </group>
  );
}

function SwampVillageWalkway({ walkway, waterY }: { walkway: SwampVillageWalkwayDescriptor; waterY: number }) {
  const stiltHeight = Math.max(0.4, walkway.y - waterY);
  const supportCount = Math.max(2, Math.min(7, Math.floor(walkway.length / 28)));

  return (
    <group position={[walkway.localX, 0, walkway.localZ]} rotation={[0, walkway.rotation, 0]}>
      <mesh position={[0, walkway.y, 0]} castShadow={false} receiveShadow>
        <boxGeometry args={[walkway.width, 0.82, walkway.length]} />
        <meshBasicMaterial color="#4a301d" />
      </mesh>
      {getCachedIndexRange(Math.max(4, Math.floor(walkway.length / 9))).map((index) => {
        const z = -walkway.length / 2 + (index + 0.5) * (walkway.length / Math.max(4, Math.floor(walkway.length / 9)));
        return (
          <mesh key={index} position={[0, walkway.y + 0.5, z]} castShadow={false}>
            <boxGeometry args={[walkway.width + 1.1, 0.22, 1.7]} />
            <meshBasicMaterial color={index % 2 === 0 ? "#6a4729" : "#5a3a22"} />
          </mesh>
        );
      })}
      {SWAMP_SIDE_SIGNS.map((side) => (
        <mesh key={`rail-${side}`} position={[side * (walkway.width * 0.52), walkway.y + 1.15, 0]} castShadow={false}>
          <boxGeometry args={[0.42, 0.48, walkway.length * 0.96]} />
          <meshBasicMaterial color={SWAMP_DARK_WOOD} />
        </mesh>
      ))}
      {getCachedIndexRange(Math.max(3, Math.floor(walkway.length / 34))).map((index) => {
        const z = -walkway.length / 2 + 12 + index * (walkway.length / Math.max(3, Math.floor(walkway.length / 34)));
        const x = (index % 2 === 0 ? -1 : 1) * walkway.width * 0.22;
        return (
          <mesh key={`moss-${index}`} position={[x, walkway.y + 0.66, z]} castShadow={false}>
            <boxGeometry args={[walkway.width * 0.28, 0.1, 5.5]} />
            <meshBasicMaterial color={SWAMP_MOSS_COLORS[index % SWAMP_MOSS_COLORS.length]} transparent opacity={0.88} />
          </mesh>
        );
      })}
      {getCachedIndexRange(supportCount).map((index) => {
        const z = -walkway.length / 2 + (index + 0.5) * (walkway.length / supportCount);
        return SWAMP_SIDE_SIGNS.map((side) => (
          <mesh key={`${index}-${side}`} position={[side * (walkway.width * 0.42), waterY + stiltHeight / 2, z]} castShadow={false}>
            <cylinderGeometry args={[0.42, 0.54, stiltHeight, 6]} />
            <meshBasicMaterial color="#2d1c10" />
          </mesh>
        ));
      })}
    </group>
  );
}

function SwampVillageRamp({ ramp }: { ramp: SwampVillageRampDescriptor }) {
  const slope = Math.atan2(ramp.highY - ramp.lowY, ramp.length);
  const centerY = (ramp.highY + ramp.lowY) / 2;
  const plankCount = Math.max(4, Math.floor(ramp.length / 8));

  return (
    <group position={[ramp.localX, centerY, ramp.localZ]} rotation={[0, ramp.rotation, 0]}>
      <group rotation={[slope, 0, 0]}>
        <mesh castShadow={false} receiveShadow>
          <boxGeometry args={[ramp.width, 0.78, ramp.length]} />
          <meshBasicMaterial color="#4a301d" />
        </mesh>
        {getCachedIndexRange(plankCount).map((index) => {
          const z = -ramp.length / 2 + (index + 0.5) * (ramp.length / plankCount);
          return (
            <mesh key={index} position={[0, 0.48, z]} castShadow={false}>
              <boxGeometry args={[ramp.width + 1.4, 0.18, 1.75]} />
              <meshBasicMaterial color={index % 2 === 0 ? "#6a4729" : "#5a3a22"} />
            </mesh>
          );
        })}
        {SWAMP_SIDE_SIGNS.map((side) => (
          <mesh key={`ramp-rail-${side}`} position={[side * (ramp.width * 0.54), 1.08, 0]} castShadow={false}>
            <boxGeometry args={[0.46, 0.46, ramp.length * 0.92]} />
            <meshBasicMaterial color={SWAMP_DARK_WOOD} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function SwampStiltHut({ hut, waterY, showDetails }: { hut: SwampVillageHut; waterY: number; showDetails: boolean }) {
  const wallThickness = Math.min(1.1, hut.width * 0.12, hut.depth * 0.12);
  const doorWidth = Math.min(5.3, hut.width - wallThickness * 4);
  const doorHeight = Math.min(7.1, hut.height - 1.2);
  const frontWallWidth = Math.max(1.1, (hut.width - doorWidth) / 2);
  const lintelHeight = Math.max(0.85, hut.height - doorHeight);
  const stiltHeight = Math.max(0.5, hut.platformY - waterY);
  const roofRadius = Math.max(hut.width, hut.depth) * 0.72;

  if (!showDetails) {
    return (
      <group position={[hut.localX, 0, hut.localZ]} rotation={[0, hut.rotation, 0]}>
        <mesh position={[0, hut.platformY + hut.height / 2, 0]} castShadow={false}>
          <boxGeometry args={[hut.width, hut.height, hut.depth]} />
          <meshBasicMaterial color={hut.wallColor} />
        </mesh>
        <mesh position={[0, hut.platformY + hut.height + 2.4, 0]} rotation={[0, Math.PI / 4, 0]} castShadow={false}>
          <coneGeometry args={[roofRadius, 5.2, 4]} />
          <meshBasicMaterial color={hut.roofColor} />
        </mesh>
      </group>
    );
  }

  return (
    <group position={[hut.localX, 0, hut.localZ]} rotation={[0, hut.rotation, 0]}>
      {SWAMP_HUT_STILT_CORNERS.map(([xSign, zSign]) => (
        <mesh
          key={`${xSign}:${zSign}`}
          position={[xSign * hut.width * 0.42, waterY + stiltHeight / 2, zSign * hut.depth * 0.42]}
          castShadow={false}
        >
          <cylinderGeometry args={[0.54, 0.82, stiltHeight, 6]} />
          <meshBasicMaterial color="#24170d" />
        </mesh>
      ))}
      <mesh position={[0, hut.platformY, 0]} castShadow={false} receiveShadow>
        <boxGeometry args={[hut.width + 4.8, 1, hut.depth + 4.8]} />
        <meshBasicMaterial color="#3e2817" />
      </mesh>
      <mesh position={[0, hut.platformY + 0.72, 0]} castShadow={false}>
        <boxGeometry args={[hut.width + 5.6, 0.32, hut.depth + 5.6]} />
        <meshBasicMaterial color="#6b4828" />
      </mesh>
      <mesh position={[-hut.width / 2 + wallThickness / 2, hut.platformY + hut.height / 2, 0]} castShadow={false} receiveShadow>
        <boxGeometry args={[wallThickness, hut.height, hut.depth]} />
        <meshBasicMaterial color={hut.wallColor} />
      </mesh>
      <mesh position={[hut.width / 2 - wallThickness / 2, hut.platformY + hut.height / 2, 0]} castShadow={false} receiveShadow>
        <boxGeometry args={[wallThickness, hut.height, hut.depth]} />
        <meshBasicMaterial color={hut.wallColor} />
      </mesh>
      <mesh position={[0, hut.platformY + hut.height / 2, -hut.depth / 2 + wallThickness / 2]} castShadow={false} receiveShadow>
        <boxGeometry args={[hut.width, hut.height, wallThickness]} />
        <meshBasicMaterial color={hut.wallColor} />
      </mesh>
      <mesh position={[-doorWidth / 2 - frontWallWidth / 2, hut.platformY + hut.height / 2, hut.depth / 2 - wallThickness / 2]} castShadow={false} receiveShadow>
        <boxGeometry args={[frontWallWidth, hut.height, wallThickness]} />
        <meshBasicMaterial color={hut.wallColor} />
      </mesh>
      <mesh position={[doorWidth / 2 + frontWallWidth / 2, hut.platformY + hut.height / 2, hut.depth / 2 - wallThickness / 2]} castShadow={false} receiveShadow>
        <boxGeometry args={[frontWallWidth, hut.height, wallThickness]} />
        <meshBasicMaterial color={hut.wallColor} />
      </mesh>
      <mesh position={[0, hut.platformY + doorHeight + lintelHeight / 2, hut.depth / 2 - wallThickness / 2]} castShadow={false} receiveShadow>
        <boxGeometry args={[doorWidth, lintelHeight, wallThickness]} />
        <meshBasicMaterial color={hut.wallColor} />
      </mesh>
      <mesh position={[0, hut.platformY + doorHeight / 2, hut.depth / 2 + 0.16]} castShadow={false}>
        <boxGeometry args={[doorWidth * 0.82, doorHeight, 0.34]} />
        <meshBasicMaterial color="#1c140d" />
      </mesh>
      <mesh position={[-hut.width * 0.28, hut.platformY + Math.min(hut.height - 2, 6.1), hut.depth / 2 + 0.18]} castShadow={false}>
        <boxGeometry args={[3.2, 2.5, 0.38]} />
        <meshBasicMaterial color="#91d7b7" />
      </mesh>
      <mesh position={[hut.width * 0.28, hut.platformY + Math.min(hut.height - 2, 6.1), hut.depth / 2 + 0.18]} castShadow={false}>
        <boxGeometry args={[3.2, 2.5, 0.38]} />
        <meshBasicMaterial color="#91d7b7" />
      </mesh>
      {SWAMP_SIDE_SIGNS.map((side) => (
        <mesh key={`side-window-${side}`} position={[side * (hut.width / 2 + 0.18), hut.platformY + Math.min(hut.height - 2.1, 6.2), -hut.depth * 0.12]} castShadow={false}>
          <boxGeometry args={[0.36, 2.3, 3.25]} />
          <meshBasicMaterial color="#6cb69d" />
        </mesh>
      ))}
      {getCachedIndexRange(Math.max(3, Math.floor(hut.width / 4))).map((index) => {
        const count = Math.max(3, Math.floor(hut.width / 4));
        const x = -hut.width / 2 + (index + 0.5) * (hut.width / count);
        return (
          <mesh key={`front-plank-${index}`} position={[x, hut.platformY + hut.height * 0.52, hut.depth / 2 + 0.24]} castShadow={false}>
            <boxGeometry args={[0.18, hut.height * 0.76, 0.22]} />
            <meshBasicMaterial color={SWAMP_DARK_WOOD} transparent opacity={0.5} />
          </mesh>
        );
      })}
      {SWAMP_SIDE_SIGNS.map((side) => (
        <mesh key={`wet-band-side-${side}`} position={[side * (hut.width / 2 + 0.2), hut.platformY + 1.55, 0]} castShadow={false}>
          <boxGeometry args={[0.32, 1.15, hut.depth * 0.9]} />
          <meshBasicMaterial color={SWAMP_WET_WOOD} transparent opacity={0.72} />
        </mesh>
      ))}
      <mesh position={[0, hut.platformY + 1.5, hut.depth / 2 + 0.27]} castShadow={false}>
        <boxGeometry args={[hut.width * 0.9, 1.1, 0.26]} />
        <meshBasicMaterial color={SWAMP_WET_WOOD} transparent opacity={0.72} />
      </mesh>
      <mesh position={[0, hut.platformY + hut.height + 2.4, 0]} rotation={[0, Math.PI / 4, 0]} castShadow={false}>
        <coneGeometry args={[roofRadius, 5.2, 4]} />
        <meshBasicMaterial color={hut.roofColor} />
      </mesh>
      <mesh position={[0, hut.platformY + hut.height + 0.45, 0]} castShadow={false}>
        <boxGeometry args={[hut.width + 3.2, 0.58, hut.depth + 3.2]} />
        <meshBasicMaterial color="#18220f" />
      </mesh>
      {getCachedIndexRange(6).map((index) => {
        const side = index % 2 === 0 ? -1 : 1;
        const x = -hut.width * 0.38 + index * (hut.width * 0.15);
        const vineLength = 2.4 + (index % 3) * 0.9;
        return (
          <mesh key={`roof-vine-${index}`} position={[x, hut.platformY + hut.height + 0.08 - vineLength / 2, side * (hut.depth / 2 + 1.15)]} castShadow={false}>
            <boxGeometry args={[0.18, vineLength, 0.18]} />
            <meshBasicMaterial color={SWAMP_MOSS_COLORS[index % SWAMP_MOSS_COLORS.length]} />
          </mesh>
        );
      })}
    </group>
  );
}

function SwampVillageColliders({
  chunk,
  layout,
  groundGeometry,
}: {
  chunk: SurvivalChunkInfo;
  layout: SwampVillageLayout;
  groundGeometry: THREE.BufferGeometry;
}) {
  if (!shouldBuildSurvivalChunkColliders(chunk)) return null;

  return (
    <>
      <RigidBody type="fixed" colliders="trimesh" friction={0.2} restitution={0} position={[chunk.x, 0, chunk.z]}>
        <mesh geometry={groundGeometry} dispose={null}>
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </RigidBody>
      <RigidBody type="fixed" colliders={false} friction={0.32} restitution={0} position={[chunk.x, 0, chunk.z]}>
        <CuboidCollider args={[SWAMP_VILLAGE_PLATFORM_SIZE / 2, 0.48, SWAMP_VILLAGE_PLATFORM_SIZE / 2]} position={[0, layout.platformY, 0]} />
        {layout.walkways.map((walkway) => (
          <CuboidCollider
            key={`${walkway.key}-collider`}
            args={[walkway.width / 2, 0.42, walkway.length / 2]}
            position={[walkway.localX, walkway.y, walkway.localZ]}
            rotation={[0, walkway.rotation, 0]}
          />
        ))}
        {layout.ramps.map((ramp) => {
          const slope = Math.atan2(ramp.highY - ramp.lowY, ramp.length);
          return (
            <group key={`${ramp.key}-collider`} position={[ramp.localX, 0, ramp.localZ]} rotation={[0, ramp.rotation, 0]}>
              <CuboidCollider
                args={[ramp.width / 2, 0.4, ramp.length / 2]}
                position={[0, (ramp.highY + ramp.lowY) / 2, 0]}
                rotation={[slope, 0, 0]}
              />
            </group>
          );
        })}
        {layout.huts.map((hut) => {
          const wallThickness = Math.min(1.1, hut.width * 0.12, hut.depth * 0.12);
          const doorWidth = Math.min(5.3, hut.width - wallThickness * 4);
          const doorHeight = Math.min(7.1, hut.height - 1.2);
          const frontWallWidth = Math.max(1.1, (hut.width - doorWidth) / 2);
          const lintelHeight = Math.max(0.85, hut.height - doorHeight);

          return (
            <group key={`${hut.key}-colliders`} position={[hut.localX, 0, hut.localZ]} rotation={[0, hut.rotation, 0]}>
              <CuboidCollider args={[hut.width / 2 + 2.2, 0.5, hut.depth / 2 + 2.2]} position={[0, hut.platformY, 0]} />
              <CuboidCollider args={[wallThickness / 2, hut.height / 2, hut.depth / 2]} position={[-hut.width / 2 + wallThickness / 2, hut.platformY + hut.height / 2, 0]} />
              <CuboidCollider args={[wallThickness / 2, hut.height / 2, hut.depth / 2]} position={[hut.width / 2 - wallThickness / 2, hut.platformY + hut.height / 2, 0]} />
              <CuboidCollider args={[hut.width / 2, hut.height / 2, wallThickness / 2]} position={[0, hut.platformY + hut.height / 2, -hut.depth / 2 + wallThickness / 2]} />
              <CuboidCollider args={[frontWallWidth / 2, hut.height / 2, wallThickness / 2]} position={[-doorWidth / 2 - frontWallWidth / 2, hut.platformY + hut.height / 2, hut.depth / 2 - wallThickness / 2]} />
              <CuboidCollider args={[frontWallWidth / 2, hut.height / 2, wallThickness / 2]} position={[doorWidth / 2 + frontWallWidth / 2, hut.platformY + hut.height / 2, hut.depth / 2 - wallThickness / 2]} />
              <CuboidCollider args={[doorWidth / 2, lintelHeight / 2, wallThickness / 2]} position={[0, hut.platformY + doorHeight + lintelHeight / 2, hut.depth / 2 - wallThickness / 2]} />
            </group>
          );
        })}
      </RigidBody>
    </>
  );
}

function useSwampVillageDetailPhase(active: boolean, chunkKey: string) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (!active) {
      setPhase(0);
      return;
    }

    setPhase(0);
    const waterAndPlatform = window.setTimeout(() => setPhase(1), 120);
    const hutDetails = window.setTimeout(() => setPhase(2), 460);
    const finishing = window.setTimeout(() => setPhase(3), 920);
    return () => {
      window.clearTimeout(waterAndPlatform);
      window.clearTimeout(hutDetails);
      window.clearTimeout(finishing);
    };
  }, [active, chunkKey]);

  return phase;
}

export function SurvivalSwampVillage({
  chunk,
  villageBaseHeightForChunk,
  makeVillagePadGeometry,
  makeVillagePadSkirtGeometry,
  getWaterLevelAtWorld,
}: {
  chunk: SurvivalChunkInfo;
  villageBaseHeightForChunk: SurvivalVillageBaseHeightForChunk;
  makeVillagePadGeometry: SurvivalVillageGeometryFactory;
  makeVillagePadSkirtGeometry: SurvivalVillageGeometryFactory;
  getWaterLevelAtWorld: SwampVillageWaterLevelAtWorld;
}) {
  const villageBaseHeight = useMemo(() => villageBaseHeightForChunk(chunk), [chunk, villageBaseHeightForChunk]);
  const villagePadGeometry = useMemo(() => makeVillagePadGeometry(chunk), [chunk, makeVillagePadGeometry]);
  const hasVillagePadSkirt = shouldRenderSurvivalChunkSkirt(chunk);
  const villagePadSkirtGeometry = useMemo(
    () => hasVillagePadSkirt ? makeVillagePadSkirtGeometry(chunk) : null,
    [chunk, hasVillagePadSkirt, makeVillagePadSkirtGeometry]
  );
  const villagePadCollisionGeometry = useMemo(() => makeVillagePadGeometry(chunk), [chunk, makeVillagePadGeometry]);
  const layout = useMemo(
    () => makeSwampVillageLayout(chunk, villageBaseHeight, getWaterLevelAtWorld),
    [chunk, getWaterLevelAtWorld, villageBaseHeight],
  );
  const terrainDetailTexture = useMemo(() => getSurvivalTerrainDetailTexture(), []);
  const showNearDetails = chunk.distance === 0;
  const detailPhase = useSwampVillageDetailPhase(showNearDetails, chunk.key);
  const showWaterAndPlatformDetails = showNearDetails && detailPhase >= 1;
  const showHutDetails = showNearDetails && detailPhase >= 2;
  const showFinishingDetails = showNearDetails && detailPhase >= 3;
  useSurvivalFeatureCount(
    "swampVillageHuts",
    `survival-swamp-village-huts-${chunk.key}`,
    layout.huts.length,
  );

  return (
    <>
      <SwampVillageColliders chunk={chunk} layout={layout} groundGeometry={villagePadCollisionGeometry} />
      <group name={`survival-swamp-village-${chunk.key}`} position={[chunk.x, 0, chunk.z]}>
        {villagePadSkirtGeometry && (
          <mesh geometry={villagePadSkirtGeometry} dispose={null}>
            <meshBasicMaterial vertexColors side={THREE.DoubleSide} />
          </mesh>
        )}
        <mesh geometry={villagePadGeometry} dispose={null} receiveShadow>
          <meshStandardMaterial vertexColors map={terrainDetailTexture} color="#35492e" roughness={1} />
        </mesh>
        <SwampVillageWater layout={layout} showDetails={showWaterAndPlatformDetails} />
        <mesh position={[0, layout.platformY, 0]} castShadow={false} receiveShadow>
          <boxGeometry args={[SWAMP_VILLAGE_PLATFORM_SIZE, 1.1, SWAMP_VILLAGE_PLATFORM_SIZE]} />
          <meshBasicMaterial color="#3d2818" />
        </mesh>
        <mesh position={[0, layout.platformY + 0.7, 0]} castShadow={false}>
          <boxGeometry args={[SWAMP_VILLAGE_PLATFORM_SIZE + 4.8, 0.32, SWAMP_VILLAGE_PLATFORM_SIZE + 4.8]} />
          <meshBasicMaterial color="#6a4729" />
        </mesh>
        {showWaterAndPlatformDetails && SWAMP_PLATFORM_PLANK_INDICES.map((index) => (
          <mesh key={`swamp-platform-plank-${index}`} position={[0, layout.platformY + 0.9, -SWAMP_VILLAGE_PLATFORM_SIZE / 2 + (index + 0.5) * (SWAMP_VILLAGE_PLATFORM_SIZE / 9)]} castShadow={false}>
            <boxGeometry args={[SWAMP_VILLAGE_PLATFORM_SIZE + 5.8, 0.14, 1.1]} />
            <meshBasicMaterial color={index % 2 === 0 ? "#7b5730" : "#4e331d"} transparent opacity={0.86} />
          </mesh>
        ))}
        {showWaterAndPlatformDetails && SWAMP_PLATFORM_MOSS_INDICES.map((index) => {
          const angle = (index * Math.PI * 2) / 8;
          return (
            <mesh key={`swamp-platform-moss-${index}`} position={[Math.sin(angle) * 24, layout.platformY + 1.02, Math.cos(angle) * 24]} rotation={[0, angle, 0]} castShadow={false}>
              <boxGeometry args={[8.5, 0.12, 3.4]} />
              <meshBasicMaterial color={SWAMP_MOSS_COLORS[index % SWAMP_MOSS_COLORS.length]} transparent opacity={0.74} />
            </mesh>
          );
        })}
        {showFinishingDetails && <SwampGiantToad layout={layout} />}
        {layout.walkways.map((walkway) => (
          <SwampVillageWalkway key={walkway.key} walkway={walkway} waterY={layout.waterY} />
        ))}
        {layout.ramps.map((ramp) => (
          <SwampVillageRamp key={ramp.key} ramp={ramp} />
        ))}
        {layout.huts.map((hut) => (
          <SwampStiltHut key={hut.key} hut={hut} waterY={layout.waterY} showDetails={showHutDetails} />
        ))}
        <SwampVillageRopeLights layout={layout} showDetails={showFinishingDetails} />
      </group>
      {showFinishingDetails && (
        <Villagers
          key={`survival-swamp-villagers-${chunk.key}`}
          huts={layout.hutInfos}
          name={`survival-swamp-villagers-${chunk.key}`}
        />
      )}
    </>
  );
}
