import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Physics, RigidBody, CuboidCollider, CylinderCollider } from "@react-three/rapier";
import { Sky, Environment } from "@react-three/drei";
import { PlayerController } from "./PlayerController";
import { NetworkManager } from "./NetworkManager";
import { TreeHouseVillage } from "./TreeHouseVillage";
import { Campfire } from "./Campfire";
import { Fragment, Suspense, useMemo, useRef, useEffect, useState } from "react";
import type { CSSProperties } from "react";
import * as THREE from "three";
import { DAY_NIGHT_CYCLE_SECONDS, SURVIVAL_BLOCK_SIZE, type CharacterCustomization, type SurvivalBiome, useGameStore } from "../store/gameStore";

const checkIsHutCell = (x: number, z: number) => {
  const absX = Math.abs(x);
  const absZ = Math.abs(z);
  const R = Math.sqrt(x * x + z * z);

  if (absX >= 240 || absZ >= 240) return true; // Forest wall

  const isRoad = absX < 12 || absZ < 12;
  const isMoat = (R > 42 && R < 58) || (R > 125 && R < 145);
  const isCentralPlaza = R < 35;
  const isPath = (absX >= 32 && absX < 40) && R > 60 && R < 125 || (absZ >= 32 && absZ < 40) && R > 60 && R < 125; // Minor paths

  if (isRoad || isMoat || isCentralPlaza || isPath) return false;

  const cx = Math.floor((x + 256) / 16);
  const cz = Math.floor((z + 256) / 16);
  const hash = Math.sin(cx * 12.9898 + cz * 78.233) * 43758.5453;
  return (hash - Math.floor(hash)) <= 0.7; // 70% hut density in valid zones
};

export const getTerrainHeight = (x: number, z: number) => {
  const absX = Math.abs(x);
  const absZ = Math.abs(z);
  const R = Math.sqrt(x * x + z * z);

  const isRoad = absX < 12 || absZ < 12;
  if (isRoad) {
      if (R < 35) return -0.5; // Plaza
      if (R >= 35 && R <= 42) return 0.0;
      if (R > 42 && R < 58) return 0.5; // Bridge over inner moat
      if (R >= 58 && R <= 125) return 1.0;
      if (R > 125 && R < 145) return 1.5; // Bridge over outer moat
      return 2.0; 
  }

  if ((R > 42 && R < 58) || (R > 125 && R < 145)) {
      return -1.5; // Moat depth
  }

  if (R < 35) return -0.5; // Central plaza

  // Districts
  if (R >= 35 && R <= 42) return 0.0;
  if (R >= 58 && R <= 125) return 1.0;
  
  return 2.0; 
};

function CanvasResizeNudge() {
  const aspectRatio = useGameStore(s => s.aspectRatio);
  const { camera, gl, invalidate, setSize } = useThree();

  useEffect(() => {
    let raf = 0;
    let timeout = 0;
    const parent = gl.domElement.parentElement;

    const resizeCanvas = () => {
      raf = 0;
      if (!parent) return;

      const rect = parent.getBoundingClientRect();
      const width = Math.max(1, Math.round(rect.width));
      const height = Math.max(1, Math.round(rect.height));
      if (width <= 0 || height <= 0) return;

      setSize(width, height);
      if ((camera as THREE.PerspectiveCamera).isPerspectiveCamera) {
        const perspectiveCamera = camera as THREE.PerspectiveCamera;
        perspectiveCamera.aspect = width / height;
        perspectiveCamera.far = SURVIVAL_BLOCK_SIZE * 18;
        perspectiveCamera.updateProjectionMatrix();
      }
      invalidate();
    };

    const scheduleResize = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(resizeCanvas);
    };

    const observer = typeof ResizeObserver !== 'undefined' && parent
      ? new ResizeObserver(scheduleResize)
      : null;

    if (parent) observer?.observe(parent);
    scheduleResize();
    timeout = window.setTimeout(scheduleResize, 140);
    window.addEventListener('resize', scheduleResize);
    window.addEventListener('orientationchange', scheduleResize);

    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      window.clearTimeout(timeout);
      observer?.disconnect();
      window.removeEventListener('resize', scheduleResize);
      window.removeEventListener('orientationchange', scheduleResize);
    };
  }, [aspectRatio, camera, gl, invalidate, setSize]);

  return null;
}

type WofPerfStats = {
  averageMs: number;
  frames: number;
  maxMs: number;
  p95Ms: number;
  startedAtMs: number;
  updatedAtMs: number;
};

declare global {
  interface Window {
    __wofPerfStats?: WofPerfStats;
  }
}

function QaPerfStatsProbe() {
  const enabled = useMemo(() => {
    if (typeof window === "undefined") return false;
    const params = new URLSearchParams(window.location.search);
    return params.get("qaPerfStats") === "1";
  }, []);
  const startedAtRef = useRef(Date.now());
  const samplesRef = useRef<number[]>([]);
  const lastPublishRef = useRef(0);

  useFrame((state, delta) => {
    if (!enabled) return;
    const sampleMs = delta * 1000;
    if (!Number.isFinite(sampleMs) || sampleMs <= 0) return;

    const samples = samplesRef.current;
    samples.push(sampleMs);
    if (samples.length > 720) samples.shift();
    if (state.clock.elapsedTime - lastPublishRef.current < 1) return;
    lastPublishRef.current = state.clock.elapsedTime;

    const sorted = samples.slice().sort((a, b) => a - b);
    const sum = sorted.reduce((total, value) => total + value, 0);
    const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] ?? 0;
    const stats = {
      averageMs: sorted.length ? Number((sum / sorted.length).toFixed(2)) : 0,
      frames: samples.length,
      maxMs: Number((sorted[sorted.length - 1] ?? 0).toFixed(2)),
      p95Ms: Number(p95.toFixed(2)),
      startedAtMs: startedAtRef.current,
      updatedAtMs: Date.now(),
    };
    window.__wofPerfStats = stats;
    document.documentElement.dataset.wofPerfAverageMs = String(stats.averageMs);
    document.documentElement.dataset.wofPerfP95Ms = String(stats.p95Ms);
    document.documentElement.dataset.wofPerfMaxMs = String(stats.maxMs);
    document.documentElement.dataset.wofPerfFrames = String(stats.frames);
  });

  return null;
}

function getSurvivalDayNightCycle(elapsedSeconds: number) {
  const phase = ((elapsedSeconds / DAY_NIGHT_CYCLE_SECONDS) + 0.18) % 1;
  const sunAngle = phase * Math.PI * 2;
  const sunHeight = Math.sin(sunAngle);
  const dayAmount = smoothstepRange(-0.12, 0.34, sunHeight);
  const nightAmount = 1 - smoothstepRange(-0.36, 0.08, sunHeight);
  const duskAmount = 1 - smoothstepRange(0.02, 0.48, Math.abs(sunHeight));

  return { phase, sunAngle, sunHeight, dayAmount, nightAmount, duskAmount };
}

function HorizonCylinder({
  texture,
  radius,
  height,
  y,
  segments,
  followCamera,
  dynamicCycle = false,
}: {
  texture: THREE.Texture;
  radius: number;
  height: number;
  y: number;
  segments: number;
  followCamera: boolean;
  dynamicCycle?: boolean;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);
  const { camera } = useThree();
  const dayTint = useMemo(() => new THREE.Color("#ffffff"), []);
  const duskTint = useMemo(() => new THREE.Color("#ffd09a"), []);
  const nightTint = useMemo(() => new THREE.Color("#4b547c"), []);
  const currentTint = useMemo(() => new THREE.Color("#ffffff"), []);
  const survivalTimeOverrideSeconds = useGameStore(s => s.survivalTimeOverrideSeconds);

  useFrame((state) => {
    if (followCamera && ref.current) {
      ref.current.position.set(camera.position.x, y, camera.position.z);
    }

    if (dynamicCycle && materialRef.current) {
      const cycle = getSurvivalDayNightCycle(survivalTimeOverrideSeconds ?? state.clock.elapsedTime);
      currentTint.copy(nightTint).lerp(dayTint, cycle.dayAmount).lerp(duskTint, cycle.duskAmount * 0.32);
      materialRef.current.color.copy(currentTint);
    }
  });

  return (
    <mesh ref={ref} name="horizon-cylinder" position={[0, y, 0]} renderOrder={-10} frustumCulled={false}>
      <cylinderGeometry args={[radius, radius, height, segments, 1, true]} />
      <meshBasicMaterial
        ref={materialRef}
        map={texture}
        side={THREE.BackSide}
        depthWrite={false}
      />
    </mesh>
  );
}

function makeSkyCanvasTexture(
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D, width: number, height: number) => void,
  filter: THREE.MagnificationTextureFilter = THREE.LinearFilter,
) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.imageSmoothingEnabled = false;
    draw(ctx, width, height);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = filter;
  texture.minFilter = filter === THREE.NearestFilter ? THREE.NearestFilter : THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function configureGameRenderer(gl: THREE.WebGLRenderer) {
  gl.outputColorSpace = THREE.SRGBColorSpace;
  gl.toneMapping = THREE.NoToneMapping;
  gl.toneMappingExposure = 1;

  // Mobile browsers can compound CSS post-filters while resizing/fullscreening a
  // WebGL canvas. Keep the canvas unfiltered and let Three handle color output.
  gl.domElement.style.setProperty("filter", "none");
  gl.domElement.style.setProperty("-webkit-filter", "none");
  gl.domElement.style.setProperty("color-scheme", "only light");
}

let cachedSurvivalSunTexture: THREE.CanvasTexture | null = null;
function getSurvivalSunTexture() {
  if (cachedSurvivalSunTexture) return cachedSurvivalSunTexture;

  cachedSurvivalSunTexture = makeSkyCanvasTexture(160, 160, (ctx, width, height) => {
    const cx = width / 2;
    const cy = height / 2;
    const glow = ctx.createRadialGradient(cx, cy, 8, cx, cy, 78);
    glow.addColorStop(0, "rgba(255, 255, 245, 1)");
    glow.addColorStop(0.32, "rgba(255, 225, 102, 0.96)");
    glow.addColorStop(0.62, "rgba(255, 143, 48, 0.5)");
    glow.addColorStop(1, "rgba(255, 143, 48, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = "#fff7b4";
    ctx.beginPath();
    ctx.arc(cx, cy, 34, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(255, 179, 65, 0.68)";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(cx, cy, 42, 0, Math.PI * 2);
    ctx.stroke();
  });

  return cachedSurvivalSunTexture;
}

let cachedSurvivalMoonTexture: THREE.CanvasTexture | null = null;
function getSurvivalMoonTexture() {
  if (cachedSurvivalMoonTexture) return cachedSurvivalMoonTexture;

  cachedSurvivalMoonTexture = makeSkyCanvasTexture(96, 96, (ctx, width, height) => {
    const cx = width / 2;
    const cy = height / 2;
    const glow = ctx.createRadialGradient(cx, cy, 16, cx, cy, 46);
    glow.addColorStop(0, "rgba(236, 244, 255, 0.92)");
    glow.addColorStop(0.64, "rgba(152, 178, 235, 0.34)");
    glow.addColorStop(1, "rgba(152, 178, 235, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = "#d7dded";
    ctx.beginPath();
    ctx.arc(cx, cy, 24, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(90, 105, 145, 0.26)";
    [[-8, -7, 5], [7, 4, 4], [-2, 11, 3], [9, -11, 3]].forEach(([x, y, r]) => {
      ctx.beginPath();
      ctx.arc(cx + x, cy + y, r, 0, Math.PI * 2);
      ctx.fill();
    });
  });

  return cachedSurvivalMoonTexture;
}

let cachedSurvivalMoonPhaseTextures: THREE.CanvasTexture[] | null = null;
function getSurvivalMoonPhaseTextures() {
  if (cachedSurvivalMoonPhaseTextures) return cachedSurvivalMoonPhaseTextures;

  const drawMoonBase = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const cx = width / 2;
    const cy = height / 2;
    const glow = ctx.createRadialGradient(cx, cy, 16, cx, cy, 46);
    glow.addColorStop(0, "rgba(236, 244, 255, 0.86)");
    glow.addColorStop(0.58, "rgba(152, 178, 235, 0.3)");
    glow.addColorStop(1, "rgba(152, 178, 235, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);
  };

  const drawMoonSurface = (ctx: CanvasRenderingContext2D, phaseIndex: number) => {
    const cx = 48;
    const cy = 48;
    const radius = 24;
    ctx.fillStyle = "rgba(52, 62, 92, 0.58)";
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.clip();

    const drawLitDisk = () => {
      ctx.fillStyle = "#dce4f3";
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
    };

    const drawShadowDisk = (offset: number) => {
      ctx.fillStyle = "rgba(34, 43, 75, 0.88)";
      ctx.beginPath();
      ctx.arc(cx + offset, cy, radius + 0.6, 0, Math.PI * 2);
      ctx.fill();
    };

    if (phaseIndex === 0) {
      drawLitDisk();
    } else if (phaseIndex === 1) {
      drawLitDisk();
      drawShadowDisk(-radius * 1.04);
    } else if (phaseIndex === 2) {
      ctx.fillStyle = "#dce4f3";
      ctx.fillRect(cx, cy - radius, radius, radius * 2);
    } else if (phaseIndex === 3) {
      drawLitDisk();
      drawShadowDisk(-radius * 0.28);
    } else if (phaseIndex === 4) {
      ctx.strokeStyle = "rgba(214, 226, 255, 0.36)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, radius - 1.5, -0.95, 0.95);
      ctx.stroke();
    } else if (phaseIndex === 5) {
      drawLitDisk();
      drawShadowDisk(radius * 0.28);
    } else if (phaseIndex === 6) {
      ctx.fillStyle = "#dce4f3";
      ctx.fillRect(cx - radius, cy - radius, radius, radius * 2);
    } else {
      drawLitDisk();
      drawShadowDisk(radius * 1.04);
    }

    ctx.restore();

    ctx.fillStyle = "rgba(90, 105, 145, 0.22)";
    [[-8, -7, 5], [7, 4, 4], [-2, 11, 3], [9, -11, 3]].forEach(([x, y, r]) => {
      if (phaseIndex === 4) return;
      ctx.beginPath();
      ctx.arc(cx + x, cy + y, r, 0, Math.PI * 2);
      ctx.fill();
    });
  };

  cachedSurvivalMoonPhaseTextures = Array.from({ length: 8 }, (_, phaseIndex) => (
    makeSkyCanvasTexture(96, 96, (ctx, width, height) => {
      drawMoonBase(ctx, width, height);
      drawMoonSurface(ctx, phaseIndex);
    })
  ));

  return cachedSurvivalMoonPhaseTextures;
}

let cachedSurvivalCloudTexture: THREE.CanvasTexture | null = null;
function getSurvivalCloudTexture() {
  if (cachedSurvivalCloudTexture) return cachedSurvivalCloudTexture;

  cachedSurvivalCloudTexture = makeSkyCanvasTexture(256, 96, (ctx) => {
    ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
    [
      [26, 42, 48, 24],
      [58, 25, 58, 34],
      [104, 24, 72, 42],
      [158, 30, 64, 34],
      [198, 45, 48, 22],
      [78, 58, 142, 20],
    ].forEach(([x, y, w, h]) => {
      ctx.fillRect(x, y, w, h);
    });

    ctx.fillStyle = "rgba(183, 220, 235, 0.36)";
    ctx.fillRect(40, 62, 164, 12);
    ctx.fillRect(83, 50, 76, 8);
  }, THREE.NearestFilter);

  return cachedSurvivalCloudTexture;
}

let cachedSurvivalStarTexture: THREE.CanvasTexture | null = null;
function getSurvivalStarTexture() {
  if (cachedSurvivalStarTexture) return cachedSurvivalStarTexture;

  cachedSurvivalStarTexture = makeSkyCanvasTexture(768, 512, (ctx, width, height) => {
    ctx.clearRect(0, 0, width, height);
    const starCount = 980;

    for (let index = 0; index < starCount; index += 1) {
      const x = Math.floor(survivalHash01(index, starCount, 4330) * width);
      const y = Math.floor(Math.pow(survivalHash01(index, starCount, 4370), 0.78) * height);
      const brightness = 0.34 + survivalHash01(index, starCount, 4410) * 0.66;
      const size = survivalHash01(index, starCount, 4450) > 0.86 ? 2 : 1;
      const tint = survivalHash01(index, starCount, 4490);
      const color = tint > 0.88
        ? [255, 218, 166]
        : tint > 0.7
          ? [188, 205, 255]
          : [255, 249, 232];

      ctx.fillStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${brightness})`;
      ctx.fillRect(x, y, size, size);

      if (size > 1 && index % 9 === 0) {
        ctx.fillStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${brightness * 0.38})`;
        ctx.fillRect(Math.max(0, x - 1), y, 1, 1);
        ctx.fillRect(Math.min(width - 1, x + 2), y, 1, 1);
        ctx.fillRect(x, Math.max(0, y - 1), 1, 1);
        ctx.fillRect(x, Math.min(height - 1, y + 2), 1, 1);
      }
    }

    for (let cluster = 0; cluster < 34; cluster += 1) {
      const x = survivalHash01(cluster, 9, 4530) * width;
      const y = survivalHash01(cluster, 11, 4570) * height * 0.72;
      const glow = ctx.createRadialGradient(x, y, 0, x, y, 18 + survivalHash01(cluster, 13, 4610) * 22);
      glow.addColorStop(0, "rgba(180, 204, 255, 0.12)");
      glow.addColorStop(1, "rgba(180, 204, 255, 0)");
      ctx.fillStyle = glow;
      ctx.fillRect(x - 44, y - 44, 88, 88);
    }
  }, THREE.NearestFilter);

  return cachedSurvivalStarTexture;
}

let cachedAstralVeilTexture: THREE.CanvasTexture | null = null;
function getAstralVeilTexture() {
  if (cachedAstralVeilTexture) return cachedAstralVeilTexture;

  cachedAstralVeilTexture = makeSkyCanvasTexture(192, 128, (ctx, width, height) => {
    const cx = width / 2;
    const cy = height / 2;
    const haze = ctx.createRadialGradient(cx, cy, 12, cx, cy, Math.max(width, height) * 0.64);
    haze.addColorStop(0, "rgba(255, 255, 255, 0.02)");
    haze.addColorStop(0.35, "rgba(168, 85, 247, 0.12)");
    haze.addColorStop(0.72, "rgba(88, 28, 135, 0.28)");
    haze.addColorStop(1, "rgba(24, 6, 48, 0.52)");
    ctx.fillStyle = haze;
    ctx.fillRect(0, 0, width, height);

    for (let i = 0; i < 95; i += 1) {
      const x = Math.floor((Math.sin(i * 12.9898) * 43758.5453 % 1 + 1) % 1 * width);
      const y = Math.floor((Math.sin(i * 78.233) * 21942.631 % 1 + 1) % 1 * height);
      const alpha = 0.08 + ((i * 17) % 9) * 0.012;
      ctx.fillStyle = `rgba(244, 214, 255, ${alpha})`;
      ctx.fillRect(x, y, i % 5 === 0 ? 2 : 1, 1);
    }

    ctx.strokeStyle = "rgba(216, 180, 254, 0.18)";
    ctx.lineWidth = 2;
    for (let ring = 0; ring < 4; ring += 1) {
      ctx.beginPath();
      ctx.ellipse(cx, cy, 34 + ring * 24, 20 + ring * 15, ring * 0.25, 0, Math.PI * 2);
      ctx.stroke();
    }
  }, THREE.LinearFilter);

  return cachedAstralVeilTexture;
}

const getExactTerrainHeight = (x: number, z: number) => {
  const width = 1000;
  const segments = 128;
  const cellSize = width / segments;

  const col = Math.floor((x + width / 2) / cellSize);
  const row = Math.floor((z + width / 2) / cellSize);

  const c = Math.max(0, Math.min(segments - 1, col));
  const r = Math.max(0, Math.min(segments - 1, row));

  const x0 = c * cellSize - width / 2;
  const z0 = r * cellSize - width / 2;
  const x1 = (c + 1) * cellSize - width / 2;
  const z1 = (r + 1) * cellSize - width / 2;

  const h00 = getTerrainHeight(x0, z0);
  const h10 = getTerrainHeight(x1, z0);
  const h01 = getTerrainHeight(x0, z1);
  const h11 = getTerrainHeight(x1, z1);

  const tx = (x - x0) / cellSize;
  const tz = (z - z0) / cellSize;

  // PlaneGeometry creates two triangles per quad.
  // The diagonal runs from top-right to bottom-left.
  if (tx + tz <= 1) { 
    return h00 + tx * (h10 - h00) + tz * (h01 - h00);
  } else { 
    return h11 + (1 - tx) * (h01 - h11) + (1 - tz) * (h10 - h11);
  }
};

import { Bushes } from "./Bushes";
import { LiveMiniMap } from "./LiveMiniMap";
import { Huts, type HutInfo } from "./Huts";
import { Runes } from "./Runes";
import { Villagers } from "./Villagers";
import { WaterRipples } from "./WaterRipples";
import { Projectiles } from "./Projectiles";
import { isMobilePerformanceMode } from "./performanceMode";

function CastleWall({ position, args, texture, rotation }: { position: [number, number, number], args: [number, number, number], texture: THREE.Texture, rotation?: [number, number, number] }) {
  const tex = useMemo(() => {
    const t = texture.clone();
    t.needsUpdate = true;
    const isXLong = args[0] > args[2];
    const len = isXLong ? args[0] : args[2];
    t.repeat.set(len / 12, args[1] / 12);
    return t;
  }, [texture, args]);

  return (
    <mesh position={position} rotation={rotation || [0,0,0]} receiveShadow castShadow>
       <boxGeometry args={args} />
       <meshStandardMaterial map={tex} roughness={0.8} />
    </mesh>
  );
}

type GateSide = "north" | "south" | "east" | "west";

function VillageGateArch({ side, texture }: { side: GateSide; texture: THREE.Texture }) {
  const z = side === "north" ? -238 : side === "south" ? 238 : 0;
  const x = side === "east" ? 238 : side === "west" ? -238 : 0;
  const isNorthSouth = side === "north" || side === "south";

  if (isNorthSouth) {
    return (
      <group name={`village-gate-arch-${side}`}>
        <CastleWall position={[-38, 8, z]} args={[8, 16, 10]} texture={texture} />
        <CastleWall position={[38, 8, z]} args={[8, 16, 10]} texture={texture} />
        <CastleWall position={[0, 17.5, z]} args={[84, 5, 10]} texture={texture} />
        <CastleWall position={[0, 21, z]} args={[18, 4, 10]} texture={texture} />
        <mesh position={[0, 15.25, z]} rotation={[0, 0, Math.PI / 4]} castShadow receiveShadow>
          <boxGeometry args={[8, 8, 10]} />
          <meshStandardMaterial map={texture} roughness={0.82} />
        </mesh>
      </group>
    );
  }

  return (
    <group name={`village-gate-arch-${side}`}>
      <CastleWall position={[x, 8, -38]} args={[10, 16, 8]} texture={texture} />
      <CastleWall position={[x, 8, 38]} args={[10, 16, 8]} texture={texture} />
      <CastleWall position={[x, 17.5, 0]} args={[10, 5, 84]} texture={texture} />
      <CastleWall position={[x, 21, 0]} args={[10, 4, 18]} texture={texture} />
      <mesh position={[x, 15.25, 0]} rotation={[Math.PI / 4, 0, 0]} castShadow receiveShadow>
        <boxGeometry args={[10, 8, 8]} />
        <meshStandardMaterial map={texture} roughness={0.82} />
      </mesh>
    </group>
  );
}

function VillagePerimeterWallVisuals({ wallTexture }: { wallTexture: THREE.Texture }) {
  return (
    <>
      <CastleWall position={[-136, 6, -238]} args={[208, 12, 8]} texture={wallTexture} />
      <CastleWall position={[136, 6, -238]} args={[208, 12, 8]} texture={wallTexture} />
      <CastleWall position={[-136, 6, 238]} args={[208, 12, 8]} texture={wallTexture} />
      <CastleWall position={[136, 6, 238]} args={[208, 12, 8]} texture={wallTexture} />
      <CastleWall position={[-238, 6, -136]} args={[8, 12, 208]} texture={wallTexture} />
      <CastleWall position={[-238, 6, 136]} args={[8, 12, 208]} texture={wallTexture} />
      <CastleWall position={[238, 6, -136]} args={[8, 12, 208]} texture={wallTexture} />
      <CastleWall position={[238, 6, 136]} args={[8, 12, 208]} texture={wallTexture} />
      <VillageGateArch side="north" texture={wallTexture} />
      <VillageGateArch side="south" texture={wallTexture} />
      <VillageGateArch side="east" texture={wallTexture} />
      <VillageGateArch side="west" texture={wallTexture} />
    </>
  );
}

function VillagePerimeterWallColliders() {
  return (
    <>
      <CuboidCollider args={[104, 50, 1]} position={[-136, 50, -235]} />
      <CuboidCollider args={[104, 50, 1]} position={[136, 50, -235]} />
      <CuboidCollider args={[104, 50, 1]} position={[-136, 50, 235]} />
      <CuboidCollider args={[104, 50, 1]} position={[136, 50, 235]} />
      <CuboidCollider args={[1, 50, 104]} position={[-235, 50, -136]} />
      <CuboidCollider args={[1, 50, 104]} position={[-235, 50, 136]} />
      <CuboidCollider args={[1, 50, 104]} position={[235, 50, -136]} />
      <CuboidCollider args={[1, 50, 104]} position={[235, 50, 136]} />
      <CuboidCollider args={[4, 8, 5]} position={[-38, 8, -235]} />
      <CuboidCollider args={[4, 8, 5]} position={[38, 8, -235]} />
      <CuboidCollider args={[4, 8, 5]} position={[-38, 8, 235]} />
      <CuboidCollider args={[4, 8, 5]} position={[38, 8, 235]} />
      <CuboidCollider args={[5, 8, 4]} position={[-235, 8, -38]} />
      <CuboidCollider args={[5, 8, 4]} position={[-235, 8, 38]} />
      <CuboidCollider args={[5, 8, 4]} position={[235, 8, -38]} />
      <CuboidCollider args={[5, 8, 4]} position={[235, 8, 38]} />
    </>
  );
}

function VillagePerimeterWallSegmentColliders({ yOffset = 0 }: { yOffset?: number }) {
  return (
    <>
      <CuboidCollider args={[104, 50, 1]} position={[-136, 50 + yOffset, -235]} />
      <CuboidCollider args={[104, 50, 1]} position={[136, 50 + yOffset, -235]} />
      <CuboidCollider args={[104, 50, 1]} position={[-136, 50 + yOffset, 235]} />
      <CuboidCollider args={[104, 50, 1]} position={[136, 50 + yOffset, 235]} />
      <CuboidCollider args={[1, 50, 104]} position={[-235, 50 + yOffset, -136]} />
      <CuboidCollider args={[1, 50, 104]} position={[-235, 50 + yOffset, 136]} />
      <CuboidCollider args={[1, 50, 104]} position={[235, 50 + yOffset, -136]} />
      <CuboidCollider args={[1, 50, 104]} position={[235, 50 + yOffset, 136]} />
    </>
  );
}

function VillagePerimeterWalls({ wallTexture, collidable = true }: { wallTexture: THREE.Texture; collidable?: boolean }) {
  if (!collidable) {
    return (
      <group name="village-perimeter-walls-visual">
        <VillagePerimeterWallVisuals wallTexture={wallTexture} />
      </group>
    );
  }

  return (
    <RigidBody type="fixed" colliders={false} name="village-perimeter-walls">
      <VillagePerimeterWallVisuals wallTexture={wallTexture} />
      <VillagePerimeterWallColliders />
    </RigidBody>
  );
}

type SurvivalChunkInfo = {
  key: string;
  cx: number;
  cz: number;
  x: number;
  z: number;
  distance: number;
  biome: SurvivalBiome;
  hasVillage: boolean;
  villageKind: SurvivalVillageKind | null;
  hasRiver: boolean;
  riverVertical: boolean;
  lod: "near" | "mid" | "far";
};

type SurvivalVillageKind = "desert" | "swamp" | "chicago" | "mountain";

const SURVIVAL_RENDER_RADIUS = 2;
const SURVIVAL_NEAR_RADIUS = 1;
const BASE_VILLAGE_STREAM_DISTANCE = SURVIVAL_BLOCK_SIZE * 1.45;
const SURVIVAL_BIOME_HEX_RADIUS = SURVIVAL_BLOCK_SIZE * 0.62;
const SURVIVAL_TERRAIN_NEAR_SEGMENTS = 38;
const SURVIVAL_TERRAIN_MID_SEGMENTS = 16;
const SURVIVAL_VILLAGE_PAD_SEGMENTS = 18;
const SURVIVAL_TERRAIN_CACHE_LIMIT = 48;
const BASE_VILLAGE_HALF_SIZE = 256;
const BASE_VILLAGE_EXIT_HEIGHT = 2;
const BASE_VILLAGE_EXIT_BLEND_DISTANCE = 220;
const BASE_VILLAGE_APRON_DISTANCE = 172;
const survivalTerrainGeometryCache = new Map<string, THREE.BufferGeometry>();

const survivalBiomeStyle: Record<SurvivalBiome, { ground: string; accent: string; water: string }> = {
  plains: { ground: "#4f8730", accent: "#78b94f", water: "#2e72a8" },
  jungle: { ground: "#27652d", accent: "#124822", water: "#196d6f" },
  desert: { ground: "#d3ad62", accent: "#aa7c31", water: "#4ea7b6" },
  swamp: { ground: "#385333", accent: "#667638", water: "#245f62" },
  mushroom: { ground: "#5b477c", accent: "#c865d6", water: "#496eb6" },
};

const survivalBiomes: SurvivalBiome[] = ["plains", "jungle", "desert", "swamp", "mushroom"];

const survivalBiomeElevation: Record<SurvivalBiome, {
  base: number;
  hills: number;
  ridges: number;
  mountains: number;
  valleys: number;
  detail: number;
  waterLevel: number;
}> = {
  plains: { base: 3.2, hills: 24, ridges: 19, mountains: 38, valleys: 15, detail: 2.1, waterLevel: 1.55 },
  jungle: { base: 6.4, hills: 34, ridges: 27, mountains: 58, valleys: 20, detail: 2.9, waterLevel: 2.25 },
  desert: { base: 2.3, hills: 29, ridges: 26, mountains: 48, valleys: 13, detail: 3.15, waterLevel: 0.95 },
  swamp: { base: 0.9, hills: 15, ridges: 12, mountains: 24, valleys: 10, detail: 1.4, waterLevel: 1.05 },
  mushroom: { base: 4.8, hills: 31, ridges: 25, mountains: 52, valleys: 18, detail: 2.65, waterLevel: 1.85 },
};

const survivalBiomeMountainProfile: Record<SurvivalBiome, {
  chance: number;
  radius: number;
  height: number;
}> = {
  plains: { chance: 0.42, radius: 320, height: 28 },
  jungle: { chance: 0.6, radius: 355, height: 44 },
  desert: { chance: 0.48, radius: 345, height: 36 },
  swamp: { chance: 0.26, radius: 270, height: 18 },
  mushroom: { chance: 0.54, radius: 330, height: 40 },
};

type BiomeWeight = {
  biome: SurvivalBiome;
  weight: number;
};

type HexCoord = {
  q: number;
  r: number;
};

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function smoothstep01(value: number) {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

function smoothstepRange(edge0: number, edge1: number, value: number) {
  const span = edge1 - edge0;
  if (Math.abs(span) < 0.0001) return value >= edge1 ? 1 : 0;
  return smoothstep01((value - edge0) / span);
}

function lerpNumber(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function roundAxialHex(q: number, r: number): HexCoord {
  let cubeX = q;
  let cubeZ = r;
  let cubeY = -cubeX - cubeZ;
  let roundedX = Math.round(cubeX);
  let roundedY = Math.round(cubeY);
  let roundedZ = Math.round(cubeZ);
  const xDiff = Math.abs(roundedX - cubeX);
  const yDiff = Math.abs(roundedY - cubeY);
  const zDiff = Math.abs(roundedZ - cubeZ);

  if (xDiff > yDiff && xDiff > zDiff) {
    roundedX = -roundedY - roundedZ;
  } else if (yDiff > zDiff) {
    roundedY = -roundedX - roundedZ;
  } else {
    roundedZ = -roundedX - roundedY;
  }

  return { q: roundedX, r: roundedZ };
}

function worldToBiomeHex(worldX: number, worldZ: number): HexCoord {
  const q = ((Math.sqrt(3) / 3) * worldX - worldZ / 3) / SURVIVAL_BIOME_HEX_RADIUS;
  const r = ((2 / 3) * worldZ) / SURVIVAL_BIOME_HEX_RADIUS;
  return roundAxialHex(q, r);
}

function biomeHexToWorld(q: number, r: number) {
  return {
    x: SURVIVAL_BIOME_HEX_RADIUS * Math.sqrt(3) * (q + r / 2),
    z: SURVIVAL_BIOME_HEX_RADIUS * 1.5 * r,
  };
}

function getBiomeMountainField(biome: SurvivalBiome, worldX: number, worldZ: number) {
  const profile = survivalBiomeMountainProfile[biome];
  const biomeSeed = survivalBiomes.indexOf(biome) + 1;
  const cellX = Math.floor(worldX / SURVIVAL_BLOCK_SIZE);
  const cellZ = Math.floor(worldZ / SURVIVAL_BLOCK_SIZE);
  let lift = 0;

  for (let dz = -1; dz <= 1; dz += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      const cx = cellX + dx;
      const cz = cellZ + dz;
      if (survivalHash01(cx, cz, 820 + biomeSeed * 11) > profile.chance) continue;

      const centerX = cx * SURVIVAL_BLOCK_SIZE + (survivalHash01(cx, cz, 821 + biomeSeed * 13) - 0.5) * SURVIVAL_BLOCK_SIZE * 0.48;
      const centerZ = cz * SURVIVAL_BLOCK_SIZE + (survivalHash01(cx, cz, 822 + biomeSeed * 17) - 0.5) * SURVIVAL_BLOCK_SIZE * 0.48;
      const radius = profile.radius * (0.9 + survivalHash01(cx, cz, 823 + biomeSeed * 19) * 0.28);
      const height = profile.height * (0.72 + survivalHash01(cx, cz, 824 + biomeSeed * 23) * 0.34);
      const distance = Math.hypot(worldX - centerX, worldZ - centerZ);
      const raw = 1 - distance / radius;
      if (raw <= 0) continue;

      const shoulder = smoothstep01(raw);
      const summit = smoothstepRange(0.5, 1, shoulder);
      const spire = Math.pow(smoothstepRange(0.54, 0.96, raw), biome === "jungle" ? 3.0 : 3.5);
      const cliffRidges = Math.max(0, Math.sin(distance * 0.082 + survivalHash01(cx, cz, 829 + biomeSeed) * Math.PI * 2));
      const terrace = Math.floor(shoulder * 7) / 7;
      const terracedShoulder = lerpNumber(shoulder, terrace, biome === "desert" ? 0.3 : 0.17);
      const skirt = smoothstepRange(0.08, 0.46, raw) * Math.max(0, 1 - raw) * height * 0.16;
      lift +=
        (terracedShoulder * terracedShoulder * height * 0.92) +
        (summit * height * 0.26) +
        (spire * height * (biome === "jungle" ? 0.38 : 0.3)) +
        (cliffRidges * shoulder * height * 0.075) +
        skirt;
    }
  }

  return lift;
}

let cachedDesertSandTexture: THREE.CanvasTexture | null = null;
let cachedSurvivalTerrainDetailTexture: THREE.CanvasTexture | null = null;
let cachedDesertAdobeWallTexture: THREE.CanvasTexture | null = null;

function getDesertSandTexture() {
  if (cachedDesertSandTexture) return cachedDesertSandTexture;

  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#fff8e5";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < canvas.height; y += 2) {
      for (let x = 0; x < canvas.width; x += 2) {
        const waveA = Math.sin((x * 0.17) + (y * 0.055));
        const waveB = Math.sin((x * 0.055) - (y * 0.18));
        const ridge = Math.abs(((x + y * 0.46 + waveA * 9 + waveB * 4) % 34) - 17);
        const grain = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
        const speckle = grain - Math.floor(grain);

        if (ridge < 2.2) {
          ctx.fillStyle = "#fff0cc";
          ctx.fillRect(x, y, 2, 2);
        } else if (ridge < 5.8) {
          ctx.fillStyle = "#f6d8b1";
          ctx.fillRect(x, y, 2, 2);
        } else if (ridge > 14.8 && ridge < 17.8) {
          ctx.fillStyle = "#ecc59e";
          ctx.fillRect(x, y, 2, 2);
        } else if (speckle > 0.988) {
          ctx.fillStyle = "#f2d7b5";
          ctx.fillRect(x, y, 2, 2);
        }
      }
    }

    for (let stripe = -canvas.height; stripe < canvas.width + canvas.height; stripe += 22) {
      ctx.fillStyle = "rgba(255, 243, 217, 0.35)";
      for (let y = 0; y < canvas.height; y += 4) {
        const x = stripe + y * 0.48 + Math.sin(y * 0.18) * 5;
        ctx.fillRect(Math.round(x / 2) * 2, y, 4, 4);
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(8, 8);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  cachedDesertSandTexture = texture;
  return texture;
}

function getSurvivalTerrainDetailTexture() {
  if (cachedSurvivalTerrainDetailTexture) return cachedSurvivalTerrainDetailTexture;

  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < canvas.height; y += 2) {
      for (let x = 0; x < canvas.width; x += 2) {
        const wave = Math.sin(x * 0.11 + Math.sin(y * 0.05) * 3.8) + Math.cos(y * 0.13 - x * 0.035);
        const grain = Math.sin(x * 19.19 + y * 73.31) * 43758.5453;
        const speckle = grain - Math.floor(grain);

        if (wave > 1.12) {
          ctx.fillStyle = "#f4f1e6";
          ctx.fillRect(x, y, 2, 2);
        } else if (wave < -1.32) {
          ctx.fillStyle = "#fbf8ee";
          ctx.fillRect(x, y, 2, 2);
        } else if (speckle > 0.992) {
          ctx.fillStyle = "#efebdc";
          ctx.fillRect(x, y, 2, 2);
        }
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(7, 7);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  cachedSurvivalTerrainDetailTexture = texture;
  return texture;
}

function getDesertAdobeWallTexture() {
  if (cachedDesertAdobeWallTexture) return cachedDesertAdobeWallTexture;

  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#deb779";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < canvas.height; y += 12) {
      const rowOffset = Math.floor(((Math.sin(y * 17.17) * 43758.5453) % 1) * 16);
      let x = -rowOffset;

      while (x < canvas.width) {
        const raw = Math.sin((x + 31) * 12.9898 + (y + 7) * 78.233) * 43758.5453;
        const hash = raw - Math.floor(raw);
        const width = 18 + Math.floor(hash * 28);
        const height = 9 + Math.floor((1 - hash) * 5);
        const inset = hash > 0.72 ? 2 : 1;
        const shade = hash > 0.72 ? "#d1a362" : hash > 0.42 ? "#e4bf80" : "#e8c88d";

        ctx.fillStyle = "#c79b5f";
        ctx.fillRect(x, y + height - 1, width, 2);
        ctx.fillRect(x + width - 2, y, 2, height);
        ctx.fillStyle = "#ecd095";
        ctx.fillRect(x + inset, y + 1, Math.max(3, width - inset * 2), 2);
        ctx.fillStyle = shade;
        ctx.fillRect(x + inset, y + 3, Math.max(3, width - inset * 2), Math.max(2, height - 4));

        if (hash > 0.58) {
          ctx.fillStyle = "rgba(177, 128, 65, 0.22)";
          ctx.fillRect(x + 4, y + Math.max(4, Math.floor(height * 0.58)), Math.max(5, width - 8), 2);
        }

        x += width + 3;
      }
    }

    for (let i = 0; i < 28; i += 1) {
      const rawX = Math.sin(i * 44.13) * 43758.5453;
      const rawY = Math.sin(i * 91.77 + 3.4) * 43758.5453;
      const x = Math.floor((rawX - Math.floor(rawX)) * canvas.width / 2) * 2;
      const y = Math.floor((rawY - Math.floor(rawY)) * canvas.height / 2) * 2;
      ctx.fillStyle = i % 3 === 0 ? "#c89b5e" : "#ead198";
      ctx.fillRect(x, y, 2, 2);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1.85, 1.85);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  cachedDesertAdobeWallTexture = texture;
  return texture;
}

function hexToRgb(hex: string) {
  const value = hex.replace("#", "");
  const normalized = value.length === 3
    ? value.split("").map((char) => `${char}${char}`).join("")
    : value.padEnd(6, "0").slice(0, 6);
  return {
    r: parseInt(normalized.slice(0, 2), 16) / 255,
    g: parseInt(normalized.slice(2, 4), 16) / 255,
    b: parseInt(normalized.slice(4, 6), 16) / 255,
  };
}

function getSurvivalBiomeWeights(worldX: number, worldZ: number): BiomeWeight[] {
  const center = worldToBiomeHex(worldX, worldZ);
  const rawWeights: Array<[number, number, number]> = [
    [center.q, center.r, 0],
    [center.q + 1, center.r, 0],
    [center.q - 1, center.r, 0],
    [center.q, center.r + 1, 0],
    [center.q, center.r - 1, 0],
    [center.q + 1, center.r - 1, 0],
    [center.q - 1, center.r + 1, 0],
  ];
  const merged = new Map<SurvivalBiome, number>();
  let totalWeight = 0;

  rawWeights.forEach((rawWeight, index) => {
    const [q, r] = rawWeight;
    const hexCenter = biomeHexToWorld(q, r);
    const distance = Math.hypot(worldX - hexCenter.x, worldZ - hexCenter.z);
    const normalizedDistance = distance / SURVIVAL_BIOME_HEX_RADIUS;
    const centerBoost = index === 0 ? 0.16 : 0;
    const weight = Math.pow(Math.max(0, 1.24 - normalizedDistance), 2.35) + centerBoost;
    rawWeight[2] = weight;
    totalWeight += weight;
  });

  if (totalWeight <= 0.0001) {
    return [{ biome: getSurvivalBiome(center.q, center.r), weight: 1 }];
  }

  rawWeights.forEach(([cx, cz, weight]) => {
    if (weight <= 0.0001) return;
    const biome = getSurvivalBiome(cx, cz);
    merged.set(biome, (merged.get(biome) ?? 0) + weight / totalWeight);
  });

  return Array.from(merged.entries()).map(([biome, weight]) => ({ biome, weight }));
}

function getBiomeTerrainHeight(biome: SurvivalBiome, worldX: number, worldZ: number) {
  const elevation = survivalBiomeElevation[biome];
  const biomeSeed = survivalBiomes.indexOf(biome) + 1;
  const continental = Math.sin(worldX * 0.0022 + 1.7) * Math.cos(worldZ * 0.0026 - 0.9);
  const rolling = (
    Math.sin(worldX * 0.0042 + worldZ * 0.0014) +
    Math.cos(worldZ * 0.0037 - worldX * 0.0018)
  ) * 0.5;
  const broadHills = (
    Math.sin(worldX * 0.00155 + Math.sin(worldZ * 0.00072) * 1.6) +
    Math.cos(worldZ * 0.00145 - Math.sin(worldX * 0.00078) * 1.35) +
    Math.sin((worldX + worldZ) * 0.00095 + 4.2)
  ) / 3;
  const plateauNoise = (
    Math.sin(worldX * 0.00074 + worldZ * 0.00026 + 2.3) +
    Math.cos(worldZ * 0.0008 - worldX * 0.00032 - 0.4)
  ) * 0.5;
  const hillLift = smoothstepRange(-0.8, 0.72, broadHills) * elevation.hills * 0.78;
  const shoulderHills = Math.pow(
    smoothstepRange(-0.52, 0.9, rolling + broadHills * 0.58),
    1.02
  ) * elevation.hills * 0.38;
  const ridgeWave = Math.sin(worldX * 0.0068 + worldZ * 0.0047 + Math.sin(worldZ * 0.0016) * 2.1);
  const ridges = Math.pow(1 - Math.abs(ridgeWave), 1.85);
  const cliffBands = Math.pow(1 - Math.abs(Math.sin(worldX * 0.0032 - worldZ * 0.0041)), 4.4);
  const mountainNoise = (
    Math.sin(worldX * 0.00105 + 3.1) * 0.56 +
    Math.cos(worldZ * 0.00118 - 1.4) * 0.5 +
    Math.sin((worldX - worldZ) * 0.00062 + 0.7) * 0.38
  ) / 1.44;
  const mountainMask = smoothstepRange(-0.02, 0.74, mountainNoise);
  const mountainField = getBiomeMountainField(biome, worldX, worldZ);
  const valleyNoise = (
    Math.cos(worldX * 0.0037 - 0.7) * 0.52 +
    Math.sin(worldZ * 0.0032 + 2.2) * 0.48
  ) * 0.5 + 0.5;
  const valleyMask = smoothstepRange(0.58, 0.96, valleyNoise);
  const basinCut = Math.pow(smoothstepRange(0.18, 0.95, 1 - mountainNoise), 1.45) * elevation.valleys * 0.42;
  const mountainLift = Math.pow(mountainMask, 1.38) * elevation.mountains;
  const ridgeLift = ridges * elevation.ridges * (0.38 + mountainMask * 0.58);
  const cliffLift = cliffBands * elevation.ridges * smoothstepRange(0.02, 0.78, mountainMask + broadHills * 0.36) * 0.36;
  const plateauLift = smoothstepRange(0.08, 0.78, plateauNoise) * elevation.hills * (biome === "desert" ? 0.28 : 0.18);
  const detail = Math.sin(worldX * 0.024 + worldZ * 0.013) * 0.75 + Math.cos(worldZ * 0.019 - worldX * 0.012) * 0.62;
  const duneRipples = biome === "desert"
    ? Math.sin(worldX * 0.035 + worldZ * 0.011) * 1.35 + Math.sin(worldZ * 0.029) * 0.75
    : 0;
  const swampSink = biome === "swamp"
    ? smoothstepRange(0.42, 0.88, valleyNoise) * 1.7
    : 0;
  const macroSwell = (
    Math.sin(worldX * 0.00128 + Math.cos(worldZ * 0.00062) * 2.2) +
    Math.cos(worldZ * 0.00116 - Math.sin(worldX * 0.00057) * 2.4) +
    Math.sin((worldX - worldZ) * 0.00082 + biomeSeed * 1.9)
  ) / 3;
  const highlandSwell = Math.pow(smoothstepRange(-0.52, 0.82, macroSwell), 1.08) * elevation.mountains * (biome === "swamp" ? 0.34 : 0.52);
  const ravineCut = Math.pow(
    smoothstepRange(0.38, 0.94, -macroSwell + Math.sin(worldX * 0.0022 + worldZ * 0.0018) * 0.28),
    1.22
  ) * elevation.valleys * (biome === "desert" ? 0.46 : 0.58);
  const foldRidgeWave = Math.sin(worldX * 0.0034 + worldZ * 0.0058 + Math.sin(worldX * 0.0009) * 2.5);
  const foldRidges = Math.pow(1 - Math.abs(foldRidgeWave), 1.65) * elevation.ridges * (biome === "swamp" ? 0.3 : 0.52);

  return elevation.base +
    continental * elevation.hills * 0.42 +
    rolling * elevation.hills * 0.32 +
    hillLift +
    shoulderHills +
    ridgeLift +
    cliffLift +
    plateauLift +
    mountainLift -
    valleyMask * elevation.valleys * 1.28 -
    basinCut +
    highlandSwell +
    foldRidges -
    ravineCut +
    detail * elevation.detail +
    mountainField +
    duneRipples -
    swampSink;
}

function getSurvivalWaterLevelAtWorld(worldX: number, worldZ: number) {
  return getSurvivalBiomeWeights(worldX, worldZ).reduce((sum, { biome, weight }) => (
    sum + survivalBiomeElevation[biome].waterLevel * weight
  ), 0);
}

function getSurvivalTerrainColor(worldX: number, worldZ: number, height: number) {
  const weights = getSurvivalBiomeWeights(worldX, worldZ);
  let r = 0;
  let g = 0;
  let b = 0;

  weights.forEach(({ biome, weight }) => {
    const style = survivalBiomeStyle[biome];
    const ground = hexToRgb(style.ground);
    const accent = hexToRgb(style.accent);
    const biomeIndex = survivalBiomes.indexOf(biome) + 1;
    const patchNoise = (
      Math.sin(worldX * (0.021 + biomeIndex * 0.002) + worldZ * 0.013 + biomeIndex * 1.7) +
      Math.cos(worldZ * (0.018 + biomeIndex * 0.0017) - worldX * 0.009)
    ) * 0.5;
    const fineNoise = Math.sin(worldX * 0.087 + worldZ * 0.061 + biomeIndex * 2.1) * 0.5 + 0.5;
    const accentMix = biome === "desert"
      ? 0.18 + smoothstepRange(-0.15, 0.85, patchNoise) * 0.2
      : biome === "jungle" || biome === "swamp"
        ? 0.2 + smoothstepRange(-0.35, 0.9, patchNoise) * 0.34
        : 0.14 + smoothstepRange(-0.25, 0.95, patchNoise) * 0.22;
    const speckle = (fineNoise - 0.5) * (biome === "desert" ? 0.07 : 0.045);
    const localR = lerpNumber(ground.r, accent.r, accentMix) + speckle;
    const localG = lerpNumber(ground.g, accent.g, accentMix) + speckle;
    const localB = lerpNumber(ground.b, accent.b, accentMix) + speckle;

    r += localR * weight;
    g += localG * weight;
    b += localB * weight;
  });

  const rock = hexToRgb("#7a745f");
  const peak = hexToRgb("#d6d1bc");
  const waterTint = hexToRgb("#476f64");
  const rockMix = smoothstepRange(58, 142, height);
  const peakMix = smoothstepRange(148, 230, height);
  const lowMix = smoothstepRange(1.2, -1.5, height);
  const contour = Math.sin(height * 0.42 + worldX * 0.013 + worldZ * 0.009) * 0.03;
  const cliffStripe = Math.pow(Math.max(0, Math.sin(height * 0.58 + worldX * 0.007)), 3) * rockMix;
  const grassRows = Math.sin(worldX * 0.028 + Math.sin(worldZ * 0.012) * 2.2) * 0.018;
  const altitudeShade = lerpNumber(0.88, 1.12, smoothstepRange(-16, 92, height));
  const shade = (0.99 + Math.sin(worldX * 0.041 + worldZ * 0.029) * 0.04 + contour + grassRows) * altitudeShade;

  r = lerpNumber(r, rock.r, rockMix * 0.14);
  g = lerpNumber(g, rock.g, rockMix * 0.14);
  b = lerpNumber(b, rock.b, rockMix * 0.14);
  r = lerpNumber(r, peak.r, peakMix * 0.18);
  g = lerpNumber(g, peak.g, peakMix * 0.18);
  b = lerpNumber(b, peak.b, peakMix * 0.18);
  r = lerpNumber(r, 0.64, cliffStripe * 0.1);
  g = lerpNumber(g, 0.58, cliffStripe * 0.1);
  b = lerpNumber(b, 0.47, cliffStripe * 0.1);
  r = lerpNumber(r, waterTint.r, lowMix * 0.35);
  g = lerpNumber(g, waterTint.g, lowMix * 0.35);
  b = lerpNumber(b, waterTint.b, lowMix * 0.35);

  return new THREE.Color(clamp01(r * shade), clamp01(g * shade), clamp01(b * shade));
}

function survivalHash01(x: number, z: number, salt = 0) {
  const n = Math.sin(x * 127.1 + z * 311.7 + salt * 74.7) * 43758.5453123;
  return n - Math.floor(n);
}

function getSurvivalChunkCoord(value: number) {
  return Math.floor((value + SURVIVAL_BLOCK_SIZE / 2) / SURVIVAL_BLOCK_SIZE);
}

function getSurvivalBiome(cx: number, cz: number): SurvivalBiome {
  if (cx === 0 && cz === 0) return "plains";
  return survivalBiomes[Math.floor(survivalHash01(cx, cz, 1) * survivalBiomes.length) % survivalBiomes.length];
}

function hasSurvivalVillage(cx: number, cz: number) {
  if (cx === 0 && cz === 0) return false;
  const absCx = Math.abs(cx);
  const absCz = Math.abs(cz);
  const distanceBlocks = Math.max(Math.abs(cx), Math.abs(cz));
  if (distanceBlocks < 3) return false;

  const dirX = cx === 0 ? 0 : Math.sign(cx);
  const dirZ = cz === 0 ? 0 : Math.sign(cz);
  const gap = survivalHash01(dirX, dirZ, 12) > 0.5 ? 4 : 3;
  const onCardinalRoad = (absCx === 0 || absCz === 0) && distanceBlocks % gap === 0;
  const onDiagonalRoad = absCx === absCz && distanceBlocks % gap === 0;
  return onCardinalRoad || onDiagonalRoad;
}

function isChicagoChunk(cx: number, cz: number) {
  return cx === -3 && cz === -3;
}

function getSurvivalVillageKindForChunk(biome: SurvivalBiome, cx: number, cz: number): SurvivalVillageKind | null {
  if (!hasSurvivalVillage(cx, cz)) return null;
  if (isChicagoChunk(cx, cz)) return "chicago";
  if (biome === "desert") return "desert";
  if (biome === "swamp") return "swamp";
  return "mountain";
}

export type SurvivalManaWellSource = {
  id: string;
  x: number;
  y: number;
  z: number;
  radius: number;
};

export function getNearbySurvivalDesertManaWells(worldX: number, worldZ: number): SurvivalManaWellSource[] {
  const centerCx = getSurvivalChunkCoord(worldX);
  const centerCz = getSurvivalChunkCoord(worldZ);
  const wells: SurvivalManaWellSource[] = [];

  for (let dz = -1; dz <= 1; dz += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      const cx = centerCx + dx;
      const cz = centerCz + dz;
      const biome = getSurvivalBiome(cx, cz);
      if (biome !== "desert" || !hasSurvivalVillage(cx, cz)) continue;

      const chunk: SurvivalChunkInfo = {
        key: `${cx}:${cz}`,
        cx,
        cz,
        x: cx * SURVIVAL_BLOCK_SIZE,
        z: cz * SURVIVAL_BLOCK_SIZE,
        distance: Math.max(Math.abs(dx), Math.abs(dz)),
        biome,
        hasVillage: true,
        villageKind: "desert",
        hasRiver: getSurvivalChunkHasRiver(cx, cz),
        riverVertical: survivalHash01(cx, cz, 5) > 0.5,
        lod: "near",
      };
      const baseHeight = getSurvivalVillageBaseHeight(chunk);

      wells.push({
        id: `desert-well-mana-${cx}:${cz}`,
        x: chunk.x,
        y: baseHeight + 7.35,
        z: chunk.z,
        radius: 34,
      });
    }
  }

  return wells;
}

function makeSurvivalChunks(centerCx: number, centerCz: number) {
  const chunks: SurvivalChunkInfo[] = [];
  const radius = SURVIVAL_RENDER_RADIUS;

  for (let dz = -radius; dz <= radius; dz += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      const cx = centerCx + dx;
      const cz = centerCz + dz;
      if (cx === 0 && cz === 0) continue;
      const distance = Math.max(Math.abs(dx), Math.abs(dz));
      const biome = getSurvivalBiome(cx, cz);
      const villageKind = getSurvivalVillageKindForChunk(biome, cx, cz);

      chunks.push({
        key: `${cx}:${cz}`,
        cx,
        cz,
        x: cx * SURVIVAL_BLOCK_SIZE,
        z: cz * SURVIVAL_BLOCK_SIZE,
        distance,
        biome,
        hasVillage: villageKind !== null,
        villageKind,
        hasRiver: getSurvivalChunkHasRiver(cx, cz),
        riverVertical: survivalHash01(cx, cz, 5) > 0.5,
        lod: distance === 0 ? "near" : distance <= SURVIVAL_NEAR_RADIUS ? "mid" : "far",
      });
    }
  }

  return chunks;
}

function getSurvivalRiverWidth(chunk: SurvivalChunkInfo) {
  return getSurvivalRiverWidthForBiome(chunk.biome);
}

function getSurvivalRiverOffset(chunk: SurvivalChunkInfo) {
  return getSurvivalRiverOffsetForCoords(chunk.cx, chunk.cz);
}

function getSurvivalChunkHasRiver(cx: number, cz: number) {
  return survivalHash01(cx, cz, 4) > 0.42 || getSurvivalBiome(cx, cz) === "swamp";
}

function getSurvivalRiverWidthForBiome(biome: SurvivalBiome) {
  return biome === "swamp" ? 78 : biome === "jungle" ? 52 : 34;
}

function getSurvivalRiverOffsetForCoords(cx: number, cz: number) {
  return (survivalHash01(cx, cz, 15) - 0.5) * SURVIVAL_BLOCK_SIZE * 0.32;
}

function getSurvivalRiverCarveAtWorld(worldX: number, worldZ: number) {
  const centerCx = getSurvivalChunkCoord(worldX);
  const centerCz = getSurvivalChunkCoord(worldZ);
  let strength = 0;
  let bed = 0;

  for (let dx = -1; dx <= 1; dx += 1) {
    for (let dz = -1; dz <= 1; dz += 1) {
      const cx = centerCx + dx;
      const cz = centerCz + dz;
      if (!getSurvivalChunkHasRiver(cx, cz)) continue;

      const biome = getSurvivalBiome(cx, cz);
      const centerX = cx * SURVIVAL_BLOCK_SIZE;
      const centerZ = cz * SURVIVAL_BLOCK_SIZE;
      const localX = worldX - centerX;
      const localZ = worldZ - centerZ;
      const riverVertical = survivalHash01(cx, cz, 5) > 0.5;
      const offset = getSurvivalRiverOffsetForCoords(cx, cz);
      const riverHalfWidth = getSurvivalRiverWidthForBiome(biome) * 0.5;
      const distance = riverVertical ? Math.abs(localX - offset) : Math.abs(localZ - offset);
      const travelAxis = riverVertical ? Math.abs(localZ) : Math.abs(localX);
      const endFade = 1 - smoothstepRange(SURVIVAL_BLOCK_SIZE * 0.46, SURVIVAL_BLOCK_SIZE * 0.56, travelAxis);
      const rawCarve = Math.max(0, 1 - distance / riverHalfWidth) * endFade;
      const carve = smoothstep01(rawCarve);

      if (carve > strength) {
        strength = carve;
        bed = getSurvivalWaterLevelAtWorld(worldX, worldZ) - (biome === "swamp" ? 2.6 : 3.4);
      }
    }
  }

  return { strength, bed };
}

function getBaseVillageTransitionMask(worldX: number, worldZ: number) {
  const absX = Math.abs(worldX);
  const absZ = Math.abs(worldZ);
  const maxAbs = Math.max(absX, absZ);
  const minAbs = Math.min(absX, absZ);
  if (maxAbs < BASE_VILLAGE_HALF_SIZE - 0.5) return 0;

  const edgeApron = 1 - smoothstepRange(
    BASE_VILLAGE_HALF_SIZE + 4,
    BASE_VILLAGE_HALF_SIZE + BASE_VILLAGE_APRON_DISTANCE,
    maxAbs,
  );
  const gateRoadMask = 1 - smoothstepRange(18, 58, minAbs);
  const wallApronMask = 1 - smoothstepRange(
    BASE_VILLAGE_HALF_SIZE + 18,
    BASE_VILLAGE_HALF_SIZE + 108,
    maxAbs,
  );

  return clamp01(edgeApron * Math.max(gateRoadMask, wallApronMask));
}

function getSurvivalTerrainHeightForChunk(chunk: SurvivalChunkInfo, localX: number, localZ: number) {
  const worldX = chunk.x + localX;
  const worldZ = chunk.z + localZ;
  let height = getSurvivalBiomeWeights(worldX, worldZ).reduce((sum, { biome, weight }) => (
    sum + getBiomeTerrainHeight(biome, worldX, worldZ) * weight
  ), 0);

  const riverCarve = getSurvivalRiverCarveAtWorld(worldX, worldZ);
  if (riverCarve.strength > 0) {
    height = lerpNumber(height, Math.min(height, riverCarve.bed), riverCarve.strength);
  }

  const gateRoadDistance = Math.min(Math.abs(worldX), Math.abs(worldZ));
  const gateRoadMask = 1 - smoothstepRange(14, 46, gateRoadDistance);
  if (gateRoadMask > 0) {
    const travelAxis = Math.abs(worldX) < Math.abs(worldZ) ? worldZ : worldX;
    const distanceFromVillageEdge = Math.max(0, Math.abs(travelAxis) - BASE_VILLAGE_HALF_SIZE);
    const villageEdgeBlend = 1 - smoothstepRange(
      0,
      BASE_VILLAGE_EXIT_BLEND_DISTANCE,
      distanceFromVillageEdge,
    );
    const wildernessRoadHeight = 2.1 + Math.sin(travelAxis * 0.009) * 0.42;
    const roadHeight = lerpNumber(wildernessRoadHeight, BASE_VILLAGE_EXIT_HEIGHT, villageEdgeBlend);
    height = lerpNumber(height, roadHeight, gateRoadMask * 0.88);
  }

  const baseTransitionMask = getBaseVillageTransitionMask(worldX, worldZ);
  if (baseTransitionMask > 0) {
    height = lerpNumber(height, BASE_VILLAGE_EXIT_HEIGHT, baseTransitionMask);
  }

  return height;
}

function makeSurvivalTerrainGeometry(chunk: SurvivalChunkInfo) {
  const segments = chunk.lod === "near" ? SURVIVAL_TERRAIN_NEAR_SEGMENTS : SURVIVAL_TERRAIN_MID_SEGMENTS;
  const cacheKey = `${chunk.key}:${chunk.lod}:${segments}`;
  const cached = survivalTerrainGeometryCache.get(cacheKey);
  if (cached) {
    survivalTerrainGeometryCache.delete(cacheKey);
    survivalTerrainGeometryCache.set(cacheKey, cached);
    return cached;
  }

  const geo = new THREE.PlaneGeometry(SURVIVAL_BLOCK_SIZE, SURVIVAL_BLOCK_SIZE, segments, segments);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors: number[] = [];

  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = getSurvivalTerrainHeightForChunk(chunk, x, z);
    const color = getSurvivalTerrainColor(chunk.x + x, chunk.z + z, y);
    pos.setY(i, y);
    colors.push(color.r, color.g, color.b);
  }

  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  survivalTerrainGeometryCache.set(cacheKey, geo);
  if (survivalTerrainGeometryCache.size > SURVIVAL_TERRAIN_CACHE_LIMIT) {
    const oldestKey = survivalTerrainGeometryCache.keys().next().value;
    if (oldestKey) {
      survivalTerrainGeometryCache.get(oldestKey)?.dispose();
      survivalTerrainGeometryCache.delete(oldestKey);
    }
  }

  return geo;
}

function SurvivalTerrain({ chunk }: { chunk: SurvivalChunkInfo }) {
  const terrainGeometry = useMemo(() => makeSurvivalTerrainGeometry(chunk), [chunk]);
  const terrainTexture = useMemo(() => getSurvivalTerrainDetailTexture(), []);
  const hasCollision = chunk.distance === 0;
  const terrainMesh = (
    <mesh geometry={terrainGeometry} receiveShadow={hasCollision} dispose={null}>
      <meshBasicMaterial map={terrainTexture} vertexColors side={THREE.DoubleSide} />
    </mesh>
  );

  if (!hasCollision) {
    return <group position={[chunk.x, 0, chunk.z]}>{terrainMesh}</group>;
  }

  return (
    <group>
      <group position={[chunk.x, 0, chunk.z]}>{terrainMesh}</group>
      <RigidBody type="fixed" colliders="trimesh" friction={0.2} restitution={0} position={[chunk.x, 0, chunk.z]}>
        <mesh geometry={terrainGeometry} dispose={null}>
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </RigidBody>
    </group>
  );
}

function SurvivalVine({ start, end }: { start: THREE.Vector3; end: THREE.Vector3 }) {
  const segments = useMemo(() => {
    const totalDistance = start.distanceTo(end);
    const drop = Math.min(34, Math.max(10, totalDistance * 0.11));
    const points = Array.from({ length: 6 }, (_, index) => {
      const t = index / 5;
      const point = new THREE.Vector3().lerpVectors(start, end, t);
      point.y -= Math.sin(t * Math.PI) * drop;
      point.x += Math.sin(t * Math.PI * 2) * 1.2;
      point.z += Math.cos(t * Math.PI * 2) * 1.2;
      return point;
    });

    return points.slice(0, -1).map((point, index) => ({
      key: index,
      start: point,
      end: points[index + 1],
    }));
  }, [end, start]);

  return (
    <group>
      {segments.map((segment) => (
        <SurvivalBranch
          key={segment.key}
          start={segment.start}
          end={segment.end}
          radius={0.22}
          color="#233c19"
        />
      ))}
    </group>
  );
}

function SurvivalBranch({
  start,
  end,
  radius,
  color,
}: {
  start: THREE.Vector3;
  end: THREE.Vector3;
  radius: number;
  color: string;
}) {
  const { midpoint, length, quaternion } = useMemo(() => {
    const direction = new THREE.Vector3().subVectors(end, start);
    const length = Math.max(0.1, direction.length());
    const midpoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      direction.normalize()
    );
    return { midpoint, length, quaternion };
  }, [end, start]);

  return (
    <mesh position={midpoint} quaternion={quaternion} castShadow={false}>
      <cylinderGeometry args={[radius * 0.68, radius, length, 5]} />
      <meshLambertMaterial color={color} />
    </mesh>
  );
}

function SurvivalHangingVine({
  x,
  y,
  z,
  length,
  sway,
}: {
  x: number;
  y: number;
  z: number;
  length: number;
  sway: number;
}) {
  const start = useMemo(() => new THREE.Vector3(x, y, z), [x, y, z]);
  const end = useMemo(() => new THREE.Vector3(x + Math.sin(sway) * 1.25, y - length, z + Math.cos(sway) * 1.25), [length, sway, x, y, z]);

  return (
    <group>
      <SurvivalBranch start={start} end={end} radius={0.13} color="#1f4f20" />
      <mesh position={[x + Math.sin(sway) * 0.65, y - length * 0.52, z + Math.cos(sway) * 0.65]} rotation={[0.25, sway, 0.65]} castShadow={false}>
        <planeGeometry args={[1.2, 2.6]} />
        <meshBasicMaterial color="#2f7b35" side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[x - Math.sin(sway) * 0.55, y - length * 0.78, z - Math.cos(sway) * 0.55]} rotation={[-0.18, sway + 0.9, -0.5]} castShadow={false}>
        <planeGeometry args={[1, 2.1]} />
        <meshBasicMaterial color="#3d8f42" side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

type SurvivalScatterProp = {
  key: string;
  localX: number;
  localZ: number;
  scale: number;
  y: number;
  variant: number;
};

type SurvivalGrassBlade = {
  key: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  tilt: number;
  width: number;
  height: number;
  colorIndex: number;
};

type SurvivalFastGroveTree = {
  x: number;
  y: number;
  z: number;
  yaw: number;
  trunkHeight: number;
  trunkRadius: number;
  canopyRadius: number;
  canopyHeight: number;
  colorIndex: number;
  variant: number;
};

type SurvivalRoofForestTree = {
  x: number;
  y: number;
  z: number;
  yaw: number;
  trunkHeight: number;
  trunkRadius: number;
  canopyWidth: number;
  canopyDepth: number;
  canopyThickness: number;
  colorIndex: number;
  vineLength: number;
  variant: number;
};

type SurvivalHobbitHut = {
  key: string;
  localX: number;
  localZ: number;
  y: number;
  yaw: number;
  scale: number;
  variant: number;
};

const SURVIVAL_GRASS_COLORS: Record<SurvivalBiome, string[]> = {
  plains: ["#5fa63b", "#78bd46", "#3f7c2f"],
  jungle: ["#2e7d32", "#46a34a", "#1e5d2b"],
  desert: ["#b99244", "#d0aa5a", "#8c7639"],
  swamp: ["#526d2a", "#6f7e35", "#34491f"],
  mushroom: ["#51753b", "#7a9d47", "#8e7fc6"],
};

const SURVIVAL_BUSH_COLORS: Record<SurvivalBiome, string[]> = {
  plains: ["#416f2f", "#5e9341", "#7aad55"],
  jungle: ["#174d26", "#246b31", "#3a8e45"],
  desert: ["#8a7139", "#b68e43", "#d0ad62"],
  swamp: ["#33441f", "#526126", "#687337"],
  mushroom: ["#4f6d3c", "#745699", "#a976bf"],
};

const SURVIVAL_TREE_CANOPY_COLORS: Record<SurvivalBiome, [string, string]> = {
  plains: ["#71b34b", "#5f9d3f"],
  jungle: ["#0f5b2b", "#1f7a3b"],
  desert: ["#4f8b3f", "#6ca54a"],
  swamp: ["#53652d", "#68783a"],
  mushroom: ["#9a63c7", "#d071df"],
};

const SURVIVAL_ROOF_FOREST_CANOPY_COLORS: Record<SurvivalBiome, [string, string, string]> = {
  plains: ["#1f5f2f", "#2f7a38", "#4f9a42"],
  jungle: ["#082d18", "#0f4925", "#1b6a35"],
  desert: ["#4f8b3f", "#6ca54a", "#8cb45c"],
  swamp: ["#304620", "#465528", "#617136"],
  mushroom: ["#9a4fb1", "#d65dc5", "#ff8fcf"],
};

const SURVIVAL_TREE_TRUNK_COLORS: Record<SurvivalBiome, string> = {
  plains: "#5a351d",
  jungle: "#2b160d",
  desert: "#8a5d2b",
  swamp: "#332315",
  mushroom: "#dcc7aa",
};

function supportsRoofForest(biome: SurvivalBiome) {
  return biome === "plains" || biome === "jungle" || biome === "mushroom";
}

function getSurvivalTreeVisualScale(biome: SurvivalBiome, propScale: number) {
  const giantScale = 5;
  if (biome === "jungle") return Math.min(18.75, (1.24 + propScale * 0.62) * giantScale);
  if (biome === "swamp") return Math.min(15.25, (1.12 + propScale * 0.54) * giantScale);
  if (biome === "mushroom") return Math.min(15, (1.05 + propScale * 0.48) * giantScale);
  return Math.min(13.75, (1.05 + propScale * 0.48) * giantScale);
}

function getFastGroveTreeProfile(biome: SurvivalBiome, variant: number) {
  if (biome === "jungle") {
    return {
      trunkHeight: 88 + variant * 72,
      trunkRadius: 1.7 + variant * 1.25,
      canopyRadius: 13 + variant * 10,
      canopyHeight: 10 + variant * 8,
    };
  }
  if (biome === "swamp") {
    return {
      trunkHeight: 54 + variant * 42,
      trunkRadius: 1.45 + variant * 1.05,
      canopyRadius: 9 + variant * 7,
      canopyHeight: 7 + variant * 5,
    };
  }
  if (biome === "mushroom") {
    return {
      trunkHeight: 26 + variant * 22,
      trunkRadius: 1.35 + variant * 0.9,
      canopyRadius: 9 + variant * 8,
      canopyHeight: 5.5 + variant * 4,
    };
  }
  if (biome === "desert") {
    return {
      trunkHeight: 34 + variant * 28,
      trunkRadius: 0.9 + variant * 0.55,
      canopyRadius: 6.5 + variant * 5,
      canopyHeight: 3.2 + variant * 2.6,
    };
  }
  return {
    trunkHeight: 46 + variant * 38,
    trunkRadius: 1.25 + variant * 0.9,
    canopyRadius: 9.5 + variant * 7,
    canopyHeight: 7 + variant * 5,
  };
}

function getSurvivalTreeFootprintScale(biome: SurvivalBiome, visualScale: number) {
  if (biome === "jungle") return visualScale * 0.24;
  if (biome === "swamp") return visualScale * 0.3;
  if (biome === "mushroom") return visualScale * 0.42;
  return visualScale * 0.32;
}

function getSurvivalTreeCanopyY(biome: SurvivalBiome, prop: SurvivalScatterProp) {
  const visualScale = getSurvivalTreeVisualScale(biome, prop.scale);
  if (biome === "jungle") return prop.y + 34 * visualScale;
  if (biome === "swamp") return prop.y + 25 * visualScale;
  if (biome === "mushroom") return prop.y + 8 * visualScale;
  return prop.y + 20 * visualScale;
}

function finalizeSurvivalInstancedMesh(
  mesh: THREE.InstancedMesh,
  _centerX?: number,
  _centerZ?: number,
  _radius?: number,
  _centerY?: number,
) {
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
}

function SurvivalGrassPatches({ chunk }: { chunk: SurvivalChunkInfo }) {
  const grassRef0 = useRef<THREE.InstancedMesh>(null);
  const grassRef1 = useRef<THREE.InstancedMesh>(null);
  const grassRef2 = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const palette = SURVIVAL_GRASS_COLORS[chunk.biome];
  const blades = useMemo<SurvivalGrassBlade[]>(() => {
    if (chunk.lod === "far") return [];

    const targetCount = chunk.lod === "mid"
      ? (chunk.biome === "desert" ? 16 : chunk.biome === "jungle" ? 42 : chunk.biome === "swamp" ? 34 : 30)
      : chunk.biome === "jungle"
        ? 210
        : chunk.biome === "swamp"
          ? 160
          : chunk.biome === "desert"
            ? 72
            : chunk.biome === "mushroom"
              ? 155
              : 170;
    const generated: SurvivalGrassBlade[] = [];
    const attempts = targetCount * 3;

    for (let index = 0; index < attempts && generated.length < targetCount; index += 1) {
      const localX = (survivalHash01(chunk.cx, chunk.cz, 700 + index) - 0.5) * SURVIVAL_BLOCK_SIZE * 0.92;
      const localZ = (survivalHash01(chunk.cx, chunk.cz, 900 + index) - 0.5) * SURVIVAL_BLOCK_SIZE * 0.92;

      if (chunk.hasVillage && Math.max(Math.abs(localX), Math.abs(localZ)) < BASE_VILLAGE_HALF_SIZE + 20) {
        continue;
      }

      const worldX = chunk.x + localX;
      const worldZ = chunk.z + localZ;
      const terrainY = getSurvivalTerrainHeightForChunk(chunk, localX, localZ);
      const waterY = getSurvivalWaterLevelAtWorld(worldX, worldZ);
      if (terrainY < waterY + 0.12) continue;

      const shape = survivalHash01(chunk.cx, chunk.cz, 1100 + index);
      const heightBase = chunk.biome === "jungle"
        ? 3.4
        : chunk.biome === "swamp"
          ? 2.8
          : chunk.biome === "desert"
            ? 1.2
            : chunk.biome === "mushroom"
              ? 2.4
              : 2.25;
      const heightRange = chunk.biome === "jungle"
        ? 5.2
        : chunk.biome === "swamp"
          ? 4.0
          : chunk.biome === "desert"
            ? 1.9
            : chunk.biome === "mushroom"
              ? 3.3
              : 3.1;

      generated.push({
        key: `${chunk.key}-grass-${index}`,
        x: localX,
        y: terrainY + 0.05,
        z: localZ,
        yaw: survivalHash01(chunk.cx, chunk.cz, 1300 + index) * Math.PI * 2,
        tilt: (survivalHash01(chunk.cx, chunk.cz, 1500 + index) - 0.5) * 0.62,
        width: 0.16 + shape * (chunk.biome === "desert" ? 0.24 : 0.42),
        height: heightBase + shape * heightRange,
        colorIndex: Math.floor(survivalHash01(chunk.cx, chunk.cz, 1700 + index) * palette.length) % palette.length,
      });
    }

    return generated;
  }, [chunk, palette.length]);

  useEffect(() => {
    const meshes = [grassRef0.current, grassRef1.current, grassRef2.current];

    meshes.forEach((mesh, colorIndex) => {
      if (!mesh) return;

      let instance = 0;
      blades.forEach((blade) => {
        if (blade.colorIndex !== colorIndex) return;

        dummy.position.set(chunk.x + blade.x, blade.y + blade.height * 0.48, chunk.z + blade.z);
        dummy.rotation.set(blade.tilt, blade.yaw, Math.sin(blade.yaw + blade.tilt) * 0.1);
        dummy.scale.set(blade.width, blade.height, 1);
        dummy.updateMatrix();
        mesh.setMatrixAt(instance, dummy.matrix);
        instance += 1;
      });

      mesh.count = instance;
      finalizeSurvivalInstancedMesh(mesh, chunk.x, chunk.z, SURVIVAL_BLOCK_SIZE * 0.72, 18);
    });
  }, [blades, chunk.x, chunk.z, dummy]);

  if (blades.length === 0) return null;

  const capacity = Math.max(1, blades.length);
  const opacity = chunk.biome === "desert" ? 0.78 : 0.9;

  return (
    <group name={`survival-grass-${chunk.key}`}>
      <instancedMesh ref={grassRef0} args={[undefined, undefined, capacity]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color={palette[0]} side={THREE.DoubleSide} transparent opacity={opacity} />
      </instancedMesh>
      <instancedMesh ref={grassRef1} args={[undefined, undefined, capacity]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color={palette[1]} side={THREE.DoubleSide} transparent opacity={opacity} />
      </instancedMesh>
      <instancedMesh ref={grassRef2} args={[undefined, undefined, capacity]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color={palette[2]} side={THREE.DoubleSide} transparent opacity={opacity} />
      </instancedMesh>
    </group>
  );
}

type SurvivalBushBlob = {
  key: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  width: number;
  height: number;
  depth: number;
  colorIndex: number;
};

type SurvivalFernFrond = {
  x: number;
  y: number;
  z: number;
  yaw: number;
  tilt: number;
  width: number;
  height: number;
  colorIndex: number;
};

const SURVIVAL_FERN_COLORS: Record<SurvivalBiome, string[]> = {
  plains: ["#3f8f35", "#67a843", "#87bd52"],
  jungle: ["#0f6b34", "#168342", "#25a05a"],
  desert: ["#8b7437", "#b59145", "#cfab5f"],
  swamp: ["#334c23", "#54642d", "#6d793a"],
  mushroom: ["#586f43", "#885caa", "#b478d0"],
};

function SurvivalBushClusters({ chunk }: { chunk: SurvivalChunkInfo }) {
  const bushRef0 = useRef<THREE.InstancedMesh>(null);
  const bushRef1 = useRef<THREE.InstancedMesh>(null);
  const bushRef2 = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const palette = SURVIVAL_BUSH_COLORS[chunk.biome];
  const blobs = useMemo<SurvivalBushBlob[]>(() => {
    if (chunk.lod === "far") return [];

    const densityMultiplier = chunk.lod === "mid" ? 0.32 : 1;
    const baseCount = chunk.biome === "jungle"
      ? 66
      : chunk.biome === "swamp"
        ? 58
        : chunk.biome === "mushroom"
          ? 52
          : chunk.biome === "desert"
            ? 32
            : 54;
    const count = Math.round(baseCount * densityMultiplier);
    const generated: SurvivalBushBlob[] = [];
    const attempts = count * 3;

    for (let index = 0; index < attempts && generated.length < count; index += 1) {
      const localX = (survivalHash01(chunk.cx, chunk.cz, 1810 + index) - 0.5) * SURVIVAL_BLOCK_SIZE * 0.9;
      const localZ = (survivalHash01(chunk.cx, chunk.cz, 1850 + index) - 0.5) * SURVIVAL_BLOCK_SIZE * 0.9;
      if (chunk.hasVillage && Math.max(Math.abs(localX), Math.abs(localZ)) < BASE_VILLAGE_HALF_SIZE + 34) continue;

      const worldX = chunk.x + localX;
      const worldZ = chunk.z + localZ;
      const terrainY = getSurvivalTerrainHeightForChunk(chunk, localX, localZ);
      const waterY = getSurvivalWaterLevelAtWorld(worldX, worldZ);
      if (terrainY < waterY + 0.18) continue;

      const shape = survivalHash01(chunk.cx, chunk.cz, 1890 + index);
      const biomeScale = chunk.biome === "jungle"
        ? 2.2
        : chunk.biome === "swamp"
          ? 1.9
          : chunk.biome === "desert"
            ? 1.15
            : 1.55;
      const height = (1.7 + shape * 3.4) * biomeScale;
      const width = height * (1.45 + survivalHash01(chunk.cx, chunk.cz, 1930 + index) * 1.5);

      generated.push({
        key: `${chunk.key}-bush-${index}`,
        x: localX,
        y: terrainY + height * 0.48,
        z: localZ,
        yaw: survivalHash01(chunk.cx, chunk.cz, 1970 + index) * Math.PI * 2,
        width,
        height,
        depth: height * (0.72 + survivalHash01(chunk.cx, chunk.cz, 2010 + index) * 0.72),
        colorIndex: Math.floor(survivalHash01(chunk.cx, chunk.cz, 2050 + index) * palette.length) % palette.length,
      });
    }

    return generated;
  }, [chunk, palette.length]);

  useEffect(() => {
    const meshes = [bushRef0.current, bushRef1.current, bushRef2.current];

    meshes.forEach((mesh, colorIndex) => {
      if (!mesh) return;

      let instance = 0;
      blobs.forEach((blob) => {
        if (blob.colorIndex !== colorIndex) return;

        dummy.position.set(chunk.x + blob.x, blob.y, chunk.z + blob.z);
        dummy.rotation.set(0, blob.yaw, 0);
        dummy.scale.set(blob.width, blob.height, blob.depth);
        dummy.updateMatrix();
        mesh.setMatrixAt(instance, dummy.matrix);
        instance += 1;
      });

      mesh.count = instance;
      finalizeSurvivalInstancedMesh(mesh, chunk.x, chunk.z, SURVIVAL_BLOCK_SIZE * 0.74, 24);
    });
  }, [blobs, chunk.x, chunk.z, dummy]);

  if (blobs.length === 0) return null;

  const capacity = Math.max(1, blobs.length);

  return (
    <group name={`survival-bushes-${chunk.key}`}>
      <instancedMesh ref={bushRef0} args={[undefined, undefined, capacity]}>
        <dodecahedronGeometry args={[0.5, 0]} />
        <meshBasicMaterial color={palette[0]} />
      </instancedMesh>
      <instancedMesh ref={bushRef1} args={[undefined, undefined, capacity]}>
        <dodecahedronGeometry args={[0.5, 0]} />
        <meshBasicMaterial color={palette[1]} />
      </instancedMesh>
      <instancedMesh ref={bushRef2} args={[undefined, undefined, capacity]}>
        <dodecahedronGeometry args={[0.5, 0]} />
        <meshBasicMaterial color={palette[2]} />
      </instancedMesh>
    </group>
  );
}

function SurvivalFernClusters({ chunk }: { chunk: SurvivalChunkInfo }) {
  const fernRef0 = useRef<THREE.InstancedMesh>(null);
  const fernRef1 = useRef<THREE.InstancedMesh>(null);
  const fernRef2 = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const palette = SURVIVAL_FERN_COLORS[chunk.biome];
  const fronds = useMemo<SurvivalFernFrond[]>(() => {
    if (chunk.lod === "far") return [];

    const baseCount = chunk.lod === "mid"
      ? chunk.biome === "jungle" ? 34 : chunk.biome === "desert" ? 10 : chunk.biome === "swamp" ? 26 : 24
      : chunk.biome === "jungle"
        ? 140
        : chunk.biome === "swamp"
          ? 105
          : chunk.biome === "mushroom"
            ? 100
            : chunk.biome === "desert"
              ? 30
              : 105;
    const generated: SurvivalFernFrond[] = [];
    const attempts = baseCount * 3;

    for (let index = 0; index < attempts && generated.length < baseCount; index += 1) {
      const localX = (survivalHash01(chunk.cx, chunk.cz, 2610 + index) - 0.5) * SURVIVAL_BLOCK_SIZE * 0.93;
      const localZ = (survivalHash01(chunk.cx, chunk.cz, 2650 + index) - 0.5) * SURVIVAL_BLOCK_SIZE * 0.93;
      if (chunk.hasVillage && Math.max(Math.abs(localX), Math.abs(localZ)) < BASE_VILLAGE_HALF_SIZE + 30) continue;

      const worldX = chunk.x + localX;
      const worldZ = chunk.z + localZ;
      const y = getSurvivalTerrainHeightForChunk(chunk, localX, localZ);
      const waterY = getSurvivalWaterLevelAtWorld(worldX, worldZ);
      if (y < waterY + 0.08) continue;

      const variant = survivalHash01(chunk.cx, chunk.cz, 2690 + index);
      const biomeScale = chunk.biome === "jungle"
        ? 1.75
        : chunk.biome === "swamp"
          ? 1.45
          : chunk.biome === "desert"
            ? 0.74
            : 1.1;
      generated.push({
        x: localX,
        y: y + 0.08,
        z: localZ,
        yaw: survivalHash01(chunk.cx, chunk.cz, 2730 + index) * Math.PI * 2,
        tilt: -0.3 + survivalHash01(chunk.cx, chunk.cz, 2770 + index) * 0.58,
        width: (0.42 + variant * 0.68) * biomeScale,
        height: (2.1 + variant * 4.2) * biomeScale,
        colorIndex: Math.floor(survivalHash01(chunk.cx, chunk.cz, 2810 + index) * palette.length) % palette.length,
      });
    }

    return generated;
  }, [chunk, palette.length]);

  useEffect(() => {
    const meshes = [fernRef0.current, fernRef1.current, fernRef2.current];

    meshes.forEach((mesh, colorIndex) => {
      if (!mesh) return;

      let instance = 0;
      fronds.forEach((frond) => {
        if (frond.colorIndex !== colorIndex) return;
        dummy.position.set(chunk.x + frond.x, frond.y + frond.height * 0.5, chunk.z + frond.z);
        dummy.rotation.set(frond.tilt, frond.yaw, Math.sin(frond.yaw) * 0.18);
        dummy.scale.set(frond.width, frond.height, 1);
        dummy.updateMatrix();
        mesh.setMatrixAt(instance, dummy.matrix);
        instance += 1;
      });

      mesh.count = instance;
      finalizeSurvivalInstancedMesh(mesh, chunk.x, chunk.z, SURVIVAL_BLOCK_SIZE * 0.74, 20);
    });
  }, [chunk.x, chunk.z, dummy, fronds]);

  if (fronds.length === 0) return null;

  const capacity = Math.max(1, fronds.length);
  const opacity = chunk.biome === "desert" ? 0.78 : 0.88;

  return (
    <group name={`survival-ferns-${chunk.key}`}>
      <instancedMesh ref={fernRef0} args={[undefined, undefined, capacity]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color={palette[0]} side={THREE.DoubleSide} transparent opacity={opacity} />
      </instancedMesh>
      <instancedMesh ref={fernRef1} args={[undefined, undefined, capacity]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color={palette[1]} side={THREE.DoubleSide} transparent opacity={opacity} />
      </instancedMesh>
      <instancedMesh ref={fernRef2} args={[undefined, undefined, capacity]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color={palette[2]} side={THREE.DoubleSide} transparent opacity={opacity} />
      </instancedMesh>
    </group>
  );
}

function SurvivalFastGroves({ chunk }: { chunk: SurvivalChunkInfo }) {
  const trunkRef = useRef<THREE.InstancedMesh>(null);
  const canopyRef0 = useRef<THREE.InstancedMesh>(null);
  const canopyRef1 = useRef<THREE.InstancedMesh>(null);
  const sideCanopyRef0 = useRef<THREE.InstancedMesh>(null);
  const sideCanopyRef1 = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const canopyColors = SURVIVAL_TREE_CANOPY_COLORS[chunk.biome];
  const trunkColor = SURVIVAL_TREE_TRUNK_COLORS[chunk.biome];
  const trees = useMemo<SurvivalFastGroveTree[]>(() => {
    if (chunk.lod === "far") return [];

    const density = chunk.lod === "mid" ? 0.28 : 1;
    const baseCount = chunk.biome === "jungle"
      ? 27
      : chunk.biome === "swamp"
        ? 22
        : chunk.biome === "mushroom"
          ? 18
          : chunk.biome === "desert"
            ? 11
            : 21;
    const count = Math.round(baseCount * density);
    const generated: SurvivalFastGroveTree[] = [];
    const attempts = count * 10;

    for (let index = 0; index < attempts && generated.length < count; index += 1) {
      const localX = (survivalHash01(chunk.cx, chunk.cz, 2310 + index) - 0.5) * SURVIVAL_BLOCK_SIZE * 0.94;
      const localZ = (survivalHash01(chunk.cx, chunk.cz, 2350 + index) - 0.5) * SURVIVAL_BLOCK_SIZE * 0.94;
      if (chunk.hasVillage && Math.max(Math.abs(localX), Math.abs(localZ)) < BASE_VILLAGE_HALF_SIZE + 40) continue;
      if (chunk.biome !== "desert" && Math.min(Math.abs(localX), Math.abs(localZ)) < 22) continue;

      const worldX = chunk.x + localX;
      const worldZ = chunk.z + localZ;
      const y = getSurvivalTerrainHeightForChunk(chunk, localX, localZ);
      const waterY = getSurvivalWaterLevelAtWorld(worldX, worldZ);
      if (y < waterY + 0.2) continue;

      const spacing = chunk.biome === "jungle"
        ? 24
        : chunk.biome === "swamp"
          ? 22
          : chunk.biome === "desert"
            ? 32
            : 26;
      if (generated.some(tree => Math.hypot(tree.x - localX, tree.z - localZ) < spacing)) continue;

      const variant = survivalHash01(chunk.cx, chunk.cz, 2390 + index);
      const profile = getFastGroveTreeProfile(chunk.biome, variant);
      generated.push({
        x: localX,
        y,
        z: localZ,
        yaw: survivalHash01(chunk.cx, chunk.cz, 2430 + index) * Math.PI * 2,
        trunkHeight: profile.trunkHeight,
        trunkRadius: profile.trunkRadius,
        canopyRadius: profile.canopyRadius,
        canopyHeight: profile.canopyHeight,
        colorIndex: Math.floor(survivalHash01(chunk.cx, chunk.cz, 2470 + index) * canopyColors.length) % canopyColors.length,
        variant,
      });
    }

    return generated;
  }, [canopyColors.length, chunk]);

  useEffect(() => {
    const trunkMesh = trunkRef.current;
    if (trunkMesh) {
      trees.forEach((tree, index) => {
        const lean = (tree.variant - 0.5) * 0.08;
        dummy.position.set(chunk.x + tree.x, tree.y + tree.trunkHeight * 0.5, chunk.z + tree.z);
        dummy.rotation.set(lean, tree.yaw, -lean * 0.6);
        dummy.scale.set(tree.trunkRadius, tree.trunkHeight, tree.trunkRadius);
        dummy.updateMatrix();
        trunkMesh.setMatrixAt(index, dummy.matrix);
      });
      trunkMesh.count = trees.length;
      finalizeSurvivalInstancedMesh(trunkMesh, chunk.x, chunk.z, SURVIVAL_BLOCK_SIZE * 0.84, 72);
    }

    const canopyMeshes = [canopyRef0.current, canopyRef1.current];
    const sideMeshes = [sideCanopyRef0.current, sideCanopyRef1.current];
    canopyMeshes.forEach((mesh, colorIndex) => {
      if (!mesh) return;
      let instance = 0;
      trees.forEach((tree) => {
        if (tree.colorIndex !== colorIndex) return;
        dummy.position.set(chunk.x + tree.x, tree.y + tree.trunkHeight + tree.canopyHeight * 0.2, chunk.z + tree.z);
        dummy.rotation.set(0, tree.yaw, 0);
        dummy.scale.set(tree.canopyRadius * 1.25, tree.canopyHeight, tree.canopyRadius);
        dummy.updateMatrix();
        mesh.setMatrixAt(instance, dummy.matrix);
        instance += 1;
      });
      mesh.count = instance;
      finalizeSurvivalInstancedMesh(mesh, chunk.x, chunk.z, SURVIVAL_BLOCK_SIZE * 0.88, 96);
    });

    sideMeshes.forEach((mesh, colorIndex) => {
      if (!mesh) return;
      let instance = 0;
      trees.forEach((tree) => {
        if (tree.colorIndex !== colorIndex) return;
        const side = tree.variant > 0.5 ? 1 : -1;
        const offset = tree.canopyRadius * 0.62;
        dummy.position.set(
          chunk.x + tree.x + Math.sin(tree.yaw) * offset * side,
          tree.y + tree.trunkHeight + tree.canopyHeight * 0.02,
          chunk.z + tree.z + Math.cos(tree.yaw) * offset * side
        );
        dummy.rotation.set(0.05, tree.yaw + side * 0.4, 0.02 * side);
        dummy.scale.set(tree.canopyRadius * 0.78, tree.canopyHeight * 0.78, tree.canopyRadius * 0.64);
        dummy.updateMatrix();
        mesh.setMatrixAt(instance, dummy.matrix);
        instance += 1;
      });
      mesh.count = instance;
      finalizeSurvivalInstancedMesh(mesh, chunk.x, chunk.z, SURVIVAL_BLOCK_SIZE * 0.88, 86);
    });
  }, [chunk.x, chunk.z, dummy, trees]);

  if (trees.length === 0) return null;

  const capacity = Math.max(1, trees.length);
  const canopyOpacity = chunk.biome === "desert" ? 0.92 : 1;

  return (
    <group name={`survival-fast-groves-${chunk.key}`}>
      <instancedMesh ref={trunkRef} args={[undefined, undefined, capacity]}>
        <cylinderGeometry args={[1, 1, 1, 5]} />
        <meshBasicMaterial color={trunkColor} />
      </instancedMesh>
      <instancedMesh ref={canopyRef0} args={[undefined, undefined, capacity]}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshBasicMaterial color={canopyColors[0]} transparent={canopyOpacity < 1} opacity={canopyOpacity} />
      </instancedMesh>
      <instancedMesh ref={canopyRef1} args={[undefined, undefined, capacity]}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshBasicMaterial color={canopyColors[1]} transparent={canopyOpacity < 1} opacity={canopyOpacity} />
      </instancedMesh>
      <instancedMesh ref={sideCanopyRef0} args={[undefined, undefined, capacity]}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshBasicMaterial color={canopyColors[0]} transparent={canopyOpacity < 1} opacity={canopyOpacity * 0.94} />
      </instancedMesh>
      <instancedMesh ref={sideCanopyRef1} args={[undefined, undefined, capacity]}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshBasicMaterial color={canopyColors[1]} transparent={canopyOpacity < 1} opacity={canopyOpacity * 0.94} />
      </instancedMesh>
    </group>
  );
}

function SurvivalRoofForests({ chunk }: { chunk: SurvivalChunkInfo }) {
  const trunkRef = useRef<THREE.InstancedMesh>(null);
  const topCanopyRef0 = useRef<THREE.InstancedMesh>(null);
  const topCanopyRef1 = useRef<THREE.InstancedMesh>(null);
  const topCanopyRef2 = useRef<THREE.InstancedMesh>(null);
  const lowerCanopyRef0 = useRef<THREE.InstancedMesh>(null);
  const lowerCanopyRef1 = useRef<THREE.InstancedMesh>(null);
  const lowerCanopyRef2 = useRef<THREE.InstancedMesh>(null);
  const vineRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const canopyColors = SURVIVAL_ROOF_FOREST_CANOPY_COLORS[chunk.biome];
  const trunkColor = chunk.biome === "jungle"
    ? "#20130c"
    : chunk.biome === "mushroom"
      ? "#553064"
      : "#3f2818";
  const vineColor = chunk.biome === "mushroom"
    ? "#d783e5"
    : chunk.biome === "jungle"
      ? "#1f6d2c"
      : "#2f7a36";

  const trees = useMemo<SurvivalRoofForestTree[]>(() => {
    if (chunk.lod === "far" || !supportsRoofForest(chunk.biome)) return [];

    const near = chunk.lod === "near";
    const targetCount = near
      ? chunk.biome === "jungle" ? 60 : chunk.biome === "mushroom" ? 46 : 52
      : chunk.biome === "jungle" ? 18 : chunk.biome === "mushroom" ? 14 : 16;
    const clusterCount = near ? (chunk.biome === "jungle" ? 5 : 4) : 2;
    const clusterRadius = chunk.biome === "jungle" ? 154 : chunk.biome === "mushroom" ? 124 : 132;
    const centers = Array.from({ length: clusterCount }, (_, centerIndex) => ({
      x: (survivalHash01(chunk.cx, chunk.cz, 6410 + centerIndex) - 0.5) * SURVIVAL_BLOCK_SIZE * 0.68,
      z: (survivalHash01(chunk.cx, chunk.cz, 6460 + centerIndex) - 0.5) * SURVIVAL_BLOCK_SIZE * 0.68,
      radius: clusterRadius * (0.78 + survivalHash01(chunk.cx, chunk.cz, 6510 + centerIndex) * 0.44),
    }));
    const generated: SurvivalRoofForestTree[] = [];
    const attempts = targetCount * 8;

    for (let index = 0; index < attempts && generated.length < targetCount; index += 1) {
      const center = centers[index % centers.length];
      const angle = survivalHash01(chunk.cx, chunk.cz, 6560 + index) * Math.PI * 2;
      const distance = Math.pow(survivalHash01(chunk.cx, chunk.cz, 6610 + index), 0.62) * center.radius;
      const localX = center.x + Math.cos(angle) * distance + (survivalHash01(chunk.cx, chunk.cz, 6660 + index) - 0.5) * 24;
      const localZ = center.z + Math.sin(angle) * distance + (survivalHash01(chunk.cx, chunk.cz, 6710 + index) - 0.5) * 24;
      if (Math.abs(localX) > SURVIVAL_BLOCK_SIZE * 0.47 || Math.abs(localZ) > SURVIVAL_BLOCK_SIZE * 0.47) continue;
      if (chunk.hasVillage && Math.max(Math.abs(localX), Math.abs(localZ)) < BASE_VILLAGE_HALF_SIZE + 62) continue;
      if (Math.min(Math.abs(localX), Math.abs(localZ)) < 16) continue;

      const worldX = chunk.x + localX;
      const worldZ = chunk.z + localZ;
      const y = getSurvivalTerrainHeightForChunk(chunk, localX, localZ);
      const waterY = getSurvivalWaterLevelAtWorld(worldX, worldZ);
      if (y < waterY + 0.26) continue;

      const spacing = near
        ? chunk.biome === "jungle" ? 10.5 : 12.5
        : chunk.biome === "jungle" ? 18 : 22;
      if (generated.some(tree => Math.hypot(tree.x - localX, tree.z - localZ) < spacing)) continue;

      const variant = survivalHash01(chunk.cx, chunk.cz, 6760 + index);
      const heightBias = chunk.biome === "jungle" ? 1.16 : chunk.biome === "mushroom" ? 0.92 : 1;
      const trunkHeight = (72 + variant * 62 + survivalHash01(chunk.cx, chunk.cz, 6810 + index) * 34) * heightBias;
      const canopyScale = chunk.biome === "jungle" ? 1.18 : chunk.biome === "mushroom" ? 1.05 : 1;
      const canopyWidth = (20 + variant * 22) * canopyScale;
      const canopyDepth = (18 + survivalHash01(chunk.cx, chunk.cz, 6860 + index) * 20) * canopyScale;
      const canopyThickness = (4.6 + survivalHash01(chunk.cx, chunk.cz, 6910 + index) * 5.2) * (
        chunk.biome === "jungle" ? 1.1 : chunk.biome === "mushroom" ? 1.18 : 1
      );
      const vineLength = chunk.biome === "jungle"
        ? 10 + survivalHash01(chunk.cx, chunk.cz, 7110 + index) * 28
        : chunk.biome === "mushroom"
          ? 8 + survivalHash01(chunk.cx, chunk.cz, 7110 + index) * 22
          : 6 + survivalHash01(chunk.cx, chunk.cz, 7110 + index) * 16;

      generated.push({
        x: localX,
        y,
        z: localZ,
        yaw: survivalHash01(chunk.cx, chunk.cz, 6960 + index) * Math.PI * 2,
        trunkHeight,
        trunkRadius: (1.05 + survivalHash01(chunk.cx, chunk.cz, 7010 + index) * 1.1) * heightBias,
        canopyWidth,
        canopyDepth,
        canopyThickness,
        colorIndex: Math.floor(survivalHash01(chunk.cx, chunk.cz, 7060 + index) * canopyColors.length) % canopyColors.length,
        vineLength,
        variant,
      });
    }

    return generated;
  }, [canopyColors.length, chunk]);

  useEffect(() => {
    const trunkMesh = trunkRef.current;
    if (trunkMesh) {
      trees.forEach((tree, index) => {
        const lean = (tree.variant - 0.5) * 0.035;
        dummy.position.set(chunk.x + tree.x, tree.y + tree.trunkHeight * 0.5, chunk.z + tree.z);
        dummy.rotation.set(lean, tree.yaw, -lean * 0.4);
        dummy.scale.set(tree.trunkRadius, tree.trunkHeight, tree.trunkRadius);
        dummy.updateMatrix();
        trunkMesh.setMatrixAt(index, dummy.matrix);
      });
      trunkMesh.count = trees.length;
      finalizeSurvivalInstancedMesh(trunkMesh, chunk.x, chunk.z, SURVIVAL_BLOCK_SIZE * 0.9, 88);
    }

    const topMeshes = [topCanopyRef0.current, topCanopyRef1.current, topCanopyRef2.current];
    const lowerMeshes = [lowerCanopyRef0.current, lowerCanopyRef1.current, lowerCanopyRef2.current];
    topMeshes.forEach((mesh, colorIndex) => {
      if (!mesh) return;
      let instance = 0;
      trees.forEach((tree) => {
        if (tree.colorIndex !== colorIndex) return;
        dummy.position.set(chunk.x + tree.x, tree.y + tree.trunkHeight + tree.canopyThickness * 0.28, chunk.z + tree.z);
        dummy.rotation.set(0.02, tree.yaw, 0);
        dummy.scale.set(tree.canopyWidth, tree.canopyThickness, tree.canopyDepth);
        dummy.updateMatrix();
        mesh.setMatrixAt(instance, dummy.matrix);
        instance += 1;
      });
      mesh.count = instance;
      finalizeSurvivalInstancedMesh(mesh, chunk.x, chunk.z, SURVIVAL_BLOCK_SIZE * 0.92, 128);
    });

    lowerMeshes.forEach((mesh, colorIndex) => {
      if (!mesh) return;
      let instance = 0;
      trees.forEach((tree) => {
        if (tree.colorIndex !== colorIndex) return;
        const side = tree.variant > 0.5 ? 1 : -1;
        const offset = tree.canopyWidth * 0.28;
        dummy.position.set(
          chunk.x + tree.x + Math.cos(tree.yaw) * offset * side,
          tree.y + tree.trunkHeight - tree.canopyThickness * 0.34,
          chunk.z + tree.z + Math.sin(tree.yaw) * offset * side,
        );
        dummy.rotation.set(0.1 * side, tree.yaw + side * 0.28, 0.03 * side);
        dummy.scale.set(tree.canopyWidth * 0.72, tree.canopyThickness * 0.75, tree.canopyDepth * 0.72);
        dummy.updateMatrix();
        mesh.setMatrixAt(instance, dummy.matrix);
        instance += 1;
      });
      mesh.count = instance;
      finalizeSurvivalInstancedMesh(mesh, chunk.x, chunk.z, SURVIVAL_BLOCK_SIZE * 0.92, 112);
    });

    const vineMesh = vineRef.current;
    if (vineMesh) {
      let instance = 0;
      trees.forEach((tree) => {
        if (tree.vineLength <= 0 || tree.variant < 0.38) return;
        const side = tree.variant > 0.68 ? 1 : -1;
        const offset = tree.canopyWidth * (0.22 + tree.variant * 0.18);
        dummy.position.set(
          chunk.x + tree.x + Math.cos(tree.yaw + 1.1) * offset * side,
          tree.y + tree.trunkHeight - tree.vineLength * 0.5,
          chunk.z + tree.z + Math.sin(tree.yaw + 1.1) * offset * side,
        );
        dummy.rotation.set(0.06, tree.yaw, 0.12 * side);
        dummy.scale.set(0.34 + tree.variant * 0.18, tree.vineLength, 1);
        dummy.updateMatrix();
        vineMesh.setMatrixAt(instance, dummy.matrix);
        instance += 1;
      });
      vineMesh.count = instance;
      finalizeSurvivalInstancedMesh(vineMesh, chunk.x, chunk.z, SURVIVAL_BLOCK_SIZE * 0.9, 96);
    }
  }, [chunk.x, chunk.z, dummy, trees]);

  if (trees.length === 0) return null;

  const capacity = Math.max(1, trees.length);

  return (
    <group name={`survival-roof-forest-${chunk.key}`}>
      <instancedMesh ref={trunkRef} args={[undefined, undefined, capacity]}>
        <cylinderGeometry args={[1, 1, 1, 6]} />
        <meshBasicMaterial color={trunkColor} />
      </instancedMesh>
      <instancedMesh ref={topCanopyRef0} args={[undefined, undefined, capacity]}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshBasicMaterial color={canopyColors[0]} />
      </instancedMesh>
      <instancedMesh ref={topCanopyRef1} args={[undefined, undefined, capacity]}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshBasicMaterial color={canopyColors[1]} />
      </instancedMesh>
      <instancedMesh ref={topCanopyRef2} args={[undefined, undefined, capacity]}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshBasicMaterial color={canopyColors[2]} />
      </instancedMesh>
      <instancedMesh ref={lowerCanopyRef0} args={[undefined, undefined, capacity]}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshBasicMaterial color={canopyColors[0]} />
      </instancedMesh>
      <instancedMesh ref={lowerCanopyRef1} args={[undefined, undefined, capacity]}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshBasicMaterial color={canopyColors[1]} />
      </instancedMesh>
      <instancedMesh ref={lowerCanopyRef2} args={[undefined, undefined, capacity]}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshBasicMaterial color={canopyColors[2]} />
      </instancedMesh>
      <instancedMesh ref={vineRef} args={[undefined, undefined, capacity]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color={vineColor} side={THREE.DoubleSide} transparent opacity={chunk.biome === "mushroom" ? 0.68 : 0.76} />
      </instancedMesh>
    </group>
  );
}

function HobbitHutColliders({ hut, chunk }: { hut: SurvivalHobbitHut; chunk: SurvivalChunkInfo }) {
  if (chunk.distance !== 0) return null;

  return (
    <RigidBody
      type="fixed"
      colliders={false}
      position={[chunk.x + hut.localX, hut.y, chunk.z + hut.localZ]}
      rotation={[0, hut.yaw, 0]}
      name={`survival-hobbit-hut-collider-${hut.key}`}
    >
      <CuboidCollider args={[6.8 * hut.scale, 3.2 * hut.scale, 4.6 * hut.scale]} position={[0, 2.9 * hut.scale, 0.8 * hut.scale]} />
    </RigidBody>
  );
}

function SurvivalHobbitHutModel({ hut, chunk }: { hut: SurvivalHobbitHut; chunk: SurvivalChunkInfo }) {
  const scale = hut.scale;
  const roofGreen = chunk.biome === "jungle"
    ? "#1d5a2c"
    : chunk.biome === "mushroom"
      ? "#8e4aa2"
      : "#3f7734";
  const roofDark = chunk.biome === "jungle"
    ? "#123d20"
    : chunk.biome === "mushroom"
      ? "#5d336f"
      : "#2d5d29";
  const earthColor = chunk.biome === "jungle"
    ? "#3a2416"
    : chunk.biome === "mushroom"
      ? "#4a3158"
      : "#4d311f";
  const plankColor = chunk.biome === "jungle"
    ? "#5a341e"
    : chunk.biome === "mushroom"
      ? "#70446f"
      : "#6a4125";

  return (
    <group
      name={hut.key}
      position={[chunk.x + hut.localX, hut.y, chunk.z + hut.localZ]}
      rotation={[0, hut.yaw, 0]}
      scale={[scale, scale, scale]}
    >
      <mesh position={[0, 2.7, 0.7]} scale={[10.8, 4.6, 8.2]} castShadow={false}>
        <dodecahedronGeometry args={[1, 1]} />
        <meshBasicMaterial color={earthColor} />
      </mesh>
      <mesh position={[0, 4.35, 0.1]} scale={[10.4, 2.25, 7.8]} castShadow={false}>
        <dodecahedronGeometry args={[1, 1]} />
        <meshBasicMaterial color={roofGreen} />
      </mesh>
      <mesh position={[0, 5.25, -0.2]} scale={[7.4, 0.72, 5.8]} castShadow={false}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshBasicMaterial color={roofDark} />
      </mesh>
      <mesh position={[0, 2.95, -7.48]} castShadow={false}>
        <boxGeometry args={[10.2, 5.9, 0.52]} />
        <meshBasicMaterial color="#2c1b13" />
      </mesh>
      {[-4.25, -2.55, -0.85, 0.85, 2.55, 4.25].map((x) => (
        <mesh key={x} position={[x, 3.0, -7.82]} castShadow={false}>
          <boxGeometry args={[1.06, 5.25, 0.42]} />
          <meshBasicMaterial color={plankColor} />
        </mesh>
      ))}
      <mesh position={[0, 2.54, -8.08]} castShadow={false}>
        <boxGeometry args={[3.32, 4.42, 0.54]} />
        <meshBasicMaterial color="#1c120d" />
      </mesh>
      <mesh position={[0, 2.58, -8.12]} castShadow={false}>
        <boxGeometry args={[2.35, 3.22, 0.58]} />
        <meshBasicMaterial color="#ef6d1b" transparent opacity={0.68} />
      </mesh>
      <mesh position={[0, 4.96, -8.18]} rotation={[0, 0, Math.PI / 2]} castShadow={false}>
        <cylinderGeometry args={[0.34, 0.34, 8.6, 6]} />
        <meshBasicMaterial color="#5a321c" />
      </mesh>
      {[-4.76, 4.76].map((x) => (
        <mesh key={x} position={[x, 2.98, -8.16]} castShadow={false}>
          <cylinderGeometry args={[0.34, 0.34, 5.28, 6]} />
          <meshBasicMaterial color="#5a321c" />
        </mesh>
      ))}
      <mesh position={[-5.9, 0.13, -10.2]} rotation={[-Math.PI / 2, 0, hut.variant * Math.PI]} castShadow={false}>
        <planeGeometry args={[7.8, 9.5]} />
        <meshBasicMaterial color="#5b3b22" transparent opacity={0.78} />
      </mesh>
      <mesh position={[3.95, 7.05, -1.55]} castShadow={false}>
        <boxGeometry args={[1.45, 4.2, 1.45]} />
        <meshBasicMaterial color="#47301f" />
      </mesh>
      {[0, 1, 2].map((smoke) => (
        <mesh key={smoke} position={[4.12 + smoke * 0.62, 10.0 + smoke * 1.35, -1.55 - smoke * 0.34]} scale={[1 + smoke * 0.38, 0.72 + smoke * 0.18, 1 + smoke * 0.32]} castShadow={false}>
          <dodecahedronGeometry args={[0.7, 0]} />
          <meshBasicMaterial color="#d5d0c2" transparent opacity={0.28 - smoke * 0.06} />
        </mesh>
      ))}
      {[-4.9, -2.9, 3.0, 5.2].map((x, index) => (
        <mesh key={x} position={[x, 5.45 + index * 0.18, -6.25 + (index % 2) * 0.7]} rotation={[0.18, index * 0.7, -0.12]} castShadow={false}>
          <planeGeometry args={[1.1, 2.8]} />
          <meshBasicMaterial color={index % 2 === 0 ? "#4d9a3e" : "#6fb64a"} side={THREE.DoubleSide} transparent opacity={0.9} />
        </mesh>
      ))}
    </group>
  );
}

function SurvivalHobbitHuts({ chunk }: { chunk: SurvivalChunkInfo }) {
  const huts = useMemo<SurvivalHobbitHut[]>(() => {
    if (chunk.lod !== "near" || !supportsRoofForest(chunk.biome) || chunk.hasVillage) return [];
    const spawnRoll = survivalHash01(chunk.cx, chunk.cz, 7310);
    const shouldSpawn = chunk.biome === "jungle"
      ? spawnRoll > 0.68
      : chunk.biome === "mushroom"
        ? spawnRoll > 0.72
        : spawnRoll > 0.74;
    if (!shouldSpawn) return [];

    const generated: SurvivalHobbitHut[] = [];
    for (let index = 0; index < 10 && generated.length < 1; index += 1) {
      const localX = (survivalHash01(chunk.cx, chunk.cz, 7360 + index) - 0.5) * SURVIVAL_BLOCK_SIZE * 0.72;
      const localZ = (survivalHash01(chunk.cx, chunk.cz, 7410 + index) - 0.5) * SURVIVAL_BLOCK_SIZE * 0.72;
      if (Math.min(Math.abs(localX), Math.abs(localZ)) < 54) continue;

      const worldX = chunk.x + localX;
      const worldZ = chunk.z + localZ;
      const y = getSurvivalTerrainHeightForChunk(chunk, localX, localZ);
      const waterY = getSurvivalWaterLevelAtWorld(worldX, worldZ);
      if (y < waterY + 0.42) continue;

      const yNorth = getSurvivalTerrainHeightForChunk(chunk, localX, localZ - 7);
      const ySouth = getSurvivalTerrainHeightForChunk(chunk, localX, localZ + 7);
      const yEast = getSurvivalTerrainHeightForChunk(chunk, localX + 7, localZ);
      const yWest = getSurvivalTerrainHeightForChunk(chunk, localX - 7, localZ);
      if (Math.max(yNorth, ySouth, yEast, yWest) - Math.min(yNorth, ySouth, yEast, yWest) > 7.5) continue;

      generated.push({
        key: `${chunk.key}-hobbit-hut-${index}`,
        localX,
        localZ,
        y,
        yaw: survivalHash01(chunk.cx, chunk.cz, 7460 + index) * Math.PI * 2,
        scale: 1.12 + survivalHash01(chunk.cx, chunk.cz, 7510 + index) * 0.38,
        variant: survivalHash01(chunk.cx, chunk.cz, 7560 + index),
      });
    }

    return generated;
  }, [chunk]);

  if (huts.length === 0) return null;

  return (
    <>
      {huts.map((hut) => (
        <group key={hut.key}>
          <SurvivalHobbitHutModel hut={hut} chunk={chunk} />
          <HobbitHutColliders hut={hut} chunk={chunk} />
        </group>
      ))}
    </>
  );
}

function SurvivalBiomeTree({
  biome,
  prop,
  worldX,
  worldZ,
}: {
  biome: SurvivalBiome;
  prop: SurvivalScatterProp;
  worldX: number;
  worldZ: number;
}) {
  const visualScale = getSurvivalTreeVisualScale(biome, prop.scale);
  const footprintScale = getSurvivalTreeFootprintScale(biome, visualScale);
  const style = survivalBiomeStyle[biome];
  const yaw = prop.variant * Math.PI * 2;

  if (biome === "mushroom") {
    return (
      <group position={[worldX, prop.y, worldZ]} rotation={[0, yaw, 0]} scale={[footprintScale, visualScale, footprintScale]}>
        <mesh position={[0, 3.8, 0]} castShadow={false}>
          <cylinderGeometry args={[0.75, 1.05, 7.6, 6]} />
          <meshLambertMaterial color="#e8d5bb" />
        </mesh>
        <mesh position={[0, 8.3, 0]} castShadow={false}>
          <dodecahedronGeometry args={[3.1, 0]} />
          <meshLambertMaterial color={style.accent} />
        </mesh>
        <mesh position={[2.7, 4.4, -1.8]} scale={[0.72, 0.72, 0.72]} castShadow={false}>
          <cylinderGeometry args={[0.55, 0.78, 5.2, 6]} />
          <meshLambertMaterial color="#dfcab0" />
        </mesh>
        <mesh position={[2.7, 7.5, -1.8]} scale={[0.72, 0.72, 0.72]} castShadow={false}>
          <dodecahedronGeometry args={[2.6, 0]} />
          <meshLambertMaterial color="#eb80f0" />
        </mesh>
      </group>
    );
  }

  if (biome === "jungle") {
    const branchColor = "#3a2418";
    const canopy = prop.variant > 0.5 ? "#1f6b35" : "#23763b";
    const brightCanopy = prop.variant > 0.5 ? "#32914d" : "#2e8547";

    return (
      <group position={[worldX, prop.y, worldZ]} rotation={[0, yaw, 0]} scale={[footprintScale, visualScale, footprintScale]}>
        <mesh position={[0, 17, 0]} rotation={[0.08, 0, 0.05]} castShadow={false}>
          <cylinderGeometry args={[1.35, 2.45, 34, 6]} />
          <meshBasicMaterial color={branchColor} />
        </mesh>
        <SurvivalBranch start={new THREE.Vector3(0, 19, 0)} end={new THREE.Vector3(10, 27, -4)} radius={0.52} color={branchColor} />
        <SurvivalBranch start={new THREE.Vector3(0, 23, 0)} end={new THREE.Vector3(-12, 32, 3)} radius={0.48} color={branchColor} />
        <SurvivalBranch start={new THREE.Vector3(0, 26, 0)} end={new THREE.Vector3(7, 36, 8)} radius={0.42} color={branchColor} />
        <mesh position={[0, 36, 0]} castShadow={false}>
          <dodecahedronGeometry args={[7.2, 0]} />
          <meshBasicMaterial color={canopy} />
        </mesh>
        <mesh position={[6.8, 32.5, -4.2]} castShadow={false}>
          <dodecahedronGeometry args={[5.4, 0]} />
          <meshBasicMaterial color={brightCanopy} />
        </mesh>
        <mesh position={[-7.5, 35.5, 3.2]} castShadow={false}>
          <dodecahedronGeometry args={[5.8, 0]} />
          <meshBasicMaterial color="#2c7b3f" />
        </mesh>
        <mesh position={[2.8, 42, 5.6]} castShadow={false}>
          <dodecahedronGeometry args={[5.2, 0]} />
          <meshBasicMaterial color="#1d5f32" />
        </mesh>
        <SurvivalHangingVine x={9.2} y={27.2} z={-3.7} length={13.5} sway={prop.variant * 5.1} />
        <SurvivalHangingVine x={-10.6} y={32.2} z={3.1} length={16.5} sway={prop.variant * 4.4 + 1.7} />
        <SurvivalHangingVine x={5.6} y={36} z={7.6} length={12.2} sway={prop.variant * 3.8 + 2.4} />
      </group>
    );
  }

  if (biome === "swamp") {
    return (
      <group position={[worldX, prop.y, worldZ]} rotation={[0, yaw, 0]} scale={[footprintScale, visualScale, footprintScale]}>
        <mesh position={[0, 13, 0]} rotation={[0.1, 0, -0.07]} castShadow={false}>
          <cylinderGeometry args={[1.2, 2.25, 26, 6]} />
          <meshBasicMaterial color="#3a2a1d" />
        </mesh>
        <SurvivalBranch start={new THREE.Vector3(0, 14, 0)} end={new THREE.Vector3(8.4, 21, -3.2)} radius={0.46} color="#3a2a1d" />
        <SurvivalBranch start={new THREE.Vector3(0, 17, 0)} end={new THREE.Vector3(-7.8, 23.5, 4.6)} radius={0.4} color="#3a2a1d" />
        <SurvivalBranch start={new THREE.Vector3(-0.2, 4.5, 0)} end={new THREE.Vector3(-4.8, 1.1, -4.5)} radius={0.36} color="#2d2117" />
        <SurvivalBranch start={new THREE.Vector3(0.3, 4.2, 0)} end={new THREE.Vector3(5.2, 1, 3.6)} radius={0.34} color="#2d2117" />
        <mesh position={[0, 25, 0]} castShadow={false}>
          <dodecahedronGeometry args={[5.5, 0]} />
          <meshBasicMaterial color="#56652b" />
        </mesh>
        <mesh position={[5.5, 22.5, -2.4]} castShadow={false}>
          <dodecahedronGeometry args={[4.1, 0]} />
          <meshBasicMaterial color="#667536" />
        </mesh>
        <mesh position={[-4.8, 24.4, 3.5]} castShadow={false}>
          <dodecahedronGeometry args={[4.4, 0]} />
          <meshBasicMaterial color="#4a5f28" />
        </mesh>
        <SurvivalHangingVine x={7.2} y={21.3} z={-2.6} length={12.2} sway={prop.variant * 5.7} />
        <SurvivalHangingVine x={-6.3} y={23.8} z={4.3} length={13.4} sway={prop.variant * 4.2 + 1.2} />
      </group>
    );
  }

  return (
    <group position={[worldX, prop.y, worldZ]} rotation={[0, yaw, 0]} scale={[footprintScale, visualScale, footprintScale]}>
      <mesh position={[0, 10.8, 0]} castShadow={false}>
        <cylinderGeometry args={[0.95, 1.55, 21.6, 6]} />
        <meshBasicMaterial color="#5b3a20" />
      </mesh>
      <SurvivalBranch start={new THREE.Vector3(0, 10, 0)} end={new THREE.Vector3(6.4, 17.5, -2.4)} radius={0.38} color="#5b3a20" />
      <SurvivalBranch start={new THREE.Vector3(0, 12.2, 0)} end={new THREE.Vector3(-6.8, 18.8, 3.1)} radius={0.35} color="#5b3a20" />
      <SurvivalBranch start={new THREE.Vector3(0, 15.5, 0)} end={new THREE.Vector3(4.5, 21.5, 4.7)} radius={0.31} color="#5b3a20" />
      <mesh position={[0, 22, 0]} castShadow={false}>
        <dodecahedronGeometry args={[5.2, 0]} />
        <meshBasicMaterial color={style.accent} />
      </mesh>
      <mesh position={[4.8, 18.5, -2.2]} castShadow={false}>
        <dodecahedronGeometry args={[3.9, 0]} />
        <meshBasicMaterial color="#6aa846" />
      </mesh>
      <mesh position={[-5.2, 20.2, 2.6]} castShadow={false}>
        <dodecahedronGeometry args={[4.2, 0]} />
        <meshBasicMaterial color="#5d9b3f" />
      </mesh>
    </group>
  );
}

function DesertCactus({ x, y, z, scale, variant }: { x: number; y: number; z: number; scale: number; variant: number }) {
  const cactusScale = scale * (variant > 0.62 ? 1.16 : 0.92);
  const armHeight = 3.8 * cactusScale;
  const armSide = variant > 0.5 ? -1 : 1;

  return (
    <group position={[x, y, z]} scale={[cactusScale, cactusScale, cactusScale]}>
      <mesh position={[0, 4.6, 0]} castShadow={false}>
        <cylinderGeometry args={[0.72, 0.9, 9.2, 6]} />
        <meshBasicMaterial color="#2f7a3f" />
      </mesh>
      <mesh position={[0, 9.25, 0]} castShadow={false}>
        <sphereGeometry args={[0.72, 6, 4]} />
        <meshBasicMaterial color="#3a8f4b" />
      </mesh>
      <mesh position={[armSide * 1.45, armHeight + 1.9, 0]} rotation={[0, 0, Math.PI / 2]} castShadow={false}>
        <cylinderGeometry args={[0.34, 0.42, 2.4, 5]} />
        <meshBasicMaterial color="#2f7a3f" />
      </mesh>
      <mesh position={[armSide * 2.55, armHeight + 2.8, 0]} castShadow={false}>
        <cylinderGeometry args={[0.34, 0.4, 2.9, 5]} />
        <meshBasicMaterial color="#3a8f4b" />
      </mesh>
      <mesh position={[-armSide * 1.2, armHeight + 0.2, 0]} rotation={[0, 0, Math.PI / 2]} castShadow={false}>
        <cylinderGeometry args={[0.25, 0.32, 1.8, 5]} />
        <meshBasicMaterial color="#256b37" />
      </mesh>
      <mesh position={[-armSide * 2.05, armHeight + 0.85, 0]} castShadow={false}>
        <cylinderGeometry args={[0.25, 0.3, 2.1, 5]} />
        <meshBasicMaterial color="#2f7a3f" />
      </mesh>
    </group>
  );
}

function DesertTumbleweed({ x, y, z, scale, seed }: { x: number; y: number; z: number; scale: number; seed: number }) {
  const tumbleScale = scale * 1.25;

  return (
    <group
      position={[x + Math.sin(seed * 6.28) * 2.2, y + 1.35 * tumbleScale, z]}
      rotation={[seed * Math.PI * 2, seed * Math.PI, seed * Math.PI * 1.3]}
      scale={[tumbleScale, tumbleScale, tumbleScale]}
    >
      <mesh castShadow={false}>
        <dodecahedronGeometry args={[1.25, 0]} />
        <meshBasicMaterial color="#9b6a35" wireframe />
      </mesh>
      <mesh rotation={[0.6, 0.3, 0.15]} castShadow={false}>
        <cylinderGeometry args={[0.045, 0.045, 2.6, 4]} />
        <meshBasicMaterial color="#6f4a22" />
      </mesh>
      <mesh rotation={[1.2, -0.7, 1.1]} castShadow={false}>
        <cylinderGeometry args={[0.04, 0.04, 2.35, 4]} />
        <meshBasicMaterial color="#7f5629" />
      </mesh>
      <mesh rotation={[-0.5, 1.1, 0.9]} castShadow={false}>
        <cylinderGeometry args={[0.035, 0.035, 2.2, 4]} />
        <meshBasicMaterial color="#8a5d2c" />
      </mesh>
    </group>
  );
}

function SurvivalBirdFlock({ chunk }: { chunk: SurvivalChunkInfo }) {
  const flockRef = useRef<THREE.Group>(null);
  const seed = survivalHash01(chunk.cx, chunk.cz, 410);
  const birdSpecies = useMemo(() => {
    if (chunk.biome === "desert") {
      return [
        { name: "vulture", body: "#1d1712", wing: "#241c15", accent: "#8b6f4f", wingLength: 3.4, bodyLength: 2.3, baseScale: 1.35 },
        { name: "hawk", body: "#5a3b1f", wing: "#7a532b", accent: "#d7b56d", wingLength: 2.7, bodyLength: 1.8, baseScale: 1.05 },
      ];
    }
    if (chunk.biome === "jungle") {
      return [
        { name: "parrot", body: "#0f8f52", wing: "#22c55e", accent: "#ef4444", wingLength: 2.2, bodyLength: 1.55, baseScale: 0.95 },
        { name: "toucan", body: "#111827", wing: "#14532d", accent: "#facc15", wingLength: 2.5, bodyLength: 1.75, baseScale: 1.05 },
        { name: "macaw", body: "#2563eb", wing: "#dc2626", accent: "#fde047", wingLength: 2.4, bodyLength: 1.7, baseScale: 0.98 },
      ];
    }
    if (chunk.biome === "swamp") {
      return [
        { name: "heron", body: "#cbd5e1", wing: "#64748b", accent: "#111827", wingLength: 3.05, bodyLength: 2, baseScale: 1.15 },
        { name: "crow", body: "#111827", wing: "#1f2937", accent: "#334155", wingLength: 2.35, bodyLength: 1.65, baseScale: 0.95 },
      ];
    }
    if (chunk.biome === "mushroom") {
      return [
        { name: "moth", body: "#f0abfc", wing: "#c084fc", accent: "#fef3c7", wingLength: 3.15, bodyLength: 1.35, baseScale: 0.88 },
        { name: "owl", body: "#6b4f3a", wing: "#8b6f47", accent: "#facc15", wingLength: 2.25, bodyLength: 1.7, baseScale: 1 },
      ];
    }
    return [
      { name: "swallow", body: "#1f2937", wing: "#334155", accent: "#f8fafc", wingLength: 2.2, bodyLength: 1.45, baseScale: 0.88 },
      { name: "bluebird", body: "#2563eb", wing: "#1d4ed8", accent: "#f97316", wingLength: 2.05, bodyLength: 1.4, baseScale: 0.82 },
    ];
  }, [chunk.biome]);
  const birdCount = chunk.biome === "jungle"
    ? 14
    : chunk.biome === "desert"
      ? 12
      : chunk.biome === "mushroom"
        ? 12
        : chunk.biome === "swamp"
          ? 11
          : 12;
  const flockBaseY = chunk.biome === "jungle"
    ? 310
    : chunk.biome === "swamp"
      ? 230
      : chunk.biome === "desert"
        ? 150
        : 190;
  const birds = useMemo(() => (
    Array.from({ length: birdCount }, (_, index) => {
      const angle = (Math.PI * 2 * index) / birdCount + seed * Math.PI;
      const radius = 110 + survivalHash01(chunk.cx, chunk.cz, 430 + index) * 150;
      const species = birdSpecies[Math.floor(survivalHash01(chunk.cx, chunk.cz, 412 + index) * birdSpecies.length) % birdSpecies.length];
      return {
        key: `${chunk.key}-bird-${index}`,
        species,
        x: Math.cos(angle) * radius,
        z: Math.sin(angle) * radius,
        y: 18 + survivalHash01(chunk.cx, chunk.cz, 450 + index) * (chunk.biome === "jungle" ? 130 : 92),
        scale: species.baseScale + survivalHash01(chunk.cx, chunk.cz, 470 + index) * 0.55,
        tilt: survivalHash01(chunk.cx, chunk.cz, 490 + index) - 0.5,
        wingPhase: survivalHash01(chunk.cx, chunk.cz, 492 + index) * Math.PI * 2,
      };
    })
  ), [birdCount, birdSpecies, chunk, seed]);

  useFrame((state) => {
    if (!flockRef.current) return;
    const elapsed = state.clock.elapsedTime;
    flockRef.current.rotation.y = seed * Math.PI * 2 + elapsed * (chunk.biome === "desert" ? 0.08 : 0.12);
    flockRef.current.position.y = flockBaseY + Math.sin(elapsed * 0.45 + seed * 3) * 8;
  });

  return (
    <group ref={flockRef} position={[chunk.x, flockBaseY, chunk.z]}>
      {birds.map((bird) => (
        <group key={bird.key} position={[bird.x, bird.y, bird.z]} scale={[bird.scale, bird.scale, bird.scale]} rotation={[0, bird.tilt, 0]}>
          <mesh rotation={[0, 0, Math.PI / 2]} castShadow={false}>
            <coneGeometry args={[0.45, bird.species.bodyLength, 5]} />
            <meshBasicMaterial color={bird.species.body} />
          </mesh>
          <mesh position={[-bird.species.wingLength * 0.45, 0, 0]} rotation={[0, 0.1, 0.22 + Math.sin(bird.wingPhase) * 0.08]} castShadow={false}>
            <planeGeometry args={[bird.species.wingLength, bird.species.name === "moth" ? 0.9 : 0.48]} />
            <meshBasicMaterial color={bird.species.wing} side={THREE.DoubleSide} transparent={bird.species.name === "moth"} opacity={bird.species.name === "moth" ? 0.72 : 1} />
          </mesh>
          <mesh position={[bird.species.wingLength * 0.45, 0, 0]} rotation={[0, -0.1, -0.22 - Math.sin(bird.wingPhase) * 0.08]} castShadow={false}>
            <planeGeometry args={[bird.species.wingLength, bird.species.name === "moth" ? 0.9 : 0.48]} />
            <meshBasicMaterial color={bird.species.wing} side={THREE.DoubleSide} transparent={bird.species.name === "moth"} opacity={bird.species.name === "moth" ? 0.72 : 1} />
          </mesh>
          <mesh position={[0, -0.02, -0.92]} rotation={[Math.PI / 2, 0, 0]} castShadow={false}>
            <coneGeometry args={[bird.species.name === "toucan" ? 0.28 : 0.16, bird.species.name === "toucan" ? 1.05 : 0.62, 4]} />
            <meshBasicMaterial color={bird.species.accent} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

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
): FootprintHeightStats {
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  let count = 0;
  const samples = [-1, -0.5, 0, 0.5, 1];

  samples.forEach((sampleX) => {
    samples.forEach((sampleZ) => {
      const offsetX = sampleX * halfSize;
      const offsetZ = sampleZ * halfSize;
      const rotatedX = offsetX * cos - offsetZ * sin;
      const rotatedZ = offsetX * sin + offsetZ * cos;
      const height = getSurvivalTerrainHeightForChunk(chunk, localX + rotatedX, localZ + rotatedZ);
      min = Math.min(min, height);
      max = Math.max(max, height);
      sum += height;
      count += 1;
    });
  });

  if (count === 0 || !Number.isFinite(min) || !Number.isFinite(max)) {
    const fallback = getSurvivalTerrainHeightForChunk(chunk, localX, localZ);
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
  metrics = getDesertPyramidMetrics(landmark),
) {
  return getRotatedSurvivalFootprintHeightStats(
    chunk,
    landmark.localX,
    landmark.localZ,
    metrics.baseSize * 0.58,
    metrics.pyramidYaw,
  );
}

function makePyramidVillagerHuts(landmark: DesertLandmark, chunk: SurvivalChunkInfo): HutInfo[] {
  const metrics = getDesertPyramidMetrics(landmark);
  const x = chunk.x + landmark.localX;
  const z = chunk.z + landmark.localZ;
  const rotation = metrics.pyramidYaw + Math.PI;
  const sideOffsets = metrics.baseSize > 43 ? [-metrics.baseSize * 0.16, 0, metrics.baseSize * 0.16] : [-metrics.baseSize * 0.14, metrics.baseSize * 0.14];

  return sideOffsets.map((sideOffset, index) => ({
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
  }));
}

function DesertPyramidFoundation({
  landmark,
  chunk,
  metrics,
  adobeTexture,
}: {
  landmark: DesertLandmark;
  chunk: SurvivalChunkInfo;
  metrics: ReturnType<typeof getDesertPyramidMetrics>;
  adobeTexture: THREE.Texture;
}) {
  const stats = useMemo(
    () => getDesertPyramidFootprintStats(landmark, chunk, metrics),
    [chunk, landmark, metrics],
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
      {[-1, 1].map((side) => (
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
      {[-1, 0, 1].map((glyph) => (
        <mesh key={glyph} position={[glyph * metrics.baseSize * 0.09, landmark.y + 3.25 * landmark.scale, metrics.baseSize * 0.3]} rotation={[0, Math.PI, 0]} castShadow={false}>
          <boxGeometry args={[0.28 * landmark.scale, 2.0 * landmark.scale, 0.08 * landmark.scale]} />
          <meshBasicMaterial color={glyph === 0 ? gold : "#0ea5e9"} />
        </mesh>
      ))}
    </group>
  );
}

function DesertPyramidColliders({ landmark, chunk }: { landmark: DesertLandmark; chunk: SurvivalChunkInfo }) {
  const metrics = getDesertPyramidMetrics(landmark);
  const foundationStats = getDesertPyramidFootprintStats(landmark, chunk, metrics);
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

function DesertPyramidLandmark({ landmark, chunk }: { landmark: DesertLandmark; chunk: SurvivalChunkInfo }) {
  const adobeTexture = useMemo(() => getDesertAdobeWallTexture(), []);
  const metrics = getDesertPyramidMetrics(landmark);
  const steps = Array.from({ length: metrics.stepCount }, (_, index) => {
    const t = index / metrics.stepCount;
    return {
      key: `${landmark.key}-step-${index}`,
      index,
      size: metrics.baseSize * (1 - t * 0.72),
      y: landmark.y + metrics.stepHeight * index + metrics.stepHeight * 0.5,
    };
  });

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
      {chunk.distance === 0 && <DesertPyramidColliders landmark={landmark} chunk={chunk} />}
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
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 8.5 * landmark.scale, 3.8 * landmark.scale, 2.5 * landmark.scale]} castShadow={false}>
          <boxGeometry args={[2.2 * landmark.scale, 7.6 * landmark.scale, 2.2 * landmark.scale]} />
          <meshLambertMaterial map={adobeTexture} color="#bd8c4d" />
        </mesh>
      ))}
    </group>
  );
}

function DesertLandmarks({ chunk }: { chunk: SurvivalChunkInfo }) {
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
      const y = getSurvivalTerrainHeightForChunk(chunk, localX, localZ);
      const waterY = getSurvivalWaterLevelAtWorld(worldX, worldZ);
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
        const footprintStats = getDesertPyramidFootprintStats(provisional, chunk, metrics);
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
  }, [chunk]);
  const pyramidHuts = useMemo(
    () => landmarks
      .filter((landmark) => landmark.type === "pyramid")
      .flatMap((landmark) => makePyramidVillagerHuts(landmark, chunk)),
    [chunk, landmarks],
  );

  if (landmarks.length === 0) return null;

  return (
    <>
      {landmarks.map((landmark) => (
        landmark.type === "pyramid"
          ? <DesertPyramidLandmark key={landmark.key} landmark={landmark} chunk={chunk} />
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

type SurvivalRockOutcrop = {
  key: string;
  localX: number;
  localZ: number;
  y: number;
  scale: number;
  yaw: number;
  color: string;
  spire: boolean;
};

function SurvivalRockOutcrops({ chunk }: { chunk: SurvivalChunkInfo }) {
  const rocks = useMemo<SurvivalRockOutcrop[]>(() => {
    if (chunk.lod === "far") return [];

    const targetCount = chunk.lod === "near"
      ? chunk.biome === "desert" ? 4 : chunk.biome === "jungle" ? 5 : 4
      : 1;
    const palette = chunk.biome === "desert"
      ? ["#b98748", "#d0a35f", "#8f6f48"]
      : chunk.biome === "swamp"
        ? ["#48513a", "#5c6549", "#343829"]
        : ["#777a62", "#8a866e", "#5e6652"];
    const generated: SurvivalRockOutcrop[] = [];
    const attempts = targetCount * 4;

    for (let index = 0; index < attempts && generated.length < targetCount; index += 1) {
      const localX = (survivalHash01(chunk.cx, chunk.cz, 910 + index) - 0.5) * SURVIVAL_BLOCK_SIZE * 0.86;
      const localZ = (survivalHash01(chunk.cx, chunk.cz, 960 + index) - 0.5) * SURVIVAL_BLOCK_SIZE * 0.86;
      if (chunk.hasVillage && Math.max(Math.abs(localX), Math.abs(localZ)) < BASE_VILLAGE_HALF_SIZE + 26) continue;

      const worldX = chunk.x + localX;
      const worldZ = chunk.z + localZ;
      const y = getSurvivalTerrainHeightForChunk(chunk, localX, localZ);
      const waterY = getSurvivalWaterLevelAtWorld(worldX, worldZ);
      if (y < waterY + 0.24) continue;

      const variant = survivalHash01(chunk.cx, chunk.cz, 990 + index);
      generated.push({
        key: `${chunk.key}-rock-${index}`,
        localX,
        localZ,
        y,
        scale: 1.8 + variant * (chunk.biome === "desert" ? 5.2 : 3.6),
        yaw: survivalHash01(chunk.cx, chunk.cz, 1020 + index) * Math.PI * 2,
        color: palette[Math.floor(variant * palette.length) % palette.length],
        spire: variant > 0.76,
      });
    }

    return generated;
  }, [chunk]);

  if (rocks.length === 0) return null;

  return (
    <>
      {rocks.map((rock) => (
        <group
          key={rock.key}
          position={[chunk.x + rock.localX, rock.y + rock.scale * 0.42, chunk.z + rock.localZ]}
          rotation={[0, rock.yaw, 0]}
          scale={[rock.scale * 1.35, rock.scale * (rock.spire ? 1.95 : 0.75), rock.scale]}
        >
          <mesh castShadow={false}>
            {rock.spire ? (
              <coneGeometry args={[1, 2.1, 5]} />
            ) : (
              <dodecahedronGeometry args={[1, 0]} />
            )}
            <meshBasicMaterial color={rock.color} />
          </mesh>
        </group>
      ))}
    </>
  );
}

function SurvivalScatterProps({ chunk }: { chunk: SurvivalChunkInfo }) {
  const props = useMemo(() => {
    if (chunk.lod === "far") return [];
    const densityMultiplier = chunk.lod === "mid" ? 0.3 : 1;
    const baseCount = chunk.biome === "desert"
      ? 9
      : chunk.biome === "jungle"
        ? 5
        : chunk.biome === "swamp"
          ? 4
          : chunk.biome === "mushroom"
            ? 3
            : 4;
    const count = Math.max(chunk.lod === "mid" ? 1 : 3, Math.round(baseCount * densityMultiplier));
    const generated: SurvivalScatterProp[] = [];
    const attempts = count * 8;

    for (let index = 0; index < attempts && generated.length < count; index += 1) {
      const localX = (survivalHash01(chunk.cx, chunk.cz, 20 + index) - 0.5) * (SURVIVAL_BLOCK_SIZE * 0.78);
      const localZ = (survivalHash01(chunk.cx, chunk.cz, 60 + index) - 0.5) * (SURVIVAL_BLOCK_SIZE * 0.78);
      if (chunk.hasVillage && Math.max(Math.abs(localX), Math.abs(localZ)) < BASE_VILLAGE_HALF_SIZE + 28) continue;
      if (chunk.biome !== "desert" && Math.min(Math.abs(localX), Math.abs(localZ)) < 34) continue;

      const worldX = chunk.x + localX;
      const worldZ = chunk.z + localZ;
      const y = getSurvivalTerrainHeightForChunk(chunk, localX, localZ);
      const waterY = getSurvivalWaterLevelAtWorld(worldX, worldZ);
      if (y < waterY + 0.18) continue;

      const scale = 1.35 + survivalHash01(chunk.cx, chunk.cz, 90 + index) * (
        chunk.biome === "jungle" ? 2.95 : chunk.biome === "swamp" ? 2.45 : 2.1
      );
      const variant = survivalHash01(chunk.cx, chunk.cz, 120 + index);
      if (chunk.biome !== "desert") {
        const minSpacing = chunk.biome === "jungle"
          ? 118
          : chunk.biome === "swamp"
            ? 96
            : chunk.biome === "mushroom"
              ? 82
              : 88;
        if (generated.some(prop => Math.hypot(prop.localX - localX, prop.localZ - localZ) < minSpacing)) continue;
      }
      generated.push({ localX, localZ, scale, y, variant, key: `${chunk.key}-prop-${index}` });
    }

    return generated;
  }, [chunk]) satisfies SurvivalScatterProp[];

  return (
    <>
      <SurvivalFastGroves chunk={chunk} />
      <SurvivalRoofForests chunk={chunk} />
      <SurvivalHobbitHuts chunk={chunk} />
      <SurvivalGrassPatches chunk={chunk} />
      <SurvivalFernClusters chunk={chunk} />
      <SurvivalBushClusters chunk={chunk} />
      <SurvivalRockOutcrops chunk={chunk} />
      <DesertLandmarks chunk={chunk} />
      {chunk.lod === "near" && <SurvivalBirdFlock chunk={chunk} />}
      {props.map((prop) => {
        if (chunk.biome === "desert") {
          if (prop.variant > 0.56) {
            return (
              <DesertTumbleweed
                key={prop.key}
                x={chunk.x + prop.localX}
                y={prop.y}
                z={chunk.z + prop.localZ}
                scale={prop.scale}
                seed={prop.variant}
              />
            );
          }

          return (
            <DesertCactus
              key={prop.key}
              x={chunk.x + prop.localX}
              y={prop.y}
              z={chunk.z + prop.localZ}
              scale={prop.scale}
              variant={prop.variant}
            />
          );
        }

        return (
          <SurvivalBiomeTree
            key={prop.key}
            biome={chunk.biome}
            prop={prop}
            worldX={chunk.x + prop.localX}
            worldZ={chunk.z + prop.localZ}
          />
        );
      })}
    </>
  );
}

type SurvivalWaterfallFeature = {
  key: string;
  x: number;
  z: number;
  y: number;
  height: number;
  width: number;
  yaw: number;
  poolX: number;
  poolZ: number;
  poolY: number;
  poolScale: number;
};

function SurvivalWaterfalls({ chunk }: { chunk: SurvivalChunkInfo }) {
  const waterfalls = useMemo<SurvivalWaterfallFeature[]>(() => {
    if (chunk.lod === "far" || chunk.biome === "desert" || chunk.biome === "swamp") return [];

      const desired = chunk.lod === "near" && (chunk.biome === "jungle" || survivalHash01(chunk.cx, chunk.cz, 188) > 0.72) ? 1 : 0;
    const generated: SurvivalWaterfallFeature[] = [];
    const attempts = desired * 8;

    for (let index = 0; index < attempts && generated.length < desired; index += 1) {
      const localX = (survivalHash01(chunk.cx, chunk.cz, 1200 + index) - 0.5) * SURVIVAL_BLOCK_SIZE * 0.72;
      const localZ = (survivalHash01(chunk.cx, chunk.cz, 1240 + index) - 0.5) * SURVIVAL_BLOCK_SIZE * 0.72;
      if (chunk.hasVillage && Math.max(Math.abs(localX), Math.abs(localZ)) < BASE_VILLAGE_HALF_SIZE + 40) continue;

      const angle = survivalHash01(chunk.cx, chunk.cz, 1280 + index) * Math.PI * 2;
      const dropX = Math.cos(angle) * 42;
      const dropZ = Math.sin(angle) * 42;
      const topY = getSurvivalTerrainHeightForChunk(chunk, localX, localZ) + 3.5;
      const bottomTerrainY = getSurvivalTerrainHeightForChunk(chunk, localX + dropX, localZ + dropZ);
      const worldX = chunk.x + localX;
      const worldZ = chunk.z + localZ;
      const waterY = getSurvivalWaterLevelAtWorld(worldX, worldZ);
      const bottomY = Math.max(waterY + 0.45, bottomTerrainY + 0.8);
      const drop = topY - bottomY;
      if (drop < 8 || drop > 34 || topY < waterY + 9) continue;

      generated.push({
        key: `${chunk.key}-waterfall-${index}`,
        x: worldX + dropX * 0.34,
        z: worldZ + dropZ * 0.34,
        y: bottomY + drop * 0.5,
        height: Math.min(26, drop),
        width: 3.2 + survivalHash01(chunk.cx, chunk.cz, 1320 + index) * 4.8,
        yaw: angle,
        poolX: worldX + dropX * 0.72,
        poolZ: worldZ + dropZ * 0.72,
        poolY: bottomY + 0.08,
        poolScale: 9 + survivalHash01(chunk.cx, chunk.cz, 1360 + index) * 8,
      });
    }

    return generated;
  }, [chunk]);

  if (waterfalls.length === 0) return null;

  return (
    <>
      {waterfalls.map((fall) => (
        <group key={fall.key}>
          <mesh position={[fall.x, fall.y, fall.z]} rotation={[0, fall.yaw, 0]} renderOrder={-1}>
            <planeGeometry args={[fall.width, fall.height]} />
            <meshBasicMaterial color="#8de8ff" transparent opacity={0.42} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
          <mesh position={[fall.x, fall.y + fall.height * 0.08, fall.z]} rotation={[0, fall.yaw, 0]} renderOrder={0}>
            <planeGeometry args={[fall.width * 0.34, fall.height * 0.96]} />
            <meshBasicMaterial color="#e8fdff" transparent opacity={0.22} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[fall.poolX, fall.poolY, fall.poolZ]} scale={[fall.poolScale * 1.35, fall.poolScale, 1]} renderOrder={-2}>
            <circleGeometry args={[1, 18]} />
            <meshBasicMaterial color="#5fc0d5" transparent opacity={0.62} depthWrite={false} />
          </mesh>
        </group>
      ))}
    </>
  );
}

function SurvivalWaterFeatures({ chunk }: { chunk: SurvivalChunkInfo }) {
  const style = survivalBiomeStyle[chunk.biome];
  const riverWidth = getSurvivalRiverWidth(chunk);
  const riverOffset = getSurvivalRiverOffset(chunk);
  const riverSize: [number, number] = chunk.riverVertical
    ? [riverWidth, SURVIVAL_BLOCK_SIZE * 1.08]
    : [SURVIVAL_BLOCK_SIZE * 1.08, riverWidth];
  const riverWorldX = chunk.riverVertical ? chunk.x + riverOffset : chunk.x;
  const riverWorldZ = chunk.riverVertical ? chunk.z : chunk.z + riverOffset;
  const riverY = getSurvivalWaterLevelAtWorld(riverWorldX, riverWorldZ) + 0.1;
  const riverPosition: [number, number, number] = chunk.riverVertical
    ? [chunk.x + riverOffset, riverY, chunk.z]
    : [chunk.x, riverY, chunk.z + riverOffset];

  const ponds = useMemo(() => {
    if (chunk.lod === "far") return [];
    const count = chunk.biome === "swamp" ? 3 : chunk.biome === "plains" || chunk.biome === "jungle" ? 1 : 1;
    return Array.from({ length: count }, (_, index) => {
      const localX = (survivalHash01(chunk.cx, chunk.cz, 160 + index) - 0.5) * SURVIVAL_BLOCK_SIZE * 0.62;
      const localZ = (survivalHash01(chunk.cx, chunk.cz, 180 + index) - 0.5) * SURVIVAL_BLOCK_SIZE * 0.62;
      const radiusX = 20 + survivalHash01(chunk.cx, chunk.cz, 210 + index) * (chunk.biome === "swamp" ? 42 : 24);
      const radiusZ = 16 + survivalHash01(chunk.cx, chunk.cz, 240 + index) * (chunk.biome === "swamp" ? 36 : 18);
      const y = getSurvivalWaterLevelAtWorld(chunk.x + localX, chunk.z + localZ) + 0.12;
      return { key: `${chunk.key}-pond-${index}`, localX, localZ, radiusX, radiusZ, y };
    });
  }, [chunk]);

  const lilyPads = useMemo(() => {
    if (chunk.biome !== "swamp" || chunk.lod === "far") return [];
    return Array.from({ length: chunk.lod === "near" ? 12 : 4 }, (_, index) => {
      const localX = (survivalHash01(chunk.cx, chunk.cz, 300 + index) - 0.5) * SURVIVAL_BLOCK_SIZE * 0.86;
      const localZ = (survivalHash01(chunk.cx, chunk.cz, 330 + index) - 0.5) * SURVIVAL_BLOCK_SIZE * 0.86;
      const scale = 2.4 + survivalHash01(chunk.cx, chunk.cz, 360 + index) * 3.2;
      return { key: `${chunk.key}-lily-${index}`, localX, localZ, scale };
    });
  }, [chunk]);

  return (
    <group name={`survival-water-${chunk.key}`}>
      {chunk.hasRiver && (
        <group>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[riverPosition[0], riverPosition[1] - 0.04, riverPosition[2]]} renderOrder={-2}>
            <planeGeometry args={chunk.riverVertical ? [riverWidth + 18, SURVIVAL_BLOCK_SIZE * 1.09] : [SURVIVAL_BLOCK_SIZE * 1.09, riverWidth + 18]} />
            <meshBasicMaterial color={chunk.biome === "desert" ? "#caa566" : "#486d42"} transparent opacity={0.48} depthWrite={false} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={riverPosition} renderOrder={-1}>
            <planeGeometry args={riverSize} />
            <meshBasicMaterial color={style.water} transparent opacity={chunk.biome === "swamp" ? 0.82 : 0.66} depthWrite={false} />
          </mesh>
        </group>
      )}

      {ponds.map((pond) => (
        <group key={pond.key}>
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[chunk.x + pond.localX, pond.y - 0.04, chunk.z + pond.localZ]}
            scale={[pond.radiusX + 7, pond.radiusZ + 7, 1]}
            renderOrder={-2}
          >
            <circleGeometry args={[1, 16]} />
            <meshBasicMaterial color={chunk.biome === "desert" ? "#d4b676" : "#4a6d3a"} transparent opacity={0.42} depthWrite={false} />
          </mesh>
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[chunk.x + pond.localX, pond.y, chunk.z + pond.localZ]}
            scale={[pond.radiusX, pond.radiusZ, 1]}
            renderOrder={-1}
          >
            <circleGeometry args={[1, 16]} />
            <meshBasicMaterial color={style.water} transparent opacity={chunk.biome === "swamp" ? 0.78 : 0.56} depthWrite={false} />
          </mesh>
        </group>
      ))}

      {lilyPads.map((pad) => (
        <mesh
          key={pad.key}
          rotation={[-Math.PI / 2, 0, survivalHash01(chunk.cx, chunk.cz, pad.scale) * Math.PI]}
          position={[chunk.x + pad.localX, getSurvivalWaterLevelAtWorld(chunk.x + pad.localX, chunk.z + pad.localZ) + 0.24, chunk.z + pad.localZ]}
          scale={[pad.scale * 1.35, pad.scale, 1]}
          renderOrder={1}
        >
          <circleGeometry args={[1, 10]} />
          <meshBasicMaterial color="#69a33a" />
        </mesh>
      ))}
    </group>
  );
}

function getSurvivalVillageBaseHeight(chunk: SurvivalChunkInfo) {
  return getSurvivalTerrainHeightForChunk(chunk, 0, 0);
}

function getSurvivalVillagePadHeight(chunk: SurvivalChunkInfo, localX: number, localZ: number, baseHeight = getSurvivalVillageBaseHeight(chunk)) {
  const naturalHeight = getSurvivalTerrainHeightForChunk(chunk, localX, localZ);
  const maxAbs = Math.max(Math.abs(localX), Math.abs(localZ));
  const edgeBlend = smoothstepRange(DESERT_VILLAGE_PAD_FLAT_RADIUS, SURVIVAL_BLOCK_SIZE / 2, maxAbs);
  return lerpNumber(baseHeight, naturalHeight, edgeBlend);
}

function makeSurvivalVillagePadGeometry(chunk: SurvivalChunkInfo) {
  const segments = SURVIVAL_VILLAGE_PAD_SEGMENTS;
  const baseHeight = getSurvivalVillageBaseHeight(chunk);
  const geo = new THREE.PlaneGeometry(SURVIVAL_BLOCK_SIZE, SURVIVAL_BLOCK_SIZE, segments, segments);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors: number[] = [];

  for (let i = 0; i < pos.count; i += 1) {
    const localX = pos.getX(i);
    const localZ = pos.getZ(i);
    const height = getSurvivalVillagePadHeight(chunk, localX, localZ, baseHeight);
    const color = getSurvivalTerrainColor(chunk.x + localX, chunk.z + localZ, height);
    pos.setY(i, height);
    colors.push(color.r, color.g, color.b);
  }

  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}

function makeDesertVillageSurfaceStripGeometry(
  chunk: SurvivalChunkInfo,
  width: number,
  length: number,
  rotation: number,
  yOffset: number,
  lateralOffset = 0,
  lengthOffset = 0,
  lateralSegments = 2,
  lengthSegments = SURVIVAL_VILLAGE_PAD_SEGMENTS,
) {
  const baseHeight = getSurvivalVillageBaseHeight(chunk);
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
    const height = getSurvivalVillagePadHeight(chunk, localX, localZ, baseHeight);
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

const DESERT_VILLAGE_RADIUS = 232;
const DESERT_VILLAGE_PAD_FLAT_RADIUS = 244;
const DESERT_WALL_SEGMENT_COUNT = 72;
const DESERT_WALL_SEGMENT_WIDTH = (Math.PI * 2 * DESERT_VILLAGE_RADIUS / DESERT_WALL_SEGMENT_COUNT) * 1.16;
const DESERT_GATE_HALF_WIDTH = 50;
const DESERT_BUILDING_COLORS = ["#d8b06f", "#c99a55", "#e0bd82", "#bf8542", "#d1a062"];
const DESERT_ROOF_COLORS = ["#a96835", "#8f552e", "#bd7a3d", "#7a462a"];
const DESERT_MARKET_COLORS = ["#2f9bb2", "#d95f3d", "#d6b145", "#7f5bb8", "#52a35a"];
const DESERT_CLOTH_COLORS = ["#e9d7a0", "#c94f3f", "#3f9fb5", "#dfb548", "#8d6bbb", "#f2eee3"];
const DESERT_BUILDING_WALL_THICKNESS = 1.05;
const DESERT_BUILDING_DOOR_WIDTH = 5.4;
const DESERT_BUILDING_DOOR_HEIGHT = 7.25;

function isNearDesertGate(localX: number, localZ: number) {
  const nearNorthSouth = Math.abs(localX) < 32 && Math.abs(Math.abs(localZ) - DESERT_VILLAGE_RADIUS) < 34;
  const nearEastWest = Math.abs(localZ) < 32 && Math.abs(Math.abs(localX) - DESERT_VILLAGE_RADIUS) < 34;
  return nearNorthSouth || nearEastWest;
}

function makeDesertVillageWallSegments(): DesertVillageWallSegment[] {
  return Array.from({ length: DESERT_WALL_SEGMENT_COUNT }, (_, index) => {
    const angle = (Math.PI * 2 * index) / DESERT_WALL_SEGMENT_COUNT;
    const sin = Math.sin(angle);
    const cos = Math.cos(angle);
    const northSouthGate = Math.abs(sin * DESERT_VILLAGE_RADIUS) < DESERT_GATE_HALF_WIDTH && Math.abs(cos) > 0.78;
    const eastWestGate = Math.abs(cos * DESERT_VILLAGE_RADIUS) < DESERT_GATE_HALF_WIDTH && Math.abs(sin) > 0.78;
    const isGate = northSouthGate || eastWestGate;
    if (isGate) return null;

    return {
      key: `desert-wall-${index}`,
      localX: sin * DESERT_VILLAGE_RADIUS,
      localZ: cos * DESERT_VILLAGE_RADIUS,
      rotation: angle,
      width: DESERT_WALL_SEGMENT_WIDTH,
      height: 15.5,
      depth: 8,
    };
  }).filter(Boolean) as DesertVillageWallSegment[];
}

function getBuildingLocalPoint(building: DesertVillageBuilding, offsetX: number, offsetZ: number) {
  const sin = Math.sin(building.rotation);
  const cos = Math.cos(building.rotation);
  return {
    localX: building.localX + cos * offsetX + sin * offsetZ,
    localZ: building.localZ - sin * offsetX + cos * offsetZ,
  };
}

function makeDesertVillageLayout(chunk: SurvivalChunkInfo, baseHeight: number): DesertVillageLayout {
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
  rings.forEach((ring, ringIndex) => {
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
  });

  const usedClothesLineBuildings = new Set<string>();
  buildings.forEach((building, index) => {
    if (clothesLines.length >= 20 || usedClothesLineBuildings.has(building.key) || index % 3 !== 0) return;

    let nearest: DesertVillageBuilding | null = null;
    let nearestDistance = Infinity;
    buildings.forEach((candidate) => {
      if (candidate.key === building.key || usedClothesLineBuildings.has(candidate.key)) return;
      const distance = Math.hypot(candidate.localX - building.localX, candidate.localZ - building.localZ);
      if (distance < 24 || distance > 62 || distance >= nearestDistance) return;
      nearest = candidate;
      nearestDistance = distance;
    });

    if (!nearest) return;

    const target = nearest;
    const dx = target.localX - building.localX;
    const dz = target.localZ - building.localZ;
    const distance = Math.max(1, Math.hypot(dx, dz));
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
  });

  const marketStalls = Array.from({ length: chunk.lod === "mid" ? 5 : 10 }, (_, index) => {
    const angle = (Math.PI * 2 * index) / (chunk.lod === "mid" ? 5 : 10) + 0.22;
    const radius = 50 + survivalHash01(chunk.cx, chunk.cz, 700 + index) * 18;
    return {
      key: `${chunk.key}-market-${index}`,
      localX: Math.sin(angle) * radius,
      localZ: Math.cos(angle) * radius,
      rotation: angle + Math.PI / 2,
      color: DESERT_MARKET_COLORS[index % DESERT_MARKET_COLORS.length],
    };
  });

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

  const palms = Array.from({ length: chunk.lod === "mid" ? 10 : 22 }, (_, index) => {
    const cluster = index < 12;
    const angle = cluster
      ? -Math.PI * 0.72 + (index / 12) * Math.PI * 0.56
      : Math.PI * 0.15 + (index / 10) * Math.PI * 0.32;
    const radius = cluster
      ? 248 + survivalHash01(chunk.cx, chunk.cz, 750 + index) * 34
      : 178 + survivalHash01(chunk.cx, chunk.cz, 760 + index) * 42;
    const localX = Math.sin(angle) * radius;
    const localZ = Math.cos(angle) * radius;
    return {
      key: `${chunk.key}-date-palm-${index}`,
      localX,
      localY: getSurvivalTerrainHeightForChunk(chunk, localX, localZ),
      localZ,
      scale: 0.85 + survivalHash01(chunk.cx, chunk.cz, 770 + index) * 0.7,
      rotation: survivalHash01(chunk.cx, chunk.cz, 780 + index) * Math.PI * 2,
    };
  });

  return { buildings, huts, wallSegments, marketStalls, palms, ladders, fences, clothesLines, streetProps };
}

function DesertVillageSurface({
  geometry,
  baseHeight,
  chunk,
}: {
  geometry: THREE.BufferGeometry;
  baseHeight: number;
  chunk: SurvivalChunkInfo;
}) {
  const sandTexture = useMemo(() => getDesertSandTexture(), []);
  const northSouthRoadGeometry = useMemo(
    () => makeDesertVillageSurfaceStripGeometry(chunk, 48, SURVIVAL_BLOCK_SIZE - 4, 0, 0.18),
    [chunk],
  );
  const eastWestRoadGeometry = useMemo(
    () => makeDesertVillageSurfaceStripGeometry(chunk, 48, SURVIVAL_BLOCK_SIZE - 4, Math.PI / 2, 0.18),
    [chunk],
  );
  const diagonalRoadAGeometry = useMemo(
    () => makeDesertVillageSurfaceStripGeometry(chunk, 26, 360, Math.PI / 4, 0.17),
    [chunk],
  );
  const diagonalRoadBGeometry = useMemo(
    () => makeDesertVillageSurfaceStripGeometry(chunk, 26, 360, -Math.PI / 4, 0.17),
    [chunk],
  );
  const sidewalkGeometries = useMemo(() => [
    { key: "north-south-left", geometry: makeDesertVillageSurfaceStripGeometry(chunk, 7, SURVIVAL_BLOCK_SIZE - 4, 0, 0.22, -30), opacity: 0.76 },
    { key: "north-south-right", geometry: makeDesertVillageSurfaceStripGeometry(chunk, 7, SURVIVAL_BLOCK_SIZE - 4, 0, 0.22, 30), opacity: 0.76 },
    { key: "east-west-left", geometry: makeDesertVillageSurfaceStripGeometry(chunk, 7, SURVIVAL_BLOCK_SIZE - 4, Math.PI / 2, 0.22, -30), opacity: 0.76 },
    { key: "east-west-right", geometry: makeDesertVillageSurfaceStripGeometry(chunk, 7, SURVIVAL_BLOCK_SIZE - 4, Math.PI / 2, 0.22, 30), opacity: 0.76 },
    { key: "diagonal-a-left", geometry: makeDesertVillageSurfaceStripGeometry(chunk, 5, 360, Math.PI / 4, 0.2, -18), opacity: 0.62 },
    { key: "diagonal-a-right", geometry: makeDesertVillageSurfaceStripGeometry(chunk, 5, 360, Math.PI / 4, 0.2, 18), opacity: 0.62 },
    { key: "diagonal-b-left", geometry: makeDesertVillageSurfaceStripGeometry(chunk, 5, 360, -Math.PI / 4, 0.2, -18), opacity: 0.62 },
    { key: "diagonal-b-right", geometry: makeDesertVillageSurfaceStripGeometry(chunk, 5, 360, -Math.PI / 4, 0.2, 18), opacity: 0.62 },
  ], [chunk]);

  return (
    <group>
      <mesh geometry={geometry} receiveShadow dispose={null}>
        <meshBasicMaterial map={sandTexture} vertexColors />
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
  const unitBoxGeometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const adobeMaterial = useMemo(() => new THREE.MeshBasicMaterial({ map: adobeTexture, color: "#b68145" }), [adobeTexture]);
  const roofMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: "#6f3e22" }), []);
  const outlineShellMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: "#160d08", side: THREE.BackSide }), []);
  const trimMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: "#1c1009" }), []);
  const doorMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: "#3b2414" }), []);
  const windowMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: "#6ac7d6" }), []);
  const floorMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: "#70401f" }), []);

  useEffect(() => {
    const bodyMesh = bodyRef.current;
    const roofMesh = roofRef.current;
    const outlineBodyMesh = outlineBodyRef.current;
    const outlineRoofMesh = outlineRoofRef.current;
    if (!bodyMesh || !roofMesh) return;

    buildings.forEach((building, index) => {
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
    });

    bodyMesh.instanceMatrix.needsUpdate = true;
    roofMesh.instanceMatrix.needsUpdate = true;
    if (outlineBodyMesh) outlineBodyMesh.instanceMatrix.needsUpdate = true;
    if (outlineRoofMesh) outlineRoofMesh.instanceMatrix.needsUpdate = true;
    bodyMesh.computeBoundingBox();
    bodyMesh.computeBoundingSphere();
    roofMesh.computeBoundingBox();
    roofMesh.computeBoundingSphere();
    outlineBodyMesh?.computeBoundingBox();
    outlineBodyMesh?.computeBoundingSphere();
    outlineRoofMesh?.computeBoundingBox();
    outlineRoofMesh?.computeBoundingSphere();
  }, [baseHeight, buildings, dummy]);

  return (
    <>
      {!showDetails && (
        <>
          <instancedMesh ref={outlineBodyRef} args={[undefined, undefined, buildings.length]} castShadow={false} receiveShadow={false} frustumCulled={false}>
            <boxGeometry args={[1, 1, 1]} />
            <primitive object={outlineShellMaterial} attach="material" />
          </instancedMesh>
          <instancedMesh ref={bodyRef} args={[undefined, undefined, buildings.length]} castShadow={false} receiveShadow frustumCulled={false}>
            <boxGeometry args={[1, 1, 1]} />
            <meshBasicMaterial map={adobeTexture} color="#b68145" />
          </instancedMesh>
          <instancedMesh ref={outlineRoofRef} args={[undefined, undefined, buildings.length]} castShadow={false} receiveShadow={false} frustumCulled={false}>
            <boxGeometry args={[1, 1, 1]} />
            <primitive object={outlineShellMaterial} attach="material" />
          </instancedMesh>
          <instancedMesh ref={roofRef} args={[undefined, undefined, buildings.length]} castShadow={false} receiveShadow frustumCulled={false}>
            <boxGeometry args={[1, 1, 1]} />
            <meshBasicMaterial color="#6f3e22" />
          </instancedMesh>
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
          <mesh geometry={unitBoxGeometry} material={outlineShellMaterial} position={[0, building.height / 2, 0]} scale={[building.width + 1.1, building.height + 0.75, building.depth + 1.1]} castShadow={false} />
          <mesh geometry={unitBoxGeometry} material={outlineShellMaterial} position={[0, building.height + 0.75, 0]} scale={[building.width + 4.2, 2.05, building.depth + 4.2]} castShadow={false} />
          {[
            [-building.width / 2 - 0.08, building.depth / 2 + 0.08],
            [building.width / 2 + 0.08, building.depth / 2 + 0.08],
            [-building.width / 2 - 0.08, -building.depth / 2 - 0.08],
            [building.width / 2 + 0.08, -building.depth / 2 - 0.08],
          ].map(([x, z], index) => (
            <mesh key={`${building.key}-corner-outline-${index}`} geometry={unitBoxGeometry} material={trimMaterial} position={[x, building.height / 2, z]} scale={[0.62, building.height + 0.38, 0.62]} castShadow={false} />
          ))}
          <mesh geometry={unitBoxGeometry} material={trimMaterial} position={[0, building.height + 0.14, building.depth / 2 + 0.08]} scale={[building.width + 0.65, 0.36, 0.5]} castShadow={false} />
          <mesh geometry={unitBoxGeometry} material={trimMaterial} position={[0, building.height + 0.14, -building.depth / 2 - 0.08]} scale={[building.width + 0.65, 0.36, 0.5]} castShadow={false} />
          <mesh geometry={unitBoxGeometry} material={trimMaterial} position={[-building.width / 2 - 0.08, building.height + 0.14, 0]} scale={[0.5, 0.36, building.depth + 0.65]} castShadow={false} />
          <mesh geometry={unitBoxGeometry} material={trimMaterial} position={[building.width / 2 + 0.08, building.height + 0.14, 0]} scale={[0.5, 0.36, building.depth + 0.65]} castShadow={false} />
          <mesh geometry={unitBoxGeometry} material={floorMaterial} position={[0, 0.08, 0]} scale={[building.width - wallThickness * 1.4, 0.16, building.depth - wallThickness * 1.4]} castShadow={false} receiveShadow />
          <mesh geometry={unitBoxGeometry} material={adobeMaterial} position={[-building.width / 2 + wallThickness / 2, building.height / 2, 0]} scale={[wallThickness, building.height, building.depth]} castShadow={false} receiveShadow />
          <mesh geometry={unitBoxGeometry} material={adobeMaterial} position={[building.width / 2 - wallThickness / 2, building.height / 2, 0]} scale={[wallThickness, building.height, building.depth]} castShadow={false} receiveShadow />
          <mesh geometry={unitBoxGeometry} material={adobeMaterial} position={[0, building.height / 2, -building.depth / 2 + wallThickness / 2]} scale={[building.width, building.height, wallThickness]} castShadow={false} receiveShadow />
          <mesh geometry={unitBoxGeometry} material={adobeMaterial} position={[-doorWidth / 2 - frontWallWidth / 2, building.height / 2, building.depth / 2 - wallThickness / 2]} scale={[frontWallWidth, building.height, wallThickness]} castShadow={false} receiveShadow />
          <mesh geometry={unitBoxGeometry} material={adobeMaterial} position={[doorWidth / 2 + frontWallWidth / 2, building.height / 2, building.depth / 2 - wallThickness / 2]} scale={[frontWallWidth, building.height, wallThickness]} castShadow={false} receiveShadow />
          <mesh geometry={unitBoxGeometry} material={adobeMaterial} position={[0, doorHeight + lintelHeight / 2, building.depth / 2 - wallThickness / 2]} scale={[doorWidth, lintelHeight, wallThickness]} castShadow={false} receiveShadow />
          <mesh geometry={unitBoxGeometry} material={roofMaterial} position={[0, building.height + 0.75, 0]} scale={[building.width + 2.8, 1.5, building.depth + 2.8]} castShadow={false} receiveShadow />
          <mesh geometry={unitBoxGeometry} material={doorMaterial} position={[0, doorHeight / 2 - 0.25, building.depth / 2 + 0.16]} scale={[doorWidth * 0.82, doorHeight - 0.5, 0.34]} castShadow={false}>
          </mesh>
          <mesh geometry={unitBoxGeometry} material={trimMaterial} position={[-building.width * 0.28, windowY, building.depth / 2 + 0.14]} scale={[3.7, 3.0, 0.36]} castShadow={false}>
          </mesh>
          <mesh geometry={unitBoxGeometry} material={windowMaterial} position={[-building.width * 0.28, windowY, building.depth / 2 + 0.2]} scale={[3.1, 2.4, 0.32]} castShadow={false}>
          </mesh>
          <mesh geometry={unitBoxGeometry} material={trimMaterial} position={[building.width * 0.28, windowY, building.depth / 2 + 0.14]} scale={[3.7, 3.0, 0.36]} castShadow={false}>
          </mesh>
          <mesh geometry={unitBoxGeometry} material={windowMaterial} position={[building.width * 0.28, windowY, building.depth / 2 + 0.2]} scale={[3.1, 2.4, 0.32]} castShadow={false}>
          </mesh>
          <mesh geometry={unitBoxGeometry} material={trimMaterial} position={[-building.width / 2 - 0.16, windowY, sideWindowZ]} scale={[0.36, 2.9, sideWindowWidth + 0.62]} castShadow={false}>
          </mesh>
          <mesh geometry={unitBoxGeometry} material={windowMaterial} position={[-building.width / 2 - 0.22, windowY, sideWindowZ]} scale={[0.32, 2.15, sideWindowWidth]} castShadow={false}>
          </mesh>
          <mesh geometry={unitBoxGeometry} material={trimMaterial} position={[building.width / 2 + 0.16, windowY, -sideWindowZ]} scale={[0.36, 2.9, sideWindowWidth + 0.62]} castShadow={false}>
          </mesh>
          <mesh geometry={unitBoxGeometry} material={windowMaterial} position={[building.width / 2 + 0.22, windowY, -sideWindowZ]} scale={[0.32, 2.15, sideWindowWidth]} castShadow={false}>
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
      {Array.from({ length: rungCount }, (_, index) => (
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
      {[-0.5, 0, 0.5].map((offset) => (
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
      {Array.from({ length: 9 }, (_, index) => {
        const angle = (Math.PI * 2 * index) / 9;
        return (
          <mesh
            key={index}
            position={[Math.sin(angle) * 4.2, 25.2, Math.cos(angle) * 4.2]}
            rotation={[0.5, angle, 0.18]}
            castShadow={false}
          >
            <boxGeometry args={[1.55, 0.44, 16.5]} />
            <meshBasicMaterial color={index % 2 === 0 ? "#2f7a3f" : "#3e8f48"} />
          </mesh>
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

    wallSegments.forEach((segment, index) => {
      dummy.position.set(segment.localX, baseHeight + segment.height / 2, segment.localZ);
      dummy.rotation.set(0, segment.rotation, 0);
      dummy.scale.set(segment.width, segment.height, segment.depth);
      dummy.updateMatrix();
      wallMesh.setMatrixAt(index, dummy.matrix);
    });

    wallMesh.instanceMatrix.needsUpdate = true;
    wallMesh.computeBoundingBox();
    wallMesh.computeBoundingSphere();
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
}: {
  chunk: SurvivalChunkInfo;
  baseHeight: number;
  layout: DesertVillageLayout;
  groundGeometry: THREE.BufferGeometry;
}) {
  if (chunk.distance !== 0) return null;

  return (
    <>
      <RigidBody type="fixed" colliders="trimesh" friction={0.25} restitution={0} position={[chunk.x, 0, chunk.z]}>
        <mesh geometry={groundGeometry} dispose={null}>
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </RigidBody>
      <RigidBody type="fixed" colliders={false} friction={0.25} restitution={0} position={[chunk.x, 0, chunk.z]}>
        <CuboidCollider args={[30, 5, 30]} position={[0, baseHeight + 3.5, 0]} />
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
      </RigidBody>
    </>
  );
}

function SurvivalDesertVillage({ chunk }: { chunk: SurvivalChunkInfo }) {
  const villageBaseHeight = useMemo(() => getSurvivalVillageBaseHeight(chunk), [chunk]);
  const villagePadGeometry = useMemo(() => makeSurvivalVillagePadGeometry(chunk), [chunk]);
  const villagePadCollisionGeometry = useMemo(() => makeSurvivalVillagePadGeometry(chunk), [chunk]);
  const layout = useMemo(() => makeDesertVillageLayout(chunk, villageBaseHeight), [chunk, villageBaseHeight]);

  return (
    <>
      <DesertVillageColliders
        chunk={chunk}
        baseHeight={villageBaseHeight}
        layout={layout}
        groundGeometry={villagePadCollisionGeometry}
      />
      <group name={`survival-desert-village-${chunk.key}`} position={[chunk.x, 0, chunk.z]}>
        <DesertVillageSurface geometry={villagePadGeometry} baseHeight={villageBaseHeight} chunk={chunk} />
        <DesertVillageWallVisuals wallSegments={layout.wallSegments} baseHeight={villageBaseHeight} />
        <DesertVillageBuildings
          buildings={layout.buildings}
          baseHeight={villageBaseHeight}
          showDetails={chunk.distance === 0}
        />
        <DesertVillageDressing
          layout={layout}
          baseHeight={villageBaseHeight}
          showDetails={chunk.distance === 0}
        />
        <DesertVillageWell baseHeight={villageBaseHeight} />
        {layout.marketStalls.map((stall) => (
          <DesertMarketStall key={stall.key} stall={stall} baseHeight={villageBaseHeight} />
        ))}
        {layout.palms.map((palm) => (
          <DesertPalm key={palm.key} palm={palm} />
        ))}
      </group>
      {chunk.distance === 0 && (
        <Villagers
          key={`survival-desert-villagers-${chunk.key}`}
          huts={layout.huts}
          name={`survival-desert-villagers-${chunk.key}`}
        />
      )}
    </>
  );
}

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
const CHICAGO_SKYSCRAPER_X = -38;
const CHICAGO_SKYSCRAPER_Z = 186;
const CHICAGO_INTERSECTION_CLEARANCE = 30;
const CHICAGO_SIDEWALK_PROP_OFFSET = 20.4;
const CHICAGO_SIDEWALK_SEGMENT_GAP = 29;
const CHICAGO_SAFE_STREET_OFFSETS = [-207, -112, -38, 38, 112, 207];

let cachedChicagoWindowTexture: THREE.Texture | null = null;
let cachedChicagoFacadeTextures: THREE.Texture[] | null = null;
let cachedChicagoSignTexture: THREE.Texture | null = null;
let cachedChicagoLedSignTexture: THREE.Texture | null = null;
let cachedChicagoStoreSignTextures: THREE.Texture[] | null = null;
let cachedChicagoAdTextures: THREE.Texture[] | null = null;

function isNearChicagoIntersectionBand(value: number, clearance = CHICAGO_INTERSECTION_CLEARANCE) {
  return CHICAGO_ROAD_POSITIONS.some((road) => Math.abs(value - road) < clearance);
}

function makeChicagoSidewalkSegments() {
  const cityMin = -CHICAGO_CITY_HALF_SIZE;
  const cityMax = CHICAGO_CITY_HALF_SIZE;
  const gaps = CHICAGO_ROAD_POSITIONS
    .map((road) => ({
      start: Math.max(cityMin, road - CHICAGO_SIDEWALK_SEGMENT_GAP),
      end: Math.min(cityMax, road + CHICAGO_SIDEWALK_SEGMENT_GAP),
    }))
    .sort((a, b) => a.start - b.start);
  const segments: Array<{ key: string; center: number; length: number }> = [];
  let cursor = cityMin;

  gaps.forEach((gap, index) => {
    if (gap.start - cursor > 8) {
      segments.push({
        key: `segment-${index}-before`,
        center: (cursor + gap.start) / 2,
        length: gap.start - cursor,
      });
    }
    cursor = Math.max(cursor, gap.end);
  });

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
  cachedChicagoFacadeTextures = Array.from({ length: CHICAGO_FACADE_STYLE_COUNT }, (_, style) => makeChicagoFacadeTexture(style));
  return cachedChicagoFacadeTextures;
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
  [38, 218].forEach((x) => {
    ctx.fillRect(x, 28, 4, 4);
    ctx.fillRect(x + 8, 28, 4, 4);
    ctx.fillRect(x + 4, 36, 4, 4);
    ctx.fillRect(x + 12, 36, 4, 4);
  });

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
  lines.forEach((line, index) => {
    const lineHeight = height * 0.26;
    ctx.fillText(line, width / 2, height / 2 + 2 + (index - (lines.length - 1) / 2) * lineHeight);
  });

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
  CHICAGO_BLOCK_CENTERS.forEach((localX, xIndex) => {
    CHICAGO_BLOCK_CENTERS.forEach((localZ, zIndex) => {
      if (localX > 205 || Math.abs(localZ) < 18) return;
      const isSkyscraper = localX === CHICAGO_SKYSCRAPER_X && localZ === CHICAGO_SKYSCRAPER_Z;
      if (chunk.lod === "mid" && (xIndex + zIndex) % 2 === 1 && !isSkyscraper) return;

      const downtown = 1 - clamp01(Math.hypot(localX + 32, localZ + 26) / 250);
      const hash = survivalHash01(chunk.cx + xIndex * 13, chunk.cz + zIndex * 17, 9140);
      const clearsBeanPark = Math.hypot(localX - CHICAGO_BEAN_PARK_X, localZ - CHICAGO_BEAN_PARK_Z) < 42;
      if (clearsBeanPark && !isSkyscraper) return;

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
    });
  });

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
          {Array.from({ length: 9 }, (_, index) => (
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
  const signTexture = useMemo(() => getChicagoLedSignTexture(), []);
  const radius = Math.max(width, depth) * 0.86;
  const signHeight = 22.5;

  useFrame(({ clock }) => {
    const elapsed = clock.getElapsedTime();
    if (elapsed - lastSignUpdateRef.current < 1 / 24) return;
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
  const bodyRefs = useRef<Array<THREE.InstancedMesh | null>>([]);
  const roofRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const facadeTextures = useMemo(() => getChicagoFacadeTextures(), []);
  const buildingGroups = useMemo(() => (
    facadeTextures.map((_, style) => buildings.filter((building) => building.facadeStyle === style))
  ), [buildings, facadeTextures]);
  const bodyMaterials = useMemo(() => (
    facadeTextures.map((texture) => new THREE.MeshBasicMaterial({ map: texture, color: "#ffffff" }))
  ), [facadeTextures]);
  const roofMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: "#475569" }), []);

  useEffect(() => () => {
    bodyMaterials.forEach((material) => material.dispose());
    roofMaterial.dispose();
  }, [bodyMaterials, roofMaterial]);

  useEffect(() => {
    const roofMesh = roofRef.current;
    if (!roofMesh) return;

    buildingGroups.forEach((group, styleIndex) => {
      const bodyMesh = bodyRefs.current[styleIndex];
      if (!bodyMesh) return;

      bodyMesh.count = group.length;
      group.forEach((building, index) => {
        dummy.position.set(building.localX, baseHeight + building.height / 2, building.localZ);
        dummy.rotation.set(0, building.rotation, 0);
        dummy.scale.set(building.width, building.height, building.depth);
        dummy.updateMatrix();
        bodyMesh.setMatrixAt(index, dummy.matrix);
      });

      bodyMesh.instanceMatrix.needsUpdate = true;
      bodyMesh.computeBoundingBox();
      bodyMesh.computeBoundingSphere();
    });

    buildings.forEach((building, index) => {
      dummy.position.set(building.localX, baseHeight + building.height + 1.3, building.localZ);
      dummy.rotation.set(0, building.rotation, 0);
      dummy.scale.set(building.width + 3.4, 2.6, building.depth + 3.4);
      dummy.updateMatrix();
      roofMesh.setMatrixAt(index, dummy.matrix);
    });

    roofMesh.count = buildings.length;
    roofMesh.instanceMatrix.needsUpdate = true;
    roofMesh.computeBoundingBox();
    roofMesh.computeBoundingSphere();
  }, [baseHeight, buildingGroups, buildings, dummy]);

  const landmarks = showDetails ? buildings.filter((building) => building.landmark) : [];

  return (
    <group>
      {buildingGroups.map((group, styleIndex) => (
        <instancedMesh
          key={`chicago-facade-style-${styleIndex}`}
          ref={(mesh) => {
            bodyRefs.current[styleIndex] = mesh;
          }}
          args={[undefined, undefined, Math.max(1, group.length)]}
          castShadow={false}
          receiveShadow
        >
          <boxGeometry args={[1, 1, 1]} />
          <primitive object={bodyMaterials[styleIndex]} attach="material" />
        </instancedMesh>
      ))}
      <instancedMesh ref={roofRef} args={[undefined, undefined, buildings.length]} castShadow={false} receiveShadow={false}>
        <boxGeometry args={[1, 1, 1]} />
        <primitive object={roofMaterial} attach="material" />
      </instancedMesh>
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
              {[-1, 1].map((side) => (
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
              {[-1, 1].map((side) => (
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
            {[-1, 1].map((side) => (
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
    <group name="chicago-interior-villager" position={[0, 0.1, 0]} rotation={[0, Math.PI, 0]} scale={[0.92, 0.92, 0.92]}>
      <mesh position={[-0.32, 0.82, 0]} castShadow={false}>
        <boxGeometry args={[0.36, 1.18, 0.36]} />
        <meshBasicMaterial color={character.pantsColor} />
      </mesh>
      <mesh position={[0.32, 0.82, 0]} castShadow={false}>
        <boxGeometry args={[0.36, 1.18, 0.36]} />
        <meshBasicMaterial color={character.pantsColor} />
      </mesh>
      <mesh position={[0, 1.85, 0]} castShadow={false}>
        <boxGeometry args={[1.08, 1.42, 0.58]} />
        <meshBasicMaterial color={character.topColor} />
      </mesh>
      <mesh position={[-0.76, 1.82, 0]} castShadow={false}>
        <boxGeometry args={[0.26, 1.12, 0.28]} />
        <meshBasicMaterial color={character.skinColor} />
      </mesh>
      <mesh position={[0.76, 1.82, 0]} castShadow={false}>
        <boxGeometry args={[0.26, 1.12, 0.28]} />
        <meshBasicMaterial color={character.skinColor} />
      </mesh>
      <mesh position={[0, 2.9, 0]} castShadow={false}>
        <boxGeometry args={[0.92, 0.82, 0.68]} />
        <meshBasicMaterial color={character.skinColor} />
      </mesh>
      <mesh position={[0, 3.42, -0.02]} castShadow={false}>
        <boxGeometry args={[1.02, 0.28, 0.72]} />
        <meshBasicMaterial color={character.hairColor === "none" ? character.hatColor : character.hairColor} />
      </mesh>
      {character.hatStyle !== "none" && (
        <mesh position={[0, 3.78, 0]} castShadow={false}>
          <coneGeometry args={[0.58, 0.92, 5]} />
          <meshBasicMaterial color={character.hatColor} />
        </mesh>
      )}
      <mesh position={[-0.2, 2.98, -0.36]} castShadow={false}>
        <boxGeometry args={[0.1, 0.1, 0.08]} />
        <meshBasicMaterial color="#111827" />
      </mesh>
      <mesh position={[0.2, 2.98, -0.36]} castShadow={false}>
        <boxGeometry args={[0.1, 0.1, 0.08]} />
        <meshBasicMaterial color="#111827" />
      </mesh>
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
  const enterableBuildings = buildings.filter((building) => building.enterable);

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
            {[-1, 1].map((side) => (
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
  const intersections = useMemo(() => {
    const items: Array<{ key: string; x: number; z: number }> = [];
    CHICAGO_ROAD_POSITIONS.forEach((x) => {
      CHICAGO_ROAD_POSITIONS.forEach((z) => {
        items.push({ key: `${x}:${z}`, x, z });
      });
    });
    return items;
  }, []);

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
  const grassRefs = useRef<Array<THREE.InstancedMesh | null>>([]);
  const crosswalkRefs = useRef<Array<THREE.InstancedMesh | null>>([]);

  const hydrants = useMemo(() => {
    const items: Array<{ key: string; x: number; z: number }> = [];
    CHICAGO_ROAD_POSITIONS.forEach((road, roadIndex) => {
      [-186, -62, 62, 186].forEach((offset, index) => {
        const side = index % 2 === 0 ? -1 : 1;
        items.push({ key: `hydrant-v-${road}-${offset}`, x: road + side * 17.2, z: offset + roadIndex * 2 });
      });
    });
    return items.slice(0, 16);
  }, []);

  const lamps = useMemo(() => {
    const items: Array<{ key: string; x: number; z: number; rotation: number }> = [];
    const aimToward = (x: number, z: number, targetX: number, targetZ: number) => Math.atan2(targetX - x, targetZ - z);
    CHICAGO_ROAD_POSITIONS.forEach((road) => {
      [-202, -126, -34, 34, 126, 202].forEach((offset, index) => {
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
      });
    });
    return items.slice(0, 48);
  }, []);

  const trashCans = useMemo(() => {
    const items: Array<{ key: string; x: number; z: number }> = [];
    CHICAGO_ROAD_POSITIONS.forEach((road, roadIndex) => {
      CHICAGO_SAFE_STREET_OFFSETS.forEach((offset, index) => {
        if (isNearChicagoIntersectionBand(offset)) return;
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
      });
    });
    return items.slice(0, 52);
  }, []);

  const benches = useMemo(() => {
    const items: Array<{ key: string; x: number; z: number; rotation: number }> = [];
    CHICAGO_ROAD_POSITIONS.forEach((road, roadIndex) => {
      CHICAGO_SAFE_STREET_OFFSETS.forEach((offset, index) => {
        if (isNearChicagoIntersectionBand(offset)) return;
        const side = index % 2 === 0 ? -1 : 1;
        const verticalX = road + side * CHICAGO_SIDEWALK_PROP_OFFSET;
        items.push({
          key: `bench-v-${road}-${offset}`,
          x: verticalX,
          z: offset,
          rotation: getChicagoStreetFacingRotation(verticalX, offset, road, offset),
        });
        if ((index + roadIndex) % 2 === 0) {
          const horizontalZ = road + side * CHICAGO_SIDEWALK_PROP_OFFSET;
          items.push({
            key: `bench-h-${road}-${offset}`,
            x: offset,
            z: horizontalZ,
            rotation: getChicagoStreetFacingRotation(offset, horizontalZ, offset, road),
          });
        }
      });
    });
    return items.slice(0, 34);
  }, []);

  const streetTrees = useMemo(() => {
    const items: Array<{ key: string; x: number; z: number; scale: number }> = [];
    CHICAGO_ROAD_POSITIONS.forEach((road, roadIndex) => {
      CHICAGO_SAFE_STREET_OFFSETS.forEach((offset, index) => {
        if (isNearChicagoIntersectionBand(offset)) return;
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
      });
    });
    return items.slice(0, 58);
  }, []);

  const grassPatches = useMemo(() => {
    const items: Array<{ key: string; x: number; z: number; width: number; depth: number; color: string }> = [];
    CHICAGO_ROAD_POSITIONS.forEach((road, roadIndex) => {
      CHICAGO_SAFE_STREET_OFFSETS.forEach((offset, index) => {
        if (isNearChicagoIntersectionBand(offset)) return;
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
      });
    });
    return items.slice(0, 72);
  }, []);

  const crosswalks = useMemo(() => {
    const items: Array<{ key: string; x: number; z: number; width: number; depth: number; opacity: number }> = [];
    const approachOffset = 18.8;
    const roadSpan = 24.6;
    const crosswalkLength = 6.4;
    const halfCrosswalk = crosswalkLength / 2;
    const barWidth = 1.05;
    const barOffsets = [-9, -5.4, -1.8, 1.8, 5.4, 9];
    CHICAGO_ROAD_POSITIONS.forEach((x) => {
      CHICAGO_ROAD_POSITIONS.forEach((z) => {
        [-1, 1].forEach((direction) => {
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

          barOffsets.forEach((offset, stripeIndex) => {
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
          });
        });
      });
    });
    return items;
  }, []);

  const sidewalkPlanes = useMemo(() => {
    const items: Array<{ x: number; z: number; width: number; depth: number }> = [];
    CHICAGO_ROAD_POSITIONS.forEach((x) => {
      [-18, 18].forEach((side) => {
        sidewalkSegments.forEach((segment) => {
          items.push({ x: x + side, z: segment.center, width: 6.5, depth: segment.length });
        });
      });
    });
    CHICAGO_ROAD_POSITIONS.forEach((z) => {
      [-18, 18].forEach((side) => {
        sidewalkSegments.forEach((segment) => {
          items.push({ x: segment.center, z: z + side, width: segment.length, depth: 6.5 });
        });
      });
    });
    return items;
  }, [sidewalkSegments]);

  const parkingLines = useMemo(() => {
    const items: Array<{ x: number; z: number; width: number; depth: number }> = [];
    CHICAGO_ROAD_POSITIONS.forEach((x) => {
      Array.from({ length: 8 }, (_, index) => {
        items.push({ x: x - 12.6, z: -198 + index * 56, width: 1.1, depth: 21 });
      });
    });
    CHICAGO_ROAD_POSITIONS.forEach((z) => {
      Array.from({ length: 8 }, (_, index) => {
        items.push({ x: -198 + index * 56, z: z + 12.6, width: 21, depth: 1.1 });
      });
    });
    return items;
  }, []);

  const grassGroups = useMemo(() => {
    const groups = new Map<string, typeof grassPatches>();
    grassPatches.forEach((patch) => {
      groups.set(patch.color, [...(groups.get(patch.color) ?? []), patch]);
    });
    return Array.from(groups, ([color, items]) => ({ color, items }));
  }, [grassPatches]);

  const crosswalkGroups = useMemo(() => {
    const groups = new Map<number, typeof crosswalks>();
    crosswalks.forEach((stripe) => {
      groups.set(stripe.opacity, [...(groups.get(stripe.opacity) ?? []), stripe]);
    });
    return Array.from(groups, ([opacity, items]) => ({ opacity, items }));
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
      sidewalkPlanes.forEach((item, index) => {
        setFlatPlane(sidewalkMesh, index, item.x, baseHeight + 0.37, item.z, item.width, item.depth);
      });
      sidewalkMesh.count = sidewalkPlanes.length;
      sidewalkMesh.instanceMatrix.needsUpdate = true;
    }

    const parkingMesh = parkingRef.current;
    if (parkingMesh) {
      parkingLines.forEach((item, index) => {
        setFlatPlane(parkingMesh, index, item.x, baseHeight + 0.395, item.z, item.width, item.depth);
      });
      parkingMesh.count = parkingLines.length;
      parkingMesh.instanceMatrix.needsUpdate = true;
    }

    grassGroups.forEach((group, groupIndex) => {
      const mesh = grassRefs.current[groupIndex];
      if (!mesh) return;
      group.items.forEach((patch, index) => {
        setFlatPlane(mesh, index, patch.x, baseHeight + 0.405, patch.z, patch.width, patch.depth);
      });
      mesh.count = group.items.length;
      mesh.instanceMatrix.needsUpdate = true;
    });

    crosswalkGroups.forEach((group, groupIndex) => {
      const mesh = crosswalkRefs.current[groupIndex];
      if (!mesh) return;
      group.items.forEach((stripe, index) => {
        setFlatPlane(mesh, index, stripe.x, baseHeight + 0.43, stripe.z, stripe.width, stripe.depth);
      });
      mesh.count = group.items.length;
      mesh.instanceMatrix.needsUpdate = true;
    });
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
          {[-2.2, 2.2].map((x) => (
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
          <mesh position={[0, 6.2, 0]} castShadow={false}>
            <dodecahedronGeometry args={[2.85, 0]} />
            <meshBasicMaterial color="#15803d" />
          </mesh>
          <mesh position={[1.1, 5.55, -0.8]} castShadow={false}>
            <dodecahedronGeometry args={[2.05, 0]} />
            <meshBasicMaterial color="#166534" />
          </mesh>
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
      {([-1, 1] as const).map((side) => (
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
      {([-1, 1] as const).map((side) => (
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
      {([-1, 1] as const).map((side) => (
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
      {([-1, 1] as const).map((side) => (
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
      {[-1, 1].map((side) => (
        <group key={`bean-park-bollards-${side}`} rotation={[0, side * 0.68, 0]}>
          {[-18, -6, 6, 18].map((x) => (
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

function getChicagoVehicleTransform(car: ChicagoCar, elapsedSeconds: number) {
  let t = (car.offset + elapsedSeconds * car.speed) % 1;
  if (car.direction < 0) t = 1 - t;
  const spanStart = -218;
  const spanEnd = 190;
  const position = lerpNumber(spanStart, spanEnd, t);

  if (car.route === "vertical" || car.route === "lakeshore") {
    return {
      x: car.route === "lakeshore" ? 190 : car.lane + car.direction * 4.2,
      z: position,
      yaw: car.direction > 0 ? 0 : Math.PI,
    };
  }

  return {
    x: position,
    z: car.lane - car.direction * 4.2,
    yaw: car.direction > 0 ? Math.PI / 2 : -Math.PI / 2,
  };
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

function groupChicagoCarsByColor(
  cars: ChicagoCar[],
  getColor: (car: ChicagoCar) => string,
  shouldInclude: (car: ChicagoCar) => boolean = () => true,
) {
  const groups: ChicagoCarColorGroup[] = [];
  const groupIndexes = new Map<string, number>();

  cars.forEach((car, index) => {
    if (!shouldInclude(car)) return;
    const color = getColor(car);
    let groupIndex = groupIndexes.get(color);
    if (groupIndex === undefined) {
      groupIndex = groups.length;
      groupIndexes.set(color, groupIndex);
      groups.push({ color, items: [] });
    }
    groups[groupIndex].items.push({ car, index });
  });

  return groups;
}

function ChicagoTraffic({ cars, baseHeight }: { cars: ChicagoCar[]; baseHeight: number }) {
  const bodyRefs = useRef<Array<THREE.InstancedMesh | null>>([]);
  const sideMarkRefs = useRef<Array<THREE.InstancedMesh | null>>([]);
  const lightBarRefs = useRef<Array<THREE.InstancedMesh | null>>([]);
  const cabinRef = useRef<THREE.InstancedMesh>(null);
  const taxiSignRef = useRef<THREE.InstancedMesh>(null);
  const wheelRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const lastUpdateRef = useRef(-1);
  const carInstances = useMemo(() => cars.map((car, index) => ({ car, index })), [cars]);
  const bodyGroups = useMemo(() => groupChicagoCarsByColor(cars, (car) => car.color), [cars]);
  const sideMarkGroups = useMemo(() => groupChicagoCarsByColor(cars, getChicagoCarSideMarkColor), [cars]);
  const lightBarGroups = useMemo(
    () => groupChicagoCarsByColor(cars, getChicagoCarLightBarColor, (car) => car.vehicleType === "police" || car.vehicleType === "ambulance" || car.vehicleType === "firetruck"),
    [cars],
  );
  const taxiCars = useMemo(() => carInstances.filter(({ car }) => car.vehicleType === "taxi"), [carInstances]);

  const finalizeMesh = (mesh: THREE.InstancedMesh, count: number) => {
    mesh.count = count;
    mesh.instanceMatrix.needsUpdate = true;
  };

  const writeCarMatrices = (elapsedSeconds: number) => {
    const cabinMesh = cabinRef.current;
    const taxiSignMesh = taxiSignRef.current;
    const wheelMesh = wheelRef.current;
    if (!cabinMesh || !taxiSignMesh || !wheelMesh) return;

    const transforms = cars.map((car) => getChicagoVehicleTransform(car, elapsedSeconds));
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

    bodyGroups.forEach((group, groupIndex) => {
      const mesh = bodyRefs.current[groupIndex];
      if (!mesh) return;
      group.items.forEach(({ car, index }, matrixIndex) => {
        const lengthScale = getChicagoCarLengthScale(car);
        placePart(mesh, matrixIndex, car, index, 0, 0.85 * car.scale, 0, 5.2 * car.scale, 1.35 * car.scale, 8.7 * car.scale * lengthScale);
      });
      finalizeMesh(mesh, group.items.length);
    });

    carInstances.forEach(({ car, index }) => {
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
    });
    finalizeMesh(cabinMesh, cars.length);

    sideMarkGroups.forEach((group, groupIndex) => {
      const mesh = sideMarkRefs.current[groupIndex];
      if (!mesh) return;
      group.items.forEach(({ car, index }, matrixIndex) => {
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
      });
      finalizeMesh(mesh, group.items.length);
    });

    taxiCars.forEach(({ car, index }, matrixIndex) => {
      placePart(taxiSignMesh, matrixIndex, car, index, 0, 2.58 * car.scale, -0.75 * car.scale, 2.3 * car.scale, 0.6 * car.scale, 1.2 * car.scale);
    });
    finalizeMesh(taxiSignMesh, taxiCars.length);

    lightBarGroups.forEach((group, groupIndex) => {
      const mesh = lightBarRefs.current[groupIndex];
      if (!mesh) return;
      group.items.forEach(({ car, index }, matrixIndex) => {
        placePart(mesh, matrixIndex, car, index, 0, 2.45 * car.scale, -0.92 * car.scale, 2.2 * car.scale, 0.32 * car.scale, 0.65 * car.scale);
      });
      finalizeMesh(mesh, group.items.length);
    });

    carInstances.forEach(({ car, index }) => {
      const lengthScale = getChicagoCarLengthScale(car);
      let wheelIndex = index * 4;
      ([-1, 1] as const).forEach((xSide) => {
        ([-1, 1] as const).forEach((zSide) => {
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
        });
      });
    });
    finalizeMesh(wheelMesh, cars.length * 4);
  };

  useEffect(() => {
    writeCarMatrices(0);
  }, [baseHeight, bodyGroups, carInstances, cars, dummy, lightBarGroups, sideMarkGroups, taxiCars]);

  useFrame((state) => {
    const elapsedSeconds = state.clock.elapsedTime;
    if (elapsedSeconds - lastUpdateRef.current < 1 / 30) return;
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

  const writePedestrianMatrices = (elapsedSeconds: number) => {
    const bodyMesh = bodyRef.current;
    const headMesh = headRef.current;
    const legLeftMesh = legLeftRef.current;
    const legRightMesh = legRightRef.current;
    const armLeftMesh = armLeftRef.current;
    const armRightMesh = armRightRef.current;
    if (!bodyMesh || !headMesh || !legLeftMesh || !legRightMesh || !armLeftMesh || !armRightMesh) return;

    pedestrians.forEach((pedestrian, index) => {
      const transform = getChicagoPedestrianTransform(pedestrian, elapsedSeconds);
      const groundY = baseHeight + 0.08;
      const step = Math.sin(elapsedSeconds * 9 + index * 0.73) * 0.16 * pedestrian.direction;
      setChicagoInstancedPart(dummy, bodyMesh, index, transform.x, groundY, transform.z, transform.yaw, 0, 1.85, 0, 0.78, 1.55, 0.48);
      setChicagoInstancedPart(dummy, headMesh, index, transform.x, groundY, transform.z, transform.yaw, 0, 3.0, -0.02, 0.94, 0.9, 0.72);
      setChicagoInstancedPart(dummy, legLeftMesh, index, transform.x, groundY, transform.z, transform.yaw, -0.22, 0.74, step, 0.26, 1.05, 0.26);
      setChicagoInstancedPart(dummy, legRightMesh, index, transform.x, groundY, transform.z, transform.yaw, 0.22, 0.74, -step, 0.26, 1.05, 0.26);
      setChicagoInstancedPart(dummy, armLeftMesh, index, transform.x, groundY, transform.z, transform.yaw, -0.58, 1.82, -step, 0.2, 1.05, 0.22);
      setChicagoInstancedPart(dummy, armRightMesh, index, transform.x, groundY, transform.z, transform.yaw, 0.58, 1.82, step, 0.2, 1.05, 0.22);
    });

    [bodyMesh, headMesh, legLeftMesh, legRightMesh, armLeftMesh, armRightMesh].forEach((mesh) => {
      mesh.instanceMatrix.needsUpdate = true;
    });
  };

  useEffect(() => {
    const bodyMesh = bodyRef.current;
    const headMesh = headRef.current;
    const legLeftMesh = legLeftRef.current;
    const legRightMesh = legRightRef.current;
    const armLeftMesh = armLeftRef.current;
    const armRightMesh = armRightRef.current;
    if (!bodyMesh || !headMesh || !legLeftMesh || !legRightMesh || !armLeftMesh || !armRightMesh) return;

    [bodyMesh, headMesh, legLeftMesh, legRightMesh, armLeftMesh, armRightMesh].forEach((mesh) => {
      mesh.count = pedestrians.length;
    });
    writePedestrianMatrices(0);
  }, [baseHeight, dummy, pedestrians]);

  useFrame((state) => {
    const elapsedSeconds = state.clock.elapsedTime;
    if (elapsedSeconds - lastUpdateRef.current < 1 / 24) return;
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
  if (chunk.distance !== 0) return null;

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
              {[-1, 1].map((side) => (
                <CuboidCollider
                  key={`${building.key}-side-wall-${side}`}
                  args={[wallThickness / 2, building.height / 2, building.depth / 2]}
                  position={placeWall(side * (building.width / 2 - wallThickness / 2), 0)}
                  rotation={[0, building.rotation, 0]}
                />
              ))}
              {[-1, 1].map((side) => (
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
      </RigidBody>
    </>
  );
}

function SurvivalChicagoCity({ chunk }: { chunk: SurvivalChunkInfo }) {
  const cityBaseHeight = useMemo(() => getSurvivalVillageBaseHeight(chunk), [chunk]);
  const cityPadGeometry = useMemo(() => makeSurvivalVillagePadGeometry(chunk), [chunk]);
  const cityPadCollisionGeometry = useMemo(() => makeSurvivalVillagePadGeometry(chunk), [chunk]);
  const layout = useMemo(() => makeChicagoLayout(chunk), [chunk]);
  const signTexture = useMemo(() => getChicagoSignTexture(), []);

  return (
    <>
      <ChicagoCityColliders
        chunk={chunk}
        baseHeight={cityBaseHeight}
        buildings={layout.buildings}
        groundGeometry={cityPadCollisionGeometry}
      />
      <group name={`survival-chicago-city-${chunk.key}`} position={[chunk.x, 0, chunk.z]}>
        <ChicagoCitySurface geometry={cityPadGeometry} baseHeight={cityBaseHeight} />
        <ChicagoBuildings buildings={layout.buildings} baseHeight={cityBaseHeight} showDetails={chunk.distance === 0} />
        <ChicagoBuildingDetails buildings={layout.buildings} baseHeight={cityBaseHeight} showDetails={chunk.distance === 0} />
        <ChicagoBuildingInteriors buildings={layout.buildings} baseHeight={cityBaseHeight} showDetails={chunk.distance === 0} />
        {chunk.distance === 0 && <ChicagoStreetDetails baseHeight={cityBaseHeight} />}
        {chunk.distance === 0 && <ChicagoBeanPark baseHeight={cityBaseHeight} />}
        <group position={[-206, cityBaseHeight + 15, 214]}>
          <mesh position={[0, -6, 0]} castShadow={false}>
            <boxGeometry args={[4, 12, 3]} />
            <meshBasicMaterial color="#111827" />
          </mesh>
          <sprite scale={[72, 20, 1]} frustumCulled={false}>
            <spriteMaterial map={signTexture} transparent alphaTest={0.05} depthWrite={false} />
          </sprite>
        </group>
        {chunk.distance === 0 && (
          <>
            <ChicagoTraffic cars={layout.cars} baseHeight={cityBaseHeight} />
            <ChicagoPedestrians pedestrians={layout.pedestrians} baseHeight={cityBaseHeight} />
          </>
        )}
      </group>
    </>
  );
}

type SwampVillageHut = {
  key: string;
  localX: number;
  localZ: number;
  width: number;
  depth: number;
  height: number;
  rotation: number;
  platformY: number;
  wallColor: string;
  roofColor: string;
  variant: number;
};

type SwampVillageWalkway = {
  key: string;
  localX: number;
  localZ: number;
  rotation: number;
  width: number;
  length: number;
  y: number;
};

type SwampVillageRamp = {
  key: string;
  localX: number;
  localZ: number;
  rotation: number;
  width: number;
  length: number;
  highY: number;
  lowY: number;
};

type SwampVillageLilyPad = {
  key: string;
  localX: number;
  localZ: number;
  scale: number;
  rotation: number;
  color: string;
};

type SwampVillageStump = {
  key: string;
  localX: number;
  localZ: number;
  height: number;
  radius: number;
};

type SwampVillageReedPatch = {
  key: string;
  localX: number;
  localZ: number;
  rotation: number;
  scale: number;
};

type SwampVillageRope = {
  key: string;
  start: [number, number, number];
  end: [number, number, number];
  sag: number;
  lightCount: number;
  lightHue: number;
};

type SwampVillageLayout = {
  huts: SwampVillageHut[];
  hutInfos: HutInfo[];
  walkways: SwampVillageWalkway[];
  ramps: SwampVillageRamp[];
  lilyPads: SwampVillageLilyPad[];
  stumps: SwampVillageStump[];
  reeds: SwampVillageReedPatch[];
  ropes: SwampVillageRope[];
  waterY: number;
  platformY: number;
};

const SWAMP_VILLAGE_RADIUS = 214;
const SWAMP_VILLAGE_PLATFORM_SIZE = 76;
const SWAMP_VILLAGE_HUT_COLORS = ["#5c4a2e", "#4c3b25", "#665634", "#3f3524"];
const SWAMP_VILLAGE_ROOF_COLORS = ["#223516", "#2f431b", "#445223", "#1f2d16"];
const SWAMP_LILY_COLORS = ["#6ea43e", "#7db34d", "#4e8735", "#89bd5a"];
const SWAMP_MOSS_COLORS = ["#5d7d34", "#425f27", "#728644", "#30491f"];
const SWAMP_DARK_WOOD = "#21150c";
const SWAMP_WET_WOOD = "#2b1c12";
const SWAMP_ROPE_LIGHT_COLORS = ["#fde68a", "#fbbf24", "#bbf7d0", "#86efac"];

function getSwampVillageWaterY(chunk: SurvivalChunkInfo, baseHeight: number) {
  return Math.max(getSurvivalWaterLevelAtWorld(chunk.x, chunk.z) + 0.22, baseHeight + 0.42);
}

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

function getSwampHutRopeAnchor(hut: SwampVillageHut, target: SwampVillageHut): [number, number, number] {
  const dx = target.localX - hut.localX;
  const dz = target.localZ - hut.localZ;
  const distance = Math.max(1, Math.hypot(dx, dz));
  const nx = dx / distance;
  const nz = dz / distance;
  const anchorRadius = Math.min(14, Math.max(hut.width, hut.depth) * 0.58 + 1.4);

  return [
    hut.localX + nx * anchorRadius,
    hut.platformY + hut.height + 1.55 + (hut.variant - 0.5) * 0.55,
    hut.localZ + nz * anchorRadius,
  ];
}

function getSaggingRopePoint(rope: SwampVillageRope, t: number) {
  const invT = 1 - t;
  return new THREE.Vector3(
    rope.start[0] * invT + rope.end[0] * t,
    rope.start[1] * invT + rope.end[1] * t - Math.sin(Math.PI * t) * rope.sag,
    rope.start[2] * invT + rope.end[2] * t,
  );
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

function configurePixelSpriteTexture(texture: THREE.Texture) {
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

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
      rows.forEach((row, rowIndex) => {
        Array.from(row).forEach((cell, colIndex) => {
          if (cell !== "1") return;
          pixelRect(
            x + offsetX + colIndex * unit,
            y + offsetY + rowIndex * unit,
            unit,
            unit,
            fill,
          );
        });
      });
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
    widths.forEach((width, index) => {
      pixelRect(cursor, y + (index % 2), width, 3, color);
      cursor += width + 3;
    });
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
  [38, 51, 65, 159, 173, 186].forEach((x, index) => {
    pixelRect(x, 153 + (index % 2), 11, 4, "#3e291b");
    pixelRect(x + 2, 148 + (index % 2), 8, 4, "#c58c5a");
  });
  pixelRect(38, 119, 9, 21, "#4f3728");
  pixelRect(177, 119, 9, 21, "#4f3728");
  pixelRect(45, 116, 12, 24, "#8a6040");
  pixelRect(167, 116, 12, 24, "#8a6040");

  // Warts, freckles, and broken pixel patches add realism without smoothing away the pixel style.
  [
    [76, 42, 5], [99, 46, 4], [122, 42, 5], [144, 49, 4],
    [69, 80, 3], [92, 72, 3], [116, 70, 3], [144, 78, 3],
    [51, 92, 4], [173, 92, 4], [86, 118, 3], [136, 118, 3],
    [58, 110, 3], [166, 110, 3], [105, 89, 2], [128, 91, 2],
  ].forEach(([x, y, radius], index) => wart(x, y, radius, index % 2 === 0 ? "#7d5637" : "#9f7046"));

  [
    [90, 126], [101, 130], [117, 128], [130, 132], [74, 107],
    [150, 107], [96, 82], [128, 83], [112, 58], [82, 58],
    [142, 58], [92, 102], [132, 102], [99, 141], [122, 141],
  ].forEach(([x, y], index) => pixelRect(x, y, index % 3 === 0 ? 4 : 3, 2, index % 2 === 0 ? "#6b4a31" : "#8f613b"));

  const highlightPatches: Array<[number, number, number, number, string]> = [
    [70, 86, 12, 3, "#e0b47c"], [142, 86, 12, 3, "#e0b47c"],
    [78, 62, 13, 3, "#f0c895"], [133, 62, 13, 3, "#f0c895"],
    [91, 111, 13, 3, "#f2cda5"], [120, 111, 13, 3, "#f2cda5"],
    [58, 134, 18, 3, "#c99461"], [148, 134, 18, 3, "#c99461"],
    [83, 151, 52, 3, "#4e3525"],
  ];
  highlightPatches.forEach(([x, y, width, height, color]) => pixelRect(x, y, width, height, color));

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
      const loadedFrames = await Promise.all(srcs.map(loadOptionalTexture));
      const usableFrames = loadedFrames.filter((texture) => texture !== fallbackTexture);
      return usableFrames.length > 0 ? loadedFrames : [fallbackTexture];
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
      ownedTextures.forEach((texture) => texture.dispose());
    };
  }, [fallbackTexture]);

  return textures;
}

function makeSwampVillageLayout(chunk: SurvivalChunkInfo, baseHeight: number): SwampVillageLayout {
  const waterY = getSwampVillageWaterY(chunk, baseHeight);
  const platformY = waterY + 5.9;
  const huts: SwampVillageHut[] = [];
  const hutInfos: HutInfo[] = [];
  const dockDirections = [
    { key: "north", localX: 0, localZ: -SWAMP_VILLAGE_RADIUS * 0.5, rotation: 0, rampX: 0, rampZ: -1, rampRotation: Math.PI },
    { key: "south", localX: 0, localZ: SWAMP_VILLAGE_RADIUS * 0.5, rotation: 0, rampX: 0, rampZ: 1, rampRotation: 0 },
    { key: "east", localX: SWAMP_VILLAGE_RADIUS * 0.5, localZ: 0, rotation: Math.PI / 2, rampX: 1, rampZ: 0, rampRotation: Math.PI / 2 },
    { key: "west", localX: -SWAMP_VILLAGE_RADIUS * 0.5, localZ: 0, rotation: Math.PI / 2, rampX: -1, rampZ: 0, rampRotation: -Math.PI / 2 },
  ];
  const walkways: SwampVillageWalkway[] = [
    ...dockDirections.map((direction) => ({
      key: `${chunk.key}-swamp-main-${direction.key}`,
      localX: direction.localX,
      localZ: direction.localZ,
      rotation: direction.rotation,
      width: 14,
      length: SWAMP_VILLAGE_RADIUS,
      y: platformY,
    })),
  ];
  const rampLength = 76;
  const rampLowY = Math.max(baseHeight + 1.25, waterY + 0.76);
  const ramps: SwampVillageRamp[] = dockDirections.map((direction) => ({
    key: `${chunk.key}-swamp-ramp-${direction.key}`,
    localX: direction.rampX * (SWAMP_VILLAGE_RADIUS + rampLength * 0.5),
    localZ: direction.rampZ * (SWAMP_VILLAGE_RADIUS + rampLength * 0.5),
    rotation: direction.rampRotation,
    width: 17,
    length: rampLength,
    highY: platformY,
    lowY: rampLowY,
  }));

  const hutCount = chunk.lod === "mid" ? 7 : 13;
  for (let index = 0; index < hutCount; index += 1) {
    const ring = index % 4 === 0 ? 92 : index % 3 === 0 ? 148 : 124;
    const angle = (Math.PI * 2 * index) / hutCount + 0.22 + (survivalHash01(chunk.cx, chunk.cz, 910 + index) - 0.5) * 0.28;
    const localX = Math.sin(angle) * ring + (survivalHash01(chunk.cx, chunk.cz, 930 + index) - 0.5) * 14;
    const localZ = Math.cos(angle) * ring + (survivalHash01(chunk.cx, chunk.cz, 950 + index) - 0.5) * 14;
    const variant = survivalHash01(chunk.cx, chunk.cz, 970 + index);
    const width = 17 + Math.round(variant * 7);
    const depth = 15 + Math.round(survivalHash01(chunk.cx, chunk.cz, 990 + index) * 7);
    const height = 10.5 + Math.round(survivalHash01(chunk.cx, chunk.cz, 1010 + index) * 4.5);
    const rotation = Math.atan2(-localX, -localZ);
    const key = `${chunk.key}-swamp-hut-${index}`;

    huts.push({
      key,
      localX,
      localZ,
      width,
      depth,
      height,
      rotation,
      platformY,
      wallColor: SWAMP_VILLAGE_HUT_COLORS[Math.floor(variant * SWAMP_VILLAGE_HUT_COLORS.length) % SWAMP_VILLAGE_HUT_COLORS.length],
      roofColor: SWAMP_VILLAGE_ROOF_COLORS[Math.floor(variant * SWAMP_VILLAGE_ROOF_COLORS.length * 1.9) % SWAMP_VILLAGE_ROOF_COLORS.length],
      variant,
    });

    hutInfos.push({
      id: key,
      x: chunk.x + localX,
      y: platformY,
      z: chunk.z + localZ,
      hutType: 30 + index,
      colorIndex: Math.floor(variant * 4) % 4,
      rotation,
      hasPath: true,
      pathRot: rotation,
      isMushroom: false,
      interiorWidth: Math.max(7, width - 4),
      interiorDepth: Math.max(7, depth - 4),
      interiorHeight: height + 3,
      villagerBackOffset: -depth * 0.18,
      villagerSideOffset: (survivalHash01(chunk.cx, chunk.cz, 1030 + index) - 0.5) * width * 0.34,
      villagerYOffset: 1.05,
      villagerTheme: "swamp",
    });

    const distance = Math.max(1, Math.hypot(localX, localZ));
    walkways.push({
      key: `${key}-walkway`,
      localX: localX * 0.5,
      localZ: localZ * 0.5,
      rotation: Math.atan2(localX, localZ),
      width: 10 + survivalHash01(chunk.cx, chunk.cz, 1050 + index) * 3,
      length: Math.max(28, distance - Math.max(width, depth) * 0.45),
      y: platformY,
    });
  }

  const lilyPadCount = chunk.lod === "mid" ? 12 : 28;
  const lilyPads = Array.from({ length: lilyPadCount }, (_, index) => {
    const angle = survivalHash01(chunk.cx, chunk.cz, 1070 + index) * Math.PI * 2;
    const radius = 46 + Math.pow(survivalHash01(chunk.cx, chunk.cz, 1090 + index), 0.58) * (SWAMP_VILLAGE_RADIUS + 34);
    return {
      key: `${chunk.key}-swamp-lily-${index}`,
      localX: Math.sin(angle) * radius + (survivalHash01(chunk.cx, chunk.cz, 1110 + index) - 0.5) * 32,
      localZ: Math.cos(angle) * radius + (survivalHash01(chunk.cx, chunk.cz, 1130 + index) - 0.5) * 32,
      scale: 7 + survivalHash01(chunk.cx, chunk.cz, 1150 + index) * 12,
      rotation: angle + survivalHash01(chunk.cx, chunk.cz, 1170 + index) * Math.PI,
      color: SWAMP_LILY_COLORS[index % SWAMP_LILY_COLORS.length],
    };
  });

  const stumpCount = chunk.lod === "mid" ? 8 : 18;
  const stumps = Array.from({ length: stumpCount }, (_, index) => {
    const angle = survivalHash01(chunk.cx, chunk.cz, 1190 + index) * Math.PI * 2;
    const radius = 64 + survivalHash01(chunk.cx, chunk.cz, 1210 + index) * (SWAMP_VILLAGE_RADIUS + 48);
    return {
      key: `${chunk.key}-swamp-stump-${index}`,
      localX: Math.sin(angle) * radius,
      localZ: Math.cos(angle) * radius,
      height: 4 + survivalHash01(chunk.cx, chunk.cz, 1230 + index) * 8,
      radius: 1.4 + survivalHash01(chunk.cx, chunk.cz, 1250 + index) * 1.8,
    };
  });

  const reedCount = chunk.lod === "mid" ? 14 : 36;
  const reeds = Array.from({ length: reedCount }, (_, index) => {
    const angle = survivalHash01(chunk.cx, chunk.cz, 1270 + index) * Math.PI * 2;
    const radius = 58 + Math.pow(survivalHash01(chunk.cx, chunk.cz, 1290 + index), 0.62) * (SWAMP_VILLAGE_RADIUS + 42);
    return {
      key: `${chunk.key}-swamp-reeds-${index}`,
      localX: Math.sin(angle) * radius + (survivalHash01(chunk.cx, chunk.cz, 1310 + index) - 0.5) * 24,
      localZ: Math.cos(angle) * radius + (survivalHash01(chunk.cx, chunk.cz, 1330 + index) - 0.5) * 24,
      rotation: angle + survivalHash01(chunk.cx, chunk.cz, 1350 + index) * Math.PI,
      scale: 0.8 + survivalHash01(chunk.cx, chunk.cz, 1370 + index) * 0.9,
    };
  });

  const sortedHuts = [...huts].sort((a, b) => Math.atan2(a.localX, a.localZ) - Math.atan2(b.localX, b.localZ));
  const ropes = sortedHuts.length > 1
    ? sortedHuts.map((hut, index) => {
      const next = sortedHuts[(index + 1) % sortedHuts.length];
      const start = getSwampHutRopeAnchor(hut, next);
      const end = getSwampHutRopeAnchor(next, hut);
      const span = Math.hypot(end[0] - start[0], end[2] - start[2]);
      return {
        key: `${chunk.key}-swamp-rope-${index}`,
        start,
        end,
        sag: Math.min(8.5, Math.max(3.2, span * 0.095)),
        lightCount: span > 78 ? 4 : 3,
        lightHue: survivalHash01(chunk.cx, chunk.cz, 1390 + index),
      };
    })
    : [];

  return { huts, hutInfos, walkways, ramps, lilyPads, stumps, reeds, ropes, waterY, platformY };
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
      {showDetails && Array.from({ length: 10 }, (_, index) => {
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

function SwampVillageReedPatch({ reed, waterY }: { reed: SwampVillageReedPatch; waterY: number }) {
  return (
    <group position={[reed.localX, waterY + 0.12, reed.localZ]} rotation={[0, reed.rotation, 0]} scale={[reed.scale, reed.scale, reed.scale]}>
      {Array.from({ length: 5 }, (_, index) => {
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
    const up = new THREE.Vector3(0, 1, 0);
    return layout.ropes.flatMap((rope) => {
      const segmentCount = 7;
      return Array.from({ length: segmentCount }, (_, index) => {
        const start = getSaggingRopePoint(rope, index / segmentCount);
        const end = getSaggingRopePoint(rope, (index + 1) / segmentCount);
        const direction = end.clone().sub(start);
        const length = Math.max(0.01, direction.length());
        const midpoint = start.clone().add(end).multiplyScalar(0.5);
        const quaternion = new THREE.Quaternion().setFromUnitVectors(up, direction.normalize());
        return {
          key: `${rope.key}-segment-${index}`,
          position: [midpoint.x, midpoint.y, midpoint.z] as [number, number, number],
          quaternion,
          length,
        };
      });
    });
  }, [layout.ropes, showDetails]);

  const ropeBulbs = useMemo(() => {
    if (!showDetails) return [];
    return layout.ropes.flatMap((rope, ropeIndex) => {
      const lightColor = SWAMP_ROPE_LIGHT_COLORS[Math.floor(rope.lightHue * SWAMP_ROPE_LIGHT_COLORS.length) % SWAMP_ROPE_LIGHT_COLORS.length];
      return Array.from({ length: rope.lightCount }, (_, index) => {
        const t = (index + 1) / (rope.lightCount + 1);
        const point = getSaggingRopePoint(rope, t);
        const cordLength = 1.25 + ((ropeIndex + index) % 3) * 0.32;
        return {
          key: `${rope.key}-light-${index}`,
          position: [point.x, point.y - cordLength, point.z] as [number, number, number],
          cordPosition: [point.x, point.y - cordLength / 2, point.z] as [number, number, number],
          cordLength,
          color: lightColor,
          hasPointLight: ropeIndex < 3 && index === Math.floor(rope.lightCount / 2),
        };
      });
    });
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
  const fallbackTexture = useMemo(() => makeSwampToadTexture(false), []);
  const sleepZTexture = useMemo(() => makeSwampToadSleepZTexture(), []);
  const toadTextures = useSwampToadAnimationTextures(fallbackTexture);
  const survivalTimeOverrideSeconds = useGameStore(s => s.survivalTimeOverrideSeconds);
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
    const cycleElapsedSeconds = survivalTimeOverrideSeconds ?? animationElapsedSeconds;
    const cycle = getSurvivalDayNightCycle(cycleElapsedSeconds);
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
      const breathWave = (Math.sin(state.clock.elapsedTime * (sleeping ? 0.82 : 1.12)) + 1) * 0.5;
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
      const drift = (state.clock.elapsedTime * 0.34) % 1;
      const bob = Math.sin(state.clock.elapsedTime * 1.6) * 0.38;
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

function SwampVillageWalkway({ walkway, waterY }: { walkway: SwampVillageWalkway; waterY: number }) {
  const stiltHeight = Math.max(0.4, walkway.y - waterY);
  const supportCount = Math.max(2, Math.min(7, Math.floor(walkway.length / 28)));

  return (
    <group position={[walkway.localX, 0, walkway.localZ]} rotation={[0, walkway.rotation, 0]}>
      <mesh position={[0, walkway.y, 0]} castShadow={false} receiveShadow>
        <boxGeometry args={[walkway.width, 0.82, walkway.length]} />
        <meshBasicMaterial color="#4a301d" />
      </mesh>
      {Array.from({ length: Math.max(4, Math.floor(walkway.length / 9)) }, (_, index) => {
        const z = -walkway.length / 2 + (index + 0.5) * (walkway.length / Math.max(4, Math.floor(walkway.length / 9)));
        return (
          <mesh key={index} position={[0, walkway.y + 0.5, z]} castShadow={false}>
            <boxGeometry args={[walkway.width + 1.1, 0.22, 1.7]} />
            <meshBasicMaterial color={index % 2 === 0 ? "#6a4729" : "#5a3a22"} />
          </mesh>
        );
      })}
      {[-1, 1].map((side) => (
        <mesh key={`rail-${side}`} position={[side * (walkway.width * 0.52), walkway.y + 1.15, 0]} castShadow={false}>
          <boxGeometry args={[0.42, 0.48, walkway.length * 0.96]} />
          <meshBasicMaterial color={SWAMP_DARK_WOOD} />
        </mesh>
      ))}
      {Array.from({ length: Math.max(3, Math.floor(walkway.length / 34)) }, (_, index) => {
        const z = -walkway.length / 2 + 12 + index * (walkway.length / Math.max(3, Math.floor(walkway.length / 34)));
        const x = (index % 2 === 0 ? -1 : 1) * walkway.width * 0.22;
        return (
          <mesh key={`moss-${index}`} position={[x, walkway.y + 0.66, z]} castShadow={false}>
            <boxGeometry args={[walkway.width * 0.28, 0.1, 5.5]} />
            <meshBasicMaterial color={SWAMP_MOSS_COLORS[index % SWAMP_MOSS_COLORS.length]} transparent opacity={0.88} />
          </mesh>
        );
      })}
      {Array.from({ length: supportCount }, (_, index) => {
        const z = -walkway.length / 2 + (index + 0.5) * (walkway.length / supportCount);
        return [-1, 1].map((side) => (
          <mesh key={`${index}-${side}`} position={[side * (walkway.width * 0.42), waterY + stiltHeight / 2, z]} castShadow={false}>
            <cylinderGeometry args={[0.42, 0.54, stiltHeight, 6]} />
            <meshBasicMaterial color="#2d1c10" />
          </mesh>
        ));
      })}
    </group>
  );
}

function SwampVillageRamp({ ramp }: { ramp: SwampVillageRamp }) {
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
        {Array.from({ length: plankCount }, (_, index) => {
          const z = -ramp.length / 2 + (index + 0.5) * (ramp.length / plankCount);
          return (
            <mesh key={index} position={[0, 0.48, z]} castShadow={false}>
              <boxGeometry args={[ramp.width + 1.4, 0.18, 1.75]} />
              <meshBasicMaterial color={index % 2 === 0 ? "#6a4729" : "#5a3a22"} />
            </mesh>
          );
        })}
        {[-1, 1].map((side) => (
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
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([xSign, zSign]) => (
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
      {[-1, 1].map((side) => (
        <mesh key={`side-window-${side}`} position={[side * (hut.width / 2 + 0.18), hut.platformY + Math.min(hut.height - 2.1, 6.2), -hut.depth * 0.12]} castShadow={false}>
          <boxGeometry args={[0.36, 2.3, 3.25]} />
          <meshBasicMaterial color="#6cb69d" />
        </mesh>
      ))}
      {Array.from({ length: Math.max(3, Math.floor(hut.width / 4)) }, (_, index) => {
        const count = Math.max(3, Math.floor(hut.width / 4));
        const x = -hut.width / 2 + (index + 0.5) * (hut.width / count);
        return (
          <mesh key={`front-plank-${index}`} position={[x, hut.platformY + hut.height * 0.52, hut.depth / 2 + 0.24]} castShadow={false}>
            <boxGeometry args={[0.18, hut.height * 0.76, 0.22]} />
            <meshBasicMaterial color={SWAMP_DARK_WOOD} transparent opacity={0.5} />
          </mesh>
        );
      })}
      {[-1, 1].map((side) => (
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
      {Array.from({ length: 6 }, (_, index) => {
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
  if (chunk.distance !== 0) return null;

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

function SurvivalSwampVillage({ chunk }: { chunk: SurvivalChunkInfo }) {
  const villageBaseHeight = useMemo(() => getSurvivalVillageBaseHeight(chunk), [chunk]);
  const villagePadGeometry = useMemo(() => makeSurvivalVillagePadGeometry(chunk), [chunk]);
  const villagePadCollisionGeometry = useMemo(() => makeSurvivalVillagePadGeometry(chunk), [chunk]);
  const layout = useMemo(() => makeSwampVillageLayout(chunk, villageBaseHeight), [chunk, villageBaseHeight]);
  const terrainDetailTexture = useMemo(() => getSurvivalTerrainDetailTexture(), []);

  return (
    <>
      <SwampVillageColliders chunk={chunk} layout={layout} groundGeometry={villagePadCollisionGeometry} />
      <group name={`survival-swamp-village-${chunk.key}`} position={[chunk.x, 0, chunk.z]}>
        <mesh geometry={villagePadGeometry} dispose={null} receiveShadow>
          <meshStandardMaterial vertexColors map={terrainDetailTexture} color="#35492e" roughness={1} />
        </mesh>
        <SwampVillageWater layout={layout} showDetails={chunk.distance === 0} />
        <mesh position={[0, layout.platformY, 0]} castShadow={false} receiveShadow>
          <boxGeometry args={[SWAMP_VILLAGE_PLATFORM_SIZE, 1.1, SWAMP_VILLAGE_PLATFORM_SIZE]} />
          <meshBasicMaterial color="#3d2818" />
        </mesh>
        <mesh position={[0, layout.platformY + 0.7, 0]} castShadow={false}>
          <boxGeometry args={[SWAMP_VILLAGE_PLATFORM_SIZE + 4.8, 0.32, SWAMP_VILLAGE_PLATFORM_SIZE + 4.8]} />
          <meshBasicMaterial color="#6a4729" />
        </mesh>
        {chunk.distance === 0 && Array.from({ length: 9 }, (_, index) => (
          <mesh key={`swamp-platform-plank-${index}`} position={[0, layout.platformY + 0.9, -SWAMP_VILLAGE_PLATFORM_SIZE / 2 + (index + 0.5) * (SWAMP_VILLAGE_PLATFORM_SIZE / 9)]} castShadow={false}>
            <boxGeometry args={[SWAMP_VILLAGE_PLATFORM_SIZE + 5.8, 0.14, 1.1]} />
            <meshBasicMaterial color={index % 2 === 0 ? "#7b5730" : "#4e331d"} transparent opacity={0.86} />
          </mesh>
        ))}
        {chunk.distance === 0 && Array.from({ length: 8 }, (_, index) => {
          const angle = (index * Math.PI * 2) / 8;
          return (
            <mesh key={`swamp-platform-moss-${index}`} position={[Math.sin(angle) * 24, layout.platformY + 1.02, Math.cos(angle) * 24]} rotation={[0, angle, 0]} castShadow={false}>
              <boxGeometry args={[8.5, 0.12, 3.4]} />
              <meshBasicMaterial color={SWAMP_MOSS_COLORS[index % SWAMP_MOSS_COLORS.length]} transparent opacity={0.74} />
            </mesh>
          );
        })}
        <SwampGiantToad layout={layout} />
        {layout.walkways.map((walkway) => (
          <SwampVillageWalkway key={walkway.key} walkway={walkway} waterY={layout.waterY} />
        ))}
        {layout.ramps.map((ramp) => (
          <SwampVillageRamp key={ramp.key} ramp={ramp} />
        ))}
        {layout.huts.map((hut) => (
          <SwampStiltHut key={hut.key} hut={hut} waterY={layout.waterY} showDetails={chunk.distance === 0} />
        ))}
        <SwampVillageRopeLights layout={layout} showDetails={chunk.distance === 0} />
      </group>
      {chunk.distance === 0 && (
        <Villagers
          key={`survival-swamp-villagers-${chunk.key}`}
          huts={layout.hutInfos}
          name={`survival-swamp-villagers-${chunk.key}`}
        />
      )}
    </>
  );
}

const MOUNTAIN_VILLAGE_RADIUS = SURVIVAL_BLOCK_SIZE * 0.49;
const MOUNTAIN_VILLAGE_EDGE_BLEND_START = SURVIVAL_BLOCK_SIZE * 0.43;
const MOUNTAIN_VILLAGE_HEIGHT = 214;
const MOUNTAIN_VILLAGE_PLATEAU_RADIUS = 92;
const MOUNTAIN_VILLAGE_TRAIL_TURNS = 0.72;
const MOUNTAIN_VILLAGE_TRAIL_START_RADIUS = SURVIVAL_BLOCK_SIZE * 0.405;
const MOUNTAIN_VILLAGE_TRAIL_END_RADIUS = 64;
const MOUNTAIN_VILLAGE_TRAIL_HEIGHT_OFFSET = 9.2;
const MOUNTAIN_VILLAGE_SUMMIT_COLLIDER_RADIUS = MOUNTAIN_VILLAGE_PLATEAU_RADIUS + 20;

type MountainVillageTrailSupport = {
  key: string;
  localX: number;
  localZ: number;
  topY: number;
  height: number;
  yaw: number;
  side: -1 | 1;
};

type MountainVillageTrailSegment = {
  key: string;
  localX: number;
  localZ: number;
  y: number;
  yaw: number;
  slope: number;
  width: number;
  length: number;
  index: number;
  supports: MountainVillageTrailSupport[];
};

type MountainVillageCabin = {
  key: string;
  localX: number;
  localZ: number;
  rotation: number;
  width: number;
  depth: number;
  height: number;
  bodyColor: string;
  roofColor: string;
  accentColor: string;
};

type MountainVillageWaterfall = {
  angle: number;
  topX: number;
  topZ: number;
  topY: number;
  bottomX: number;
  bottomZ: number;
  bottomY: number;
  width: number;
};

type MountainVillageLayout = {
  baseHeight: number;
  summitY: number;
  trailSegments: MountainVillageTrailSegment[];
  cabins: MountainVillageCabin[];
  hutInfos: HutInfo[];
  waterfall: MountainVillageWaterfall;
};

function getMountainVillageRadialLift(radius: number) {
  if (radius <= MOUNTAIN_VILLAGE_PLATEAU_RADIUS) return MOUNTAIN_VILLAGE_HEIGHT;

  const raw = 1 - (radius - MOUNTAIN_VILLAGE_PLATEAU_RADIUS) / (MOUNTAIN_VILLAGE_RADIUS - MOUNTAIN_VILLAGE_PLATEAU_RADIUS);
  const shoulder = Math.pow(smoothstep01(raw), 1.12);
  const terraced = Math.floor(shoulder * 9) / 9;
  return lerpNumber(shoulder, terraced, 0.16) * MOUNTAIN_VILLAGE_HEIGHT;
}

function getMountainVillageHeight(chunk: SurvivalChunkInfo, localX: number, localZ: number, baseHeight = getSurvivalVillageBaseHeight(chunk)) {
  const naturalHeight = getSurvivalTerrainHeightForChunk(chunk, localX, localZ);
  const radius = Math.hypot(localX, localZ);
  const angle = Math.atan2(localX, localZ);
  const lift = getMountainVillageRadialLift(radius);
  const ridgeNoise = (
    Math.sin(angle * 9 + radius * 0.053 + chunk.cx * 1.7) +
    Math.cos(angle * 5 - radius * 0.037 + chunk.cz * 1.3)
  ) * 2.6;
  const cliffBands = Math.max(0, Math.sin(radius * 0.19 + angle * 4.2)) * 2.1;
  const roughness = (1 - smoothstepRange(72, MOUNTAIN_VILLAGE_RADIUS, radius)) * (ridgeNoise + cliffBands);
  const plateauNoise = radius < MOUNTAIN_VILLAGE_PLATEAU_RADIUS
    ? Math.sin(localX * 0.06 + chunk.cx) * 0.55 + Math.cos(localZ * 0.052 - chunk.cz) * 0.45
    : 0;
  const mountainHeight = baseHeight + lift + roughness + plateauNoise;
  const edgeBlend = smoothstepRange(MOUNTAIN_VILLAGE_EDGE_BLEND_START, SURVIVAL_BLOCK_SIZE / 2, radius);

  return lerpNumber(mountainHeight, naturalHeight, edgeBlend);
}

function getMountainVillageTrailAngleOffset(chunk: SurvivalChunkInfo) {
  return -0.48 + (survivalHash01(chunk.cx, chunk.cz, 4420) - 0.5) * 0.14;
}

function getMountainVillageTrailSurfaceMask(chunk: SurvivalChunkInfo, localX: number, localZ: number) {
  const radius = Math.hypot(localX, localZ);
  const radialProgress = clamp01((MOUNTAIN_VILLAGE_TRAIL_START_RADIUS - radius) / (MOUNTAIN_VILLAGE_TRAIL_START_RADIUS - MOUNTAIN_VILLAGE_TRAIL_END_RADIUS));
  if (radialProgress <= 0 || radialProgress >= 1) return 0;

  const trailT = Math.pow(radialProgress, 1 / 0.86);
  const angleOffset = getMountainVillageTrailAngleOffset(chunk);
  const trailAngle = angleOffset + Math.pow(trailT, 1.28) * MOUNTAIN_VILLAGE_TRAIL_TURNS * Math.PI * 2;
  const pointAngle = Math.atan2(localX, localZ);
  const arcDistance = Math.abs(Math.atan2(Math.sin(pointAngle - trailAngle), Math.cos(pointAngle - trailAngle))) * radius;
  const widthMask = 1 - smoothstepRange(10, 25, arcDistance);
  const endFade = smoothstepRange(0.02, 0.1, radialProgress) * (1 - smoothstepRange(0.9, 0.99, radialProgress));

  return clamp01(widthMask * endFade);
}

function getMountainVillageTerrainColor(chunk: SurvivalChunkInfo, localX: number, localZ: number, height: number, baseHeight: number) {
  const worldX = chunk.x + localX;
  const worldZ = chunk.z + localZ;
  const radius = Math.hypot(localX, localZ);
  const lift = height - baseHeight;
  const naturalColor = getSurvivalTerrainColor(worldX, worldZ, getSurvivalTerrainHeightForChunk(chunk, localX, localZ));
  const stone = new THREE.Color("#5f6668");
  const darkStone = new THREE.Color("#34393b");
  const summitStone = new THREE.Color("#8d9aa0");
  const snow = new THREE.Color("#eef8ff");
  const ice = new THREE.Color("#a7d8ef");
  const moss = new THREE.Color("#3d6344");
  const trailDirt = new THREE.Color("#7a5a37");
  const trailStone = new THREE.Color("#4a3828");
  const snowMix = smoothstepRange(MOUNTAIN_VILLAGE_HEIGHT * 0.66, MOUNTAIN_VILLAGE_HEIGHT * 0.94, lift);
  const cliffMix = smoothstepRange(20, 130, lift);
  const plateauMix = 1 - smoothstepRange(MOUNTAIN_VILLAGE_PLATEAU_RADIUS - 8, MOUNTAIN_VILLAGE_PLATEAU_RADIUS + 18, radius);
  const edgeBlend = smoothstepRange(MOUNTAIN_VILLAGE_EDGE_BLEND_START, SURVIVAL_BLOCK_SIZE / 2, radius);
  const trailMask = getMountainVillageTrailSurfaceMask(chunk, localX, localZ);
  const vein = Math.max(0, Math.sin(radius * 0.21 + localX * 0.018 - localZ * 0.024));

  const trailColor = trailDirt
    .clone()
    .lerp(trailStone, cliffMix * 0.34)
    .lerp(snow, snowMix * 0.24);
  const color = naturalColor
    .clone()
    .lerp(moss, 0.18 * (1 - cliffMix))
    .lerp(stone, cliffMix * 0.78)
    .lerp(darkStone, vein * cliffMix * 0.18)
    .lerp(summitStone, plateauMix * 0.42)
    .lerp(snow, snowMix * 0.82)
    .lerp(ice, snowMix * vein * 0.18)
    .lerp(trailColor, trailMask * 0.78);

  return color.lerp(naturalColor, edgeBlend * (1 - trailMask * 0.7));
}

function makeMountainVillageTerrainGeometry(chunk: SurvivalChunkInfo) {
  const segments = chunk.lod === "near" ? 54 : 30;
  const baseHeight = getSurvivalVillageBaseHeight(chunk);
  const geo = new THREE.PlaneGeometry(SURVIVAL_BLOCK_SIZE, SURVIVAL_BLOCK_SIZE, segments, segments);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors: number[] = [];

  for (let i = 0; i < pos.count; i += 1) {
    const localX = pos.getX(i);
    const localZ = pos.getZ(i);
    const height = getMountainVillageHeight(chunk, localX, localZ, baseHeight);
    const color = getMountainVillageTerrainColor(chunk, localX, localZ, height, baseHeight);
    pos.setY(i, height);
    colors.push(color.r, color.g, color.b);
  }

  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}

function getMountainVillageTrailPoint(chunk: SurvivalChunkInfo, baseHeight: number, t: number) {
  const eased = Math.pow(smoothstep01(t), 0.86);
  const radius = lerpNumber(MOUNTAIN_VILLAGE_TRAIL_START_RADIUS, MOUNTAIN_VILLAGE_TRAIL_END_RADIUS, eased);
  const angleOffset = getMountainVillageTrailAngleOffset(chunk);
  const angle = angleOffset + Math.pow(t, 1.28) * MOUNTAIN_VILLAGE_TRAIL_TURNS * Math.PI * 2;
  const localX = Math.sin(angle) * radius;
  const localZ = Math.cos(angle) * radius;
  const stiltLift = smoothstepRange(0.02, 0.18, t) * (1 - smoothstepRange(0.86, 0.98, t));
  const lift = lerpNumber(2.3, MOUNTAIN_VILLAGE_TRAIL_HEIGHT_OFFSET, stiltLift) + Math.sin(t * Math.PI) * 1.35;
  const y = getMountainVillageHeight(chunk, localX, localZ, baseHeight) + lift;

  return { localX, localZ, y };
}

function makeMountainVillageTrailSegments(chunk: SurvivalChunkInfo, baseHeight: number): MountainVillageTrailSegment[] {
  const segmentCount = chunk.lod === "near" ? 38 : 24;
  const points = Array.from({ length: segmentCount + 1 }, (_, index) => (
    getMountainVillageTrailPoint(chunk, baseHeight, index / segmentCount)
  ));

  return points.slice(0, -1).map((point, index) => {
    const next = points[index + 1];
    const dx = next.localX - point.localX;
    const dz = next.localZ - point.localZ;
    const dy = next.y - point.y;
    const horizontalLength = Math.max(0.1, Math.hypot(dx, dz));
    const midpoint = {
      localX: (point.localX + next.localX) / 2,
      localZ: (point.localZ + next.localZ) / 2,
      y: (point.y + next.y) / 2,
    };
    const progress = index / segmentCount;
    const yaw = Math.atan2(dx, dz);
    const width = lerpNumber(21.5, 14.25, progress);
    const rightX = Math.cos(yaw);
    const rightZ = -Math.sin(yaw);
    const supportOffset = width / 2 - 1.12;
    const supports: MountainVillageTrailSupport[] = [-1, 1].map((side) => {
      const localX = midpoint.localX + rightX * supportOffset * side;
      const localZ = midpoint.localZ + rightZ * supportOffset * side;
      const topY = midpoint.y - 0.62;
      const groundY = getMountainVillageHeight(chunk, localX, localZ, baseHeight) + 0.36;
      const height = Math.max(3.25, topY - groundY);

      return {
        key: `${chunk.key}-mountain-trail-support-${index}-${side}`,
        localX,
        localZ,
        topY,
        height,
        yaw,
        side: side as -1 | 1,
      };
    });

    return {
      key: `${chunk.key}-mountain-trail-${index}`,
      ...midpoint,
      yaw,
      slope: Math.atan2(dy, horizontalLength),
      width,
      length: horizontalLength * 1.66,
      index,
      supports,
    };
  });
}

function makeMountainVillageLayout(chunk: SurvivalChunkInfo, baseHeight: number): MountainVillageLayout {
  const summitY = getMountainVillageHeight(chunk, 0, 0, baseHeight) + 0.18;
  const cabinCount = chunk.lod === "near" ? 8 : 5;
  const bodyColors = ["#584633", "#64513d", "#4f4538", "#6b573f"];
  const roofColors = ["#dceefa", "#cfe4f3", "#edf7ff", "#b9d3e8"];
  const accentColors = ["#82d8ff", "#f5d28a", "#bce7ff", "#d6f4ff"];
  const cabins: MountainVillageCabin[] = Array.from({ length: cabinCount }, (_, index) => {
    const angle = (Math.PI * 2 * index) / cabinCount + 0.28 + survivalHash01(chunk.cx, chunk.cz, 4480) * 0.2;
    const ring = 59 + (index % 2) * 12 + survivalHash01(chunk.cx, chunk.cz, 4510 + index) * 7;
    const width = 17 + survivalHash01(chunk.cx, chunk.cz, 4540 + index) * 7;
    const depth = 15 + survivalHash01(chunk.cx, chunk.cz, 4570 + index) * 6;
    const height = 9 + survivalHash01(chunk.cx, chunk.cz, 4600 + index) * 4;

    return {
      key: `${chunk.key}-mountain-cabin-${index}`,
      localX: Math.sin(angle) * ring,
      localZ: Math.cos(angle) * ring,
      rotation: angle + Math.PI,
      width,
      depth,
      height,
      bodyColor: bodyColors[index % bodyColors.length],
      roofColor: roofColors[(index + Math.floor(survivalHash01(chunk.cx, chunk.cz, 4610) * roofColors.length)) % roofColors.length],
      accentColor: accentColors[index % accentColors.length],
    };
  });
  const hutInfos: HutInfo[] = cabins.map((cabin, index) => ({
    id: `${chunk.key}-mountain-hut-${index}`,
    x: chunk.x + cabin.localX,
    y: summitY,
    z: chunk.z + cabin.localZ,
    hutType: 2,
    colorIndex: index % 4,
    rotation: cabin.rotation,
    hasPath: true,
    pathRot: cabin.rotation,
    isMushroom: false,
    interiorWidth: cabin.width,
    interiorDepth: cabin.depth,
    interiorHeight: cabin.height,
    villagerBackOffset: -Math.max(cabin.depth * 0.42, 7.5),
    villagerSideOffset: (index % 2 === 0 ? -1 : 1) * 1.25,
    villagerYOffset: 0.95,
    villagerTheme: "village",
  }));
  const waterfallAngle = -Math.PI * 0.28 + survivalHash01(chunk.cx, chunk.cz, 4700) * 0.52;
  const topRadius = 112;
  const bottomRadius = MOUNTAIN_VILLAGE_TRAIL_START_RADIUS + 8;
  const topX = Math.sin(waterfallAngle) * topRadius;
  const topZ = Math.cos(waterfallAngle) * topRadius;
  const bottomX = Math.sin(waterfallAngle) * bottomRadius;
  const bottomZ = Math.cos(waterfallAngle) * bottomRadius;
  const waterfall: MountainVillageWaterfall = {
    angle: waterfallAngle,
    topX,
    topZ,
    topY: getMountainVillageHeight(chunk, topX, topZ, baseHeight) + 4.8,
    bottomX,
    bottomZ,
    bottomY: getMountainVillageHeight(chunk, bottomX, bottomZ, baseHeight) + 1.25,
    width: 12 + survivalHash01(chunk.cx, chunk.cz, 4730) * 7,
  };

  return {
    baseHeight,
    summitY,
    trailSegments: makeMountainVillageTrailSegments(chunk, baseHeight),
    cabins,
    hutInfos,
    waterfall,
  };
}

function MountainVillageTrail({ segments, showDetails }: { segments: MountainVillageTrailSegment[]; showDetails: boolean }) {
  return (
    <group name="mountain-village-wrapping-trail">
      {segments.map((segment) => {
        const hasLanding = showDetails && (segment.index === 0 || segment.index === segments.length - 1);
        const landingLength = Math.min(22, segment.length * 0.72);
        const landingZ = segment.index === 0 ? -segment.length * 0.28 : segment.length * 0.28;

        return (
          <group key={segment.key} position={[segment.localX, segment.y, segment.localZ]} rotation={[segment.slope, segment.yaw, 0]}>
            <mesh position={[0, -0.72, 0]} castShadow={false}>
              <boxGeometry args={[segment.width * 1.08, 0.22, segment.length * 1.08]} />
              <meshBasicMaterial color="#24170f" transparent opacity={0.72} />
            </mesh>
            <mesh position={[0, -0.18, 0]} castShadow={false} receiveShadow>
              <boxGeometry args={[segment.width, 0.82, segment.length]} />
              <meshBasicMaterial color={segment.index % 2 === 0 ? "#5c432d" : "#4f3927"} />
            </mesh>
            <mesh position={[0, 0.32, 0]} castShadow={false}>
              <boxGeometry args={[segment.width * 0.86, 0.18, segment.length * 0.96]} />
              <meshBasicMaterial color="#a88659" />
            </mesh>
            {hasLanding && (
              <mesh position={[0, 0.62, landingZ]} castShadow={false} receiveShadow>
                <boxGeometry args={[segment.width * 1.32, 0.36, landingLength]} />
                <meshBasicMaterial color={segment.index === 0 ? "#8b673e" : "#b08c5c"} />
              </mesh>
            )}
            {hasLanding && (
              <>
                {[-1, 1].map((side) => (
                  <Fragment key={`${segment.key}-landing-posts-${side}`}>
                    <mesh position={[side * (segment.width * 0.56), 3.02, landingZ - landingLength * 0.34]} castShadow={false}>
                      <boxGeometry args={[1.25, 5.25, 1.25]} />
                      <meshBasicMaterial color="#2b1e14" />
                    </mesh>
                    <mesh position={[side * (segment.width * 0.56), 3.02, landingZ + landingLength * 0.34]} castShadow={false}>
                      <boxGeometry args={[1.25, 5.25, 1.25]} />
                      <meshBasicMaterial color="#2b1e14" />
                    </mesh>
                  </Fragment>
                ))}
                <mesh position={[0, 5.62, landingZ - landingLength * 0.34]} castShadow={false}>
                  <boxGeometry args={[segment.width * 1.24, 0.82, 1.18]} />
                  <meshBasicMaterial color="#4a3220" />
                </mesh>
              </>
            )}
            <mesh position={[-segment.width / 2 + 0.88, 0.56, 0]} castShadow={false}>
              <boxGeometry args={[1.72, 0.92, segment.length * 1.06]} />
              <meshBasicMaterial color="#2f2117" />
            </mesh>
            <mesh position={[segment.width / 2 - 0.88, 0.56, 0]} castShadow={false}>
              <boxGeometry args={[1.72, 0.92, segment.length * 1.06]} />
              <meshBasicMaterial color="#2f2117" />
            </mesh>
            {showDetails && Array.from({ length: 4 }, (_, plankIndex) => {
              const plankZ = (plankIndex - 1.5) * segment.length * 0.21;
              return (
                <mesh key={`${segment.key}-plank-${plankIndex}`} position={[0, 0.57, plankZ]} castShadow={false}>
                  <boxGeometry args={[segment.width * 0.78, 0.18, Math.min(2.65, segment.length * 0.13)]} />
                  <meshBasicMaterial color={plankIndex % 2 === 0 ? "#b5905e" : "#8f704b"} />
                </mesh>
              );
            })}
            {showDetails && (
              <>
                {[-1, 1].map((side) => (
                  <Fragment key={`${segment.key}-rail-${side}`}>
                    <mesh position={[side * (segment.width / 2 - 1.18), 1.66, -segment.length * 0.34]} castShadow={false}>
                      <boxGeometry args={[0.86, 3.32, 0.86]} />
                      <meshBasicMaterial color="#2b1e14" />
                    </mesh>
                    <mesh position={[side * (segment.width / 2 - 1.18), 1.66, segment.length * 0.34]} castShadow={false}>
                      <boxGeometry args={[0.86, 3.32, 0.86]} />
                      <meshBasicMaterial color="#2b1e14" />
                    </mesh>
                    <mesh position={[side * (segment.width / 2 - 1.18), 2.94, 0]} castShadow={false}>
                      <boxGeometry args={[0.68, 0.46, segment.length * 0.92]} />
                      <meshBasicMaterial color="#4a3220" />
                    </mesh>
                    <mesh position={[side * (segment.width / 2 - 1.22), 1.72, 0]} rotation={[0.2 * side, 0, 0]} castShadow={false}>
                      <boxGeometry args={[0.42, 0.34, segment.length * 0.82]} />
                      <meshBasicMaterial color="#6a492e" />
                    </mesh>
                  </Fragment>
                ))}
                <mesh position={[0, -1.02, -segment.length * 0.34]} castShadow={false}>
                  <boxGeometry args={[segment.width + 2.4, 0.58, 1.12]} />
                  <meshBasicMaterial color="#3a2719" />
                </mesh>
                <mesh position={[0, -1.02, segment.length * 0.34]} castShadow={false}>
                  <boxGeometry args={[segment.width + 2.4, 0.58, 1.12]} />
                  <meshBasicMaterial color="#3a2719" />
                </mesh>
                <mesh position={[0, -1.3, 0]} rotation={[0, 0, 0.24]} castShadow={false}>
                  <boxGeometry args={[segment.width * 0.72, 0.42, 0.72]} />
                  <meshBasicMaterial color="#5b4029" />
                </mesh>
                <mesh position={[0, -1.3, 0]} rotation={[0, 0, -0.24]} castShadow={false}>
                  <boxGeometry args={[segment.width * 0.72, 0.42, 0.72]} />
                  <meshBasicMaterial color="#5b4029" />
                </mesh>
              </>
            )}
          </group>
        );
      })}
      {showDetails && segments.flatMap((segment) => segment.supports).map((support) => (
        <group key={support.key} position={[support.localX, support.topY - support.height / 2, support.localZ]} rotation={[0, support.yaw, 0]}>
          <mesh castShadow={false}>
            <boxGeometry args={[2.15, support.height, 2.15]} />
            <meshBasicMaterial color="#2f2117" />
          </mesh>
          <mesh position={[0, -support.height / 2 - 0.08, 0]} castShadow={false}>
            <boxGeometry args={[5.6, 0.62, 5.6]} />
            <meshBasicMaterial color="#4b3524" />
          </mesh>
          {support.height > 4.2 && (
            <>
              <mesh position={[support.side * 0.98, 0, 0]} rotation={[0, 0, -support.side * 0.24]} castShadow={false}>
                <boxGeometry args={[0.9, support.height * 1.06, 0.9]} />
                <meshBasicMaterial color="#3f2d1f" />
              </mesh>
              <mesh position={[-support.side * 0.9, 0, 0]} rotation={[0, 0, support.side * 0.18]} castShadow={false}>
                <boxGeometry args={[0.72, support.height * 0.86, 0.72]} />
                <meshBasicMaterial color="#5b4029" />
              </mesh>
            </>
          )}
        </group>
      ))}
    </group>
  );
}

function MountainCabin({ cabin, summitY, showDetails }: { cabin: MountainVillageCabin; summitY: number; showDetails: boolean }) {
  return (
    <group position={[cabin.localX, summitY, cabin.localZ]} rotation={[0, cabin.rotation, 0]}>
      <mesh position={[0, cabin.height / 2, 0]} castShadow={false} receiveShadow>
        <boxGeometry args={[cabin.width, cabin.height, cabin.depth]} />
        <meshBasicMaterial color={cabin.bodyColor} />
      </mesh>
      <mesh position={[0, cabin.height + 4.2, 0]} rotation={[0, Math.PI / 4, 0]} castShadow={false} receiveShadow>
        <coneGeometry args={[Math.max(cabin.width, cabin.depth) * 0.78, 9.2, 4]} />
        <meshBasicMaterial color={cabin.roofColor} />
      </mesh>
      <mesh position={[0, cabin.height + 8.9, 0]} rotation={[0, Math.PI / 4, 0]} castShadow={false}>
        <coneGeometry args={[Math.max(cabin.width, cabin.depth) * 0.34, 3.4, 4]} />
        <meshBasicMaterial color="#f8fdff" />
      </mesh>
      <mesh position={[0, 3.1, cabin.depth / 2 + 0.12]} castShadow={false}>
        <boxGeometry args={[4.8, 6.2, 0.45]} />
        <meshBasicMaterial color="#251a12" />
      </mesh>
      {showDetails && (
        <>
          <mesh position={[-cabin.width * 0.27, 5.9, cabin.depth / 2 + 0.16]} castShadow={false}>
            <boxGeometry args={[3.4, 2.8, 0.36]} />
            <meshBasicMaterial color={cabin.accentColor} transparent opacity={0.88} />
          </mesh>
          <mesh position={[cabin.width * 0.27, 5.9, cabin.depth / 2 + 0.16]} castShadow={false}>
            <boxGeometry args={[3.4, 2.8, 0.36]} />
            <meshBasicMaterial color={cabin.accentColor} transparent opacity={0.88} />
          </mesh>
          <mesh position={[0, cabin.height + 2.4, cabin.depth * 0.18]} castShadow={false}>
            <boxGeometry args={[2.2, 5.4, 2.2]} />
            <meshBasicMaterial color="#3b2b1d" />
          </mesh>
          <mesh position={[0, cabin.height + 5.4, cabin.depth * 0.18]} castShadow={false}>
            <boxGeometry args={[3.2, 1.2, 3.2]} />
            <meshBasicMaterial color="#d8edf8" />
          </mesh>
        </>
      )}
    </group>
  );
}

function MountainMineshaftOpening({ summitY, showDetails }: { summitY: number; showDetails: boolean }) {
  return (
    <group name="mountain-village-mineshaft">
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, summitY + 0.34, 0]} renderOrder={4}>
        <circleGeometry args={[28, 32]} />
        <meshBasicMaterial color="#050505" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, summitY + 0.42, 0]} renderOrder={5}>
        <ringGeometry args={[28, 37, 32]} />
        <meshBasicMaterial color="#3a281a" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, summitY + 0.5, 0]} renderOrder={6}>
        <ringGeometry args={[37, 43, 32]} />
        <meshBasicMaterial color="#7a6750" />
      </mesh>
      {Array.from({ length: 8 }, (_, index) => {
        const angle = (Math.PI * 2 * index) / 8;
        const x = Math.sin(angle) * 35;
        const z = Math.cos(angle) * 35;
        return (
          <mesh key={`mine-rim-beam-${index}`} position={[x, summitY + 1.15, z]} rotation={[0, angle, 0]} castShadow={false}>
            <boxGeometry args={[4.2, 1.2, 14]} />
            <meshBasicMaterial color={index % 2 === 0 ? "#4b3421" : "#5e442d"} />
          </mesh>
        );
      })}
      {showDetails && Array.from({ length: 4 }, (_, index) => {
        const angle = index * Math.PI / 2 + Math.PI / 4;
        return (
          <group key={`mine-support-${index}`} rotation={[0, angle, 0]}>
            <mesh position={[-12, summitY + 8.2, 29]} rotation={[0, 0, -0.12]} castShadow={false}>
              <boxGeometry args={[2.3, 15.5, 2.3]} />
              <meshBasicMaterial color="#392719" />
            </mesh>
            <mesh position={[12, summitY + 8.2, 29]} rotation={[0, 0, 0.12]} castShadow={false}>
              <boxGeometry args={[2.3, 15.5, 2.3]} />
              <meshBasicMaterial color="#392719" />
            </mesh>
            <mesh position={[0, summitY + 16.2, 29]} castShadow={false}>
              <boxGeometry args={[27.5, 2.4, 2.6]} />
              <meshBasicMaterial color="#513821" />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function MountainWaterfall({ waterfall, summitY }: { waterfall: MountainVillageWaterfall; summitY: number }) {
  const midX = (waterfall.topX + waterfall.bottomX) / 2;
  const midZ = (waterfall.topZ + waterfall.bottomZ) / 2;
  const height = Math.max(18, waterfall.topY - waterfall.bottomY);
  const midY = waterfall.bottomY + height / 2;

  return (
    <group name="mountain-village-waterfall">
      <mesh position={[midX, midY, midZ]} rotation={[0, waterfall.angle, 0]} renderOrder={2}>
        <planeGeometry args={[waterfall.width, height]} />
        <meshBasicMaterial color="#89e9ff" transparent opacity={0.54} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh position={[midX, midY + height * 0.04, midZ]} rotation={[0, waterfall.angle, 0]} renderOrder={3}>
        <planeGeometry args={[waterfall.width * 0.36, height * 0.96]} />
        <meshBasicMaterial color="#effdff" transparent opacity={0.34} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[waterfall.topX * 0.74, summitY + 0.72, waterfall.topZ * 0.74]} scale={[28, 9, 1]} renderOrder={1}>
        <circleGeometry args={[1, 18]} />
        <meshBasicMaterial color="#b9f1ff" transparent opacity={0.58} depthWrite={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[waterfall.bottomX, waterfall.bottomY + 0.16, waterfall.bottomZ]} scale={[35, 24, 1]} renderOrder={1}>
        <circleGeometry args={[1, 24]} />
        <meshBasicMaterial color="#5bbbd4" transparent opacity={0.68} depthWrite={false} />
      </mesh>
      {Array.from({ length: 10 }, (_, index) => {
        const t = index / 9;
        const x = lerpNumber(waterfall.topX, waterfall.bottomX, t);
        const z = lerpNumber(waterfall.topZ, waterfall.bottomZ, t);
        const y = lerpNumber(waterfall.topY, waterfall.bottomY, t);
        return (
          <mesh key={`mountain-fall-spray-${index}`} position={[x, y, z]} scale={[1.8 + (index % 3), 0.7, 1.8 + (index % 2)]} castShadow={false}>
            <sphereGeometry args={[1, 6, 4]} />
            <meshBasicMaterial color="#dffaff" transparent opacity={0.32} depthWrite={false} />
          </mesh>
        );
      })}
    </group>
  );
}

function MountainSnowCap({ summitY }: { summitY: number }) {
  return (
    <group name="mountain-village-snow-cap">
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, summitY + 0.18, 0]} renderOrder={0}>
        <circleGeometry args={[MOUNTAIN_VILLAGE_PLATEAU_RADIUS + 20, 36]} />
        <meshBasicMaterial color="#eaf8ff" transparent opacity={0.68} />
      </mesh>
      {Array.from({ length: 12 }, (_, index) => {
        const angle = (index * Math.PI * 2) / 12;
        const radius = 48 + (index % 3) * 14;
        return (
          <mesh key={`summit-snow-drift-${index}`} rotation={[-Math.PI / 2, 0, angle]} position={[Math.sin(angle) * radius, summitY + 0.31, Math.cos(angle) * radius]} scale={[11 + (index % 4) * 3, 4.5 + (index % 2) * 2, 1]} renderOrder={2}>
            <circleGeometry args={[1, 10]} />
            <meshBasicMaterial color={index % 2 === 0 ? "#f8fdff" : "#cdeafa"} transparent opacity={0.76} />
          </mesh>
        );
      })}
    </group>
  );
}

function MountainVillageColliders({
  chunk,
  terrainGeometry,
  layout,
}: {
  chunk: SurvivalChunkInfo;
  terrainGeometry: THREE.BufferGeometry;
  layout: MountainVillageLayout;
}) {
  if (chunk.distance !== 0) return null;

  return (
    <>
      <RigidBody type="fixed" colliders="trimesh" friction={0.38} restitution={0} position={[chunk.x, 0, chunk.z]}>
        <mesh geometry={terrainGeometry} dispose={null}>
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </RigidBody>
      <RigidBody type="fixed" colliders={false} friction={0.72} restitution={0} position={[chunk.x, 0, chunk.z]}>
        {layout.trailSegments.map((segment) => {
          const hasLanding = segment.index === 0 || segment.index === layout.trailSegments.length - 1;
          const landingLength = Math.min(22, segment.length * 0.72);
          const landingZ = segment.index === 0 ? -segment.length * 0.28 : segment.length * 0.28;

          return (
            <group key={`${segment.key}-collider`} position={[segment.localX, 0, segment.localZ]} rotation={[0, segment.yaw, 0]}>
              <group position={[0, segment.y, 0]} rotation={[segment.slope, 0, 0]}>
                <CuboidCollider
                  args={[segment.width * 0.43, 0.22, segment.length * 0.49]}
                  position={[0, 0.2, 0]}
                />
                {hasLanding && (
                  <CuboidCollider
                    args={[segment.width * 0.66, 0.2, landingLength / 2]}
                    position={[0, 0.62, landingZ]}
                  />
                )}
              </group>
            </group>
          );
        })}
        <CylinderCollider
          args={[0.3, MOUNTAIN_VILLAGE_SUMMIT_COLLIDER_RADIUS]}
          position={[0, layout.summitY + 0.12, 0]}
        />
        {layout.cabins.map((cabin) => (
          <CuboidCollider
            key={`${cabin.key}-collider`}
            args={[cabin.width / 2, cabin.height / 2, cabin.depth / 2]}
            position={[cabin.localX, layout.summitY + cabin.height / 2, cabin.localZ]}
            rotation={[0, cabin.rotation, 0]}
          />
        ))}
      </RigidBody>
    </>
  );
}

function SurvivalMountainVillage({ chunk }: { chunk: SurvivalChunkInfo }) {
  const baseHeight = useMemo(() => getSurvivalVillageBaseHeight(chunk), [chunk]);
  const terrainGeometry = useMemo(() => makeMountainVillageTerrainGeometry(chunk), [chunk]);
  const layout = useMemo(() => makeMountainVillageLayout(chunk, baseHeight), [chunk, baseHeight]);
  const terrainTexture = useMemo(() => getSurvivalTerrainDetailTexture(), []);
  const showDetails = chunk.distance === 0;

  return (
    <>
      <MountainVillageColliders chunk={chunk} terrainGeometry={terrainGeometry} layout={layout} />
      <group name={`survival-mountain-village-${chunk.key}`} position={[chunk.x, 0, chunk.z]}>
        <mesh geometry={terrainGeometry} receiveShadow={showDetails} dispose={null}>
          <meshBasicMaterial map={terrainTexture} vertexColors side={THREE.DoubleSide} />
        </mesh>
        <MountainSnowCap summitY={layout.summitY} />
        <MountainVillageTrail segments={layout.trailSegments} showDetails={showDetails} />
        <MountainWaterfall waterfall={layout.waterfall} summitY={layout.summitY} />
        <MountainMineshaftOpening summitY={layout.summitY} showDetails={showDetails} />
        {layout.cabins.map((cabin) => (
          <MountainCabin key={cabin.key} cabin={cabin} summitY={layout.summitY} showDetails={showDetails} />
        ))}
      </group>
      {showDetails && (
        <Villagers
          key={`survival-mountain-villagers-${chunk.key}`}
          huts={layout.hutInfos}
          name={`survival-mountain-villagers-${chunk.key}`}
        />
      )}
    </>
  );
}

function SurvivalChunk({ chunk }: { chunk: SurvivalChunkInfo }) {
  if (chunk.cx === 0 && chunk.cz === 0) {
    return null;
  }

  if (chunk.hasVillage && chunk.lod !== "far") {
    if (chunk.villageKind === "chicago") {
      return <SurvivalChicagoCity chunk={chunk} />;
    }
    if (chunk.villageKind === "desert") {
      return <SurvivalDesertVillage chunk={chunk} />;
    }
    if (chunk.villageKind === "swamp") {
      return <SurvivalSwampVillage chunk={chunk} />;
    }
    if (chunk.villageKind === "mountain") {
      return <SurvivalMountainVillage chunk={chunk} />;
    }
  }

  return (
    <group name={`survival-chunk-${chunk.key}`}>
      <SurvivalTerrain chunk={chunk} />
      {chunk.lod !== "far" && <SurvivalWaterFeatures chunk={chunk} />}
      {chunk.lod !== "far" && <SurvivalScatterProps chunk={chunk} />}
    </group>
  );
}

function SurvivalProceduralWorld() {
  const [centerChunk, setCenterChunk] = useState({ cx: 0, cz: 0 });

  useEffect(() => {
    const handlePlayerMove = (event: Event) => {
      const detail = (event as CustomEvent<{ x: number; z: number }>).detail;
      if (!detail) return;

      const cx = getSurvivalChunkCoord(detail.x);
      const cz = getSurvivalChunkCoord(detail.z);
      setCenterChunk((current) => (
        current.cx === cx && current.cz === cz ? current : { cx, cz }
      ));
    };

    window.addEventListener("player-moved", handlePlayerMove);
    return () => window.removeEventListener("player-moved", handlePlayerMove);
  }, []);

  const chunks = useMemo(() => makeSurvivalChunks(centerChunk.cx, centerChunk.cz), [centerChunk]);

  return (
    <group name="survival-procedural-world">
      {chunks.map((chunk) => (
        <SurvivalChunk
          key={chunk.key}
          chunk={chunk}
        />
      ))}
    </group>
  );
}

function SurvivalSkyCycle({ mobilePerformanceMode }: { mobilePerformanceMode: boolean }) {
  const { camera, scene } = useThree();
  const isAstralMeditating = useGameStore(s => s.isAstralMeditating);
  const astralMeditationStartedAt = useGameStore(s => s.astralMeditationStartedAt);
  const survivalTimeOverrideSeconds = useGameStore(s => s.survivalTimeOverrideSeconds);
  const sunTexture = useMemo(() => getSurvivalSunTexture(), []);
  const moonTextures = useMemo(() => getSurvivalMoonPhaseTextures(), []);
  const cloudTexture = useMemo(() => getSurvivalCloudTexture(), []);
  const starTexture = useMemo(() => getSurvivalStarTexture(), []);
  const sunRef = useRef<THREE.Sprite>(null);
  const moonRefs = useRef<THREE.Sprite[]>([]);
  const cloudRefs = useRef<THREE.Sprite[]>([]);
  const cloudGroupRef = useRef<THREE.Group>(null);
  const starFieldRef = useRef<THREE.Mesh>(null);
  const starMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const ambientLightRef = useRef<THREE.AmbientLight>(null);
  const hemisphereLightRef = useRef<THREE.HemisphereLight>(null);
  const directionalLightRef = useRef<THREE.DirectionalLight>(null);
  const skyRadius = SURVIVAL_BLOCK_SIZE * (mobilePerformanceMode ? 2.45 : 2.85);
  const vectors = useMemo(() => ({
    sun: new THREE.Vector3(),
    moon: new THREE.Vector3(),
  }), []);
  const colors = useMemo(() => ({
    daySky: new THREE.Color("#bcefff"),
    duskSky: new THREE.Color("#ffc68f"),
    nightSky: new THREE.Color("#172342"),
    astralSky: new THREE.Color("#4a1d78"),
    currentSky: new THREE.Color("#bcefff"),
    sunDay: new THREE.Color("#fff5a8"),
    sunDusk: new THREE.Color("#ff9e4d"),
    moonDay: new THREE.Color("#cbd8ff"),
    moonNight: new THREE.Color("#f1f6ff"),
    cloudDay: new THREE.Color("#ffffff"),
    cloudNight: new THREE.Color("#7e8cb1"),
    cloudAstral: new THREE.Color("#e9d5ff"),
    currentCloud: new THREE.Color("#ffffff"),
  }), []);
  const moonSpecs = useMemo(() => [
    { key: "large", offset: -0.2, zBias: -0.1, lift: 0.02, scale: 94, opacity: 1, phaseOffset: 0 },
    { key: "blue", offset: 0.54, zBias: 0.32, lift: 0.14, scale: 50, opacity: 0.76, phaseOffset: 0.32 },
    { key: "small", offset: -0.76, zBias: -0.42, lift: -0.04, scale: 38, opacity: 0.64, phaseOffset: 0.61 },
  ], []);
  const cloudSpecs = useMemo(() => {
    const count = mobilePerformanceMode ? 8 : 13;
    return Array.from({ length: count }, (_, index) => {
      const hash = survivalHash01(index, count, 240);
      return {
        key: `sky-cloud-${index}`,
        angle: (Math.PI * 2 * index) / count + hash * 0.7,
        radius: skyRadius * (0.64 + survivalHash01(index, count, 260) * 0.26),
        height: 130 + survivalHash01(index, count, 280) * 170,
        width: 120 + survivalHash01(index, count, 300) * 140,
        heightScale: 34 + survivalHash01(index, count, 320) * 42,
        opacity: 0.52 + survivalHash01(index, count, 340) * 0.34,
        drift: (0.006 + survivalHash01(index, count, 360) * 0.009) * (index % 2 === 0 ? 1 : -1),
      };
    });
  }, [mobilePerformanceMode, skyRadius]);

  useEffect(() => {
    const previousBackground = scene.background;
    const previousFog = scene.fog;
    scene.background = colors.currentSky;
    scene.fog = new THREE.Fog(colors.currentSky, SURVIVAL_BLOCK_SIZE * 3.6, SURVIVAL_BLOCK_SIZE * 13.5);

    return () => {
      scene.background = previousBackground;
      scene.fog = previousFog;
    };
  }, [colors, scene]);

  useFrame((state) => {
    const animationElapsedSeconds = state.clock.elapsedTime;
    const cycleElapsedSeconds = survivalTimeOverrideSeconds ?? animationElapsedSeconds;
    const cycle = getSurvivalDayNightCycle(cycleElapsedSeconds);
    const astralStrength = isAstralMeditating
      ? smoothstepRange(0, 1300, Date.now() - astralMeditationStartedAt)
      : 0;
    const duskWarmth = cycle.duskAmount * (cycle.sunHeight > -0.12 ? 0.42 : 0.2);
    colors.currentSky.copy(colors.nightSky).lerp(colors.daySky, cycle.dayAmount).lerp(colors.duskSky, duskWarmth);
    colors.currentSky.lerp(colors.astralSky, astralStrength * 0.72);
    scene.background = colors.currentSky;
    if (scene.fog instanceof THREE.Fog) {
      scene.fog.color.copy(colors.currentSky);
      scene.fog.near = SURVIVAL_BLOCK_SIZE * (3.2 + cycle.dayAmount * 0.8 - astralStrength * 0.7);
      scene.fog.far = SURVIVAL_BLOCK_SIZE * (10.5 + cycle.dayAmount * 4.2 - astralStrength * 2.2);
    }

    vectors.sun.set(
      Math.cos(cycle.sunAngle) * 0.82,
      Math.sin(cycle.sunAngle) * 0.96,
      -0.38,
    ).normalize();

    if (sunRef.current) {
      sunRef.current.position.copy(camera.position).addScaledVector(vectors.sun, skyRadius);
      const sunScale = (mobilePerformanceMode ? 220 : 280) + cycle.duskAmount * 42;
      sunRef.current.scale.set(sunScale, sunScale, 1);
      const material = sunRef.current.material as THREE.SpriteMaterial;
      material.opacity = clamp01(0.02 + cycle.dayAmount * 0.92 + cycle.duskAmount * 0.38);
      material.color.copy(colors.sunDay).lerp(colors.sunDusk, cycle.duskAmount * 0.68);
    }

    if (starFieldRef.current) {
      starFieldRef.current.position.copy(camera.position);
    }
    if (starMaterialRef.current) {
      starMaterialRef.current.opacity = clamp01((cycle.nightAmount * 1.18 + cycle.duskAmount * 0.2) * (1 - astralStrength * 0.18));
    }

    if (directionalLightRef.current) {
      directionalLightRef.current.position.copy(camera.position).addScaledVector(vectors.sun, 320);
      directionalLightRef.current.target.position.copy(camera.position);
      directionalLightRef.current.target.updateMatrixWorld();
      directionalLightRef.current.intensity = mobilePerformanceMode
        ? 1.55 + cycle.dayAmount * 1.05 + cycle.duskAmount * 0.34
        : 0.56 + cycle.dayAmount * 1.46 + cycle.duskAmount * 0.22;
      directionalLightRef.current.color.copy(colors.sunDay).lerp(colors.sunDusk, cycle.duskAmount * 0.55);
      directionalLightRef.current.color.lerp(colors.astralSky, astralStrength * 0.35);
    }

    if (ambientLightRef.current) {
      ambientLightRef.current.intensity = mobilePerformanceMode
        ? 0.86 + cycle.dayAmount * 0.58 + cycle.nightAmount * 0.1
        : 0.34 + cycle.dayAmount * 0.44 + cycle.nightAmount * 0.08;
      ambientLightRef.current.intensity += astralStrength * 0.18;
    }
    if (hemisphereLightRef.current) {
      hemisphereLightRef.current.intensity = mobilePerformanceMode
        ? 0.78 + cycle.dayAmount * 0.52
        : 0.34 + cycle.dayAmount * 0.28;
    }

    moonSpecs.forEach((moon, index) => {
      const sprite = moonRefs.current[index];
      if (!sprite) return;
      const moonAngle = cycle.sunAngle + Math.PI + moon.offset;
      vectors.moon.set(
        Math.cos(moonAngle) * 0.76,
        Math.max(-0.18, Math.sin(moonAngle) * 0.92 + moon.lift),
        -0.34 + moon.zBias,
      ).normalize();
      sprite.position.copy(camera.position).addScaledVector(vectors.moon, skyRadius * 0.92);
      const moonScale = moon.scale * (mobilePerformanceMode ? 0.86 : 1);
      sprite.scale.set(moonScale, moonScale, 1);
      const material = sprite.material as THREE.SpriteMaterial;
      const phaseIndex = Math.floor((((cycleElapsedSeconds / (DAY_NIGHT_CYCLE_SECONDS * 2)) + moon.phaseOffset) % 1) * moonTextures.length) % moonTextures.length;
      if (material.map !== moonTextures[phaseIndex]) {
        material.map = moonTextures[phaseIndex];
        material.needsUpdate = true;
      }
      const phaseDim = phaseIndex === 4 ? 0.42 : phaseIndex === 3 || phaseIndex === 5 ? 0.72 : 1;
      material.opacity = clamp01((0.1 + cycle.nightAmount * 1.05 + cycle.duskAmount * 0.2) * moon.opacity * phaseDim);
      material.color.copy(colors.moonDay).lerp(colors.moonNight, cycle.nightAmount);
    });

    colors.currentCloud.copy(colors.cloudNight).lerp(colors.cloudDay, cycle.dayAmount).lerp(colors.cloudAstral, astralStrength * 0.55);
    if (cloudGroupRef.current) {
      cloudGroupRef.current.position.set(camera.position.x, camera.position.y * 0.08, camera.position.z);
    }
    cloudSpecs.forEach((cloud, index) => {
      const sprite = cloudRefs.current[index];
      if (!sprite) return;
      const driftAngle = cloud.angle + animationElapsedSeconds * cloud.drift;
      sprite.position.set(
        Math.cos(driftAngle) * cloud.radius,
        cloud.height + Math.sin(animationElapsedSeconds * 0.035 + index) * 8,
        Math.sin(driftAngle) * cloud.radius,
      );
      sprite.scale.set(cloud.width, cloud.heightScale, 1);
      const material = sprite.material as THREE.SpriteMaterial;
      material.opacity = clamp01((0.18 + cycle.dayAmount * 0.46 + cycle.duskAmount * 0.08 - cycle.nightAmount * 0.08) * cloud.opacity);
      material.color.copy(colors.currentCloud);
    });
  });

  return (
    <>
      <ambientLight ref={ambientLightRef} intensity={mobilePerformanceMode ? 1.28 : 0.72} />
      <hemisphereLight ref={hemisphereLightRef} args={["#ffffff", "#8a684b", mobilePerformanceMode ? 1.18 : 0.56]} />
      <directionalLight ref={directionalLightRef} position={[50, 20, 50]} intensity={mobilePerformanceMode ? 2.55 : 1.85} />

      <sprite ref={sunRef} name="survival-sky-sun" renderOrder={-7} frustumCulled={false}>
        <spriteMaterial map={sunTexture} transparent opacity={0.96} depthWrite={false} depthTest color="#fff5a8" />
      </sprite>
      <mesh
        ref={starFieldRef}
        name="survival-sky-stars"
        renderOrder={-8}
        frustumCulled={false}
        rotation={[0.16, 0.44, 0]}
      >
        <sphereGeometry args={[SURVIVAL_BLOCK_SIZE * 5.65, 48, 24]} />
        <meshBasicMaterial
          ref={starMaterialRef}
          map={starTexture}
          side={THREE.BackSide}
          transparent
          opacity={0}
          depthWrite={false}
          depthTest
          toneMapped={false}
        />
      </mesh>
      {moonSpecs.map((moon, index) => (
        <sprite
          key={moon.key}
          name={`survival-sky-moon-${moon.key}`}
          ref={(sprite) => {
            if (sprite) moonRefs.current[index] = sprite;
          }}
          renderOrder={-6}
          frustumCulled={false}
        >
          <spriteMaterial map={moonTextures[0]} transparent opacity={0.4} depthWrite={false} depthTest color="#f1f6ff" />
        </sprite>
      ))}
      <group ref={cloudGroupRef} name="survival-sky-clouds" renderOrder={-9} frustumCulled={false}>
        {cloudSpecs.map((cloud, index) => (
          <sprite
            key={cloud.key}
            ref={(sprite) => {
              if (sprite) cloudRefs.current[index] = sprite;
            }}
            position={[
              Math.cos(cloud.angle) * cloud.radius,
              cloud.height,
              Math.sin(cloud.angle) * cloud.radius,
            ]}
            scale={[cloud.width, cloud.heightScale, 1]}
            frustumCulled={false}
          >
            <spriteMaterial map={cloudTexture} transparent opacity={0.42} depthWrite={false} depthTest color="#ffffff" />
          </sprite>
        ))}
      </group>
    </>
  );
}

function AstralRealmVeil() {
  const isAstralMeditating = useGameStore(s => s.isAstralMeditating);
  const astralMeditationStartedAt = useGameStore(s => s.astralMeditationStartedAt);
  const { camera, size } = useThree();
  const veilTexture = useMemo(() => getAstralVeilTexture(), []);
  const veilRef = useRef<THREE.Sprite>(null);
  const blinkRef = useRef<THREE.Sprite>(null);
  const forward = useMemo(() => new THREE.Vector3(), []);
  const distance = 1.15;

  useFrame((state) => {
    const sinceStart = isAstralMeditating ? Date.now() - astralMeditationStartedAt : 0;
    const strength = isAstralMeditating ? smoothstepRange(150, 1350, sinceStart) : 0;
    const blink = isAstralMeditating ? 1 - smoothstepRange(220, 1150, sinceStart) : 0;
    const perspective = camera as THREE.PerspectiveCamera;
    const vertical = perspective.isPerspectiveCamera
      ? 2 * Math.tan(THREE.MathUtils.degToRad(perspective.fov) * 0.5) * distance
      : 2.2;
    const horizontal = vertical * (size.width / Math.max(1, size.height));

    camera.getWorldDirection(forward);
    const overlayPosition = camera.position.clone().addScaledVector(forward, distance);

    if (veilRef.current) {
      veilRef.current.position.copy(overlayPosition);
      veilRef.current.scale.set(horizontal * 1.38, vertical * 1.42, 1);
      veilRef.current.material.rotation = state.clock.elapsedTime * 0.025;
      veilRef.current.material.opacity = strength * (0.28 + Math.sin(state.clock.elapsedTime * 0.7) * 0.035);
      veilRef.current.visible = isAstralMeditating || strength > 0.01;
    }

    if (blinkRef.current) {
      blinkRef.current.position.copy(overlayPosition).addScaledVector(forward, 0.01);
      blinkRef.current.scale.set(horizontal * 1.5, vertical * 1.5, 1);
      blinkRef.current.material.opacity = blink * 0.82;
      blinkRef.current.visible = isAstralMeditating && blink > 0.01;
    }
  });

  return (
    <>
      <sprite ref={veilRef} renderOrder={1000} frustumCulled={false} visible={false}>
        <spriteMaterial map={veilTexture} transparent opacity={0} depthWrite={false} depthTest={false} color="#c084fc" toneMapped={false} />
      </sprite>
      <sprite ref={blinkRef} renderOrder={1001} frustumCulled={false} visible={false}>
        <spriteMaterial transparent opacity={0} depthWrite={false} depthTest={false} color="#16001f" toneMapped={false} />
      </sprite>
    </>
  );
}

export function GameWorld() {
  const gameMode = useGameStore(s => s.gameMode);
  const isSurvivalMode = gameMode === "solo-survival" || gameMode === "multiplayer-survival";
  const isMultiplayerMode = gameMode !== "solo-survival";
  const [isNearBaseVillage, setIsNearBaseVillage] = useState(true);
  const mobilePerformanceMode = useMemo(() => isMobilePerformanceMode(), []);
  const ambientIntensity = mobilePerformanceMode ? 1.25 : isSurvivalMode ? 0.72 : 0.4;
  const directionalIntensity = mobilePerformanceMode ? 2.55 : isSurvivalMode ? 1.85 : 1.5;
  const canvasBaseStyle: CSSProperties = {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    display: "block",
  };
  const canvasStyle: CSSProperties = mobilePerformanceMode
    ? {
      ...canvasBaseStyle,
      backgroundColor: isSurvivalMode ? "#bcefff" : "#9bdcff",
      filter: "none",
      WebkitFilter: "none",
      imageRendering: "pixelated",
      colorScheme: "only light",
    }
    : { ...canvasBaseStyle, backgroundColor: isSurvivalMode ? "#bcefff" : "#000000", imageRendering: "pixelated" };
  const horizonRadius = isSurvivalMode ? SURVIVAL_BLOCK_SIZE * 5.5 : 400;
  const horizonHeight = isSurvivalMode ? 2200 : 250;
  const horizonY = isSurvivalMode ? 330 : 40;
  const renderBaseVillageContent = !isSurvivalMode || isNearBaseVillage;

  useEffect(() => {
    if (!isSurvivalMode) {
      setIsNearBaseVillage(true);
      return;
    }

    const updateBaseVillageVisibility = (detail?: { x?: number; z?: number }) => {
      const x = Number(detail?.x ?? (window as any).localPlayerPos?.x ?? 0);
      const z = Number(detail?.z ?? (window as any).localPlayerPos?.z ?? 0);
      const nearBaseVillage = Math.max(Math.abs(x), Math.abs(z)) < BASE_VILLAGE_STREAM_DISTANCE;
      setIsNearBaseVillage((current) => current === nearBaseVillage ? current : nearBaseVillage);
    };

    updateBaseVillageVisibility();

    const handlePlayerMove = (event: Event) => {
      updateBaseVillageVisibility((event as CustomEvent<{ x?: number; z?: number }>).detail);
    };

    window.addEventListener("player-moved", handlePlayerMove);
    return () => window.removeEventListener("player-moved", handlePlayerMove);
  }, [isSurvivalMode]);

  const groundTexture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#3a6828"; // base grass
      ctx.fillRect(0, 0, 128, 128);
      for (let i = 0; i < 4000; i++) {
        ctx.fillStyle = Math.random() > 0.5 ? "rgba(42, 74, 26, 0.6)" : "rgba(60, 110, 40, 0.6)";
        ctx.fillRect(Math.floor(Math.random() * 128), Math.floor(Math.random() * 128), 2, 2);
      }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(128, 128);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);

  const terrainGeometry = useMemo(() => {
    // 512x512 size with 128 segments = 4 unit spacing exactly
    const geo = new THREE.PlaneGeometry(512, 512, 128, 128);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const z = pos.getZ(i);
        
        const y = getTerrainHeight(x, z);
        pos.setY(i, y);
    }

    const indices = geo.index!.array;
    const groundIndices = [];
    const roadIndices = [];
    const moatIndices = [];
    const dirtIndices = [];
    
    for (let i = 0; i < indices.length; i += 6) {
      const a1 = indices[i];
      const b1 = indices[i+1];
      const c1 = indices[i+2];
      const a2 = indices[i+3];
      const b2 = indices[i+4];
      const c2 = indices[i+5];
      
      const centerX = (pos.getX(a1) + pos.getX(b1) + pos.getX(c1) + pos.getX(a2) + pos.getX(b2) + pos.getX(c2)) / 6;
      const centerZ = (pos.getZ(a1) + pos.getZ(b1) + pos.getZ(c1) + pos.getZ(a2) + pos.getZ(b2) + pos.getZ(c2)) / 6;
      const centerY = (pos.getY(a1) + pos.getY(b1) + pos.getY(c1) + pos.getY(a2) + pos.getY(b2) + pos.getY(c2)) / 6;
      
      const absX = Math.abs(centerX);
      const absZ = Math.abs(centerZ);
      const R = Math.sqrt(centerX * centerX + centerZ * centerZ);
      
      const isRoad = absX < 12 || absZ < 12;
      const isMoat = (R > 42 && R < 58 && !isRoad) || (R > 125 && R < 145 && !isRoad);
      const isCentralPlaza = R < 35;
      const isPath = (absX >= 32 && absX < 40) && R > 60 && R < 125 || (absZ >= 32 && absZ < 40) && R > 60 && R < 125;
      
      let isTreeBase = false;
      const TREE_POSITIONS = [
        [0, 0],
        [25, 20],
        [-28, 15],
        [18, -26],
        [-22, -24]
      ];
      for (const [tx, tz] of TREE_POSITIONS) {
        if (Math.abs(centerX - tx) < 14 && Math.abs(centerZ - tz) < 14) {
          isTreeBase = true;
          break;
        }
      }

      if (centerY < -1.0 || isMoat) {
          moatIndices.push(a1, b1, c1, a2, b2, c2);
      } else if (isTreeBase) {
          const noise = Math.sin(centerX * 0.3 + centerZ * 0.4) * Math.cos(centerX * 0.2 + centerZ * 0.5);
          if (noise > 0.2) groundIndices.push(a1, b1, c1, a2, b2, c2);
          else dirtIndices.push(a1, b1, c1, a2, b2, c2);
      } else if (isRoad || isCentralPlaza || isPath) {
          roadIndices.push(a1, b1, c1, a2, b2, c2);
      } else {
          groundIndices.push(a1, b1, c1, a2, b2, c2);
      }
    }
    
    const newIndices = new Uint32Array([
       ...groundIndices, 
       ...roadIndices,
       ...moatIndices,
       ...dirtIndices
    ]);
    geo.setIndex(new THREE.BufferAttribute(newIndices, 1));
    geo.clearGroups();
    
    let offset = 0;
    geo.addGroup(offset, groundIndices.length, 0); 
    offset += groundIndices.length;
    geo.addGroup(offset, 0, 1); // material 1 empty
    geo.addGroup(offset, roadIndices.length, 2); 
    offset += roadIndices.length;
    geo.addGroup(offset, moatIndices.length, 3); 
    offset += moatIndices.length;
    geo.addGroup(offset, dirtIndices.length, 4); 

    geo.computeVertexNormals();
    return geo;
  }, []);

  const terrainCollisionGeometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(512, 512, 40, 40);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;

    for (let i = 0; i < pos.count; i += 1) {
      pos.setY(i, getTerrainHeight(pos.getX(i), pos.getZ(i)));
    }

    geo.computeVertexNormals();
    return geo;
  }, []);

  const wallTexture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      // Base grout color (dark brownish gray)
      ctx.fillStyle = "#1a1816";
      ctx.fillRect(0, 0, 512, 512);

      // Cobblestones
      const rows = 12;
      const cols = 12;
      const w = 512 / cols;
      const h = 512 / rows;
      
      // Use a fixed seed-like behavior for consistency on re-renders
      let seed = 42;
      const random = () => {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
      };

      for(let r = -1; r <= rows; r++) {
        // Slight varying row offset
        const rowOffset = (r % 2) * (w * 0.5) + (random() - 0.5) * (w * 0.2);
        
        for(let c = -1; c <= cols; c++) {
          const px = c * w + rowOffset;
          const py = r * h;
          
          // Stone dimensions slightly smaller than cell for grout
          const stoneW = w * 0.88;
          const stoneH = h * 0.88;
          
          const x = px + w * 0.06 + (random() - 0.5) * 4;
          const y = py + h * 0.06 + (random() - 0.5) * 4;
          const width = stoneW + (random() - 0.5) * 6;
          const height = stoneH + (random() - 0.5) * 6;
          
          // Draw stone with round bevel
          ctx.beginPath();
          const radius = Math.min(8 + random() * 4, width/2, height/2);
          if (ctx.roundRect) {
            ctx.roundRect(x, y, width, height, radius);
          } else {
            ctx.rect(x, y, width, height); // Fallback
          }
          
          // Determine stone color (mix of grays with some tans/browns)
          let rC, gC, bC;
          const type = random();
          if (type > 0.8) {
             // Tan / Brownish stone
             rC = 140 + random() * 30;
             gC = 125 + random() * 25;
             bC = 100 + random() * 20;
          } else {
             // Gray stone
             const lum = 90 + random() * 70;
             rC = lum + (random() * 10 - 5);
             gC = lum + (random() * 10 - 5);
             bC = lum + (random() * 10 - 5);
          }
          
          ctx.fillStyle = `rgb(${rC}, ${gC}, ${bC})`;
          ctx.fill();
          
          // Top highlight edge
          ctx.lineWidth = 1;
          ctx.strokeStyle = `rgba(255, 255, 255, ${0.1 + random()*0.1})`;
          ctx.beginPath();
          if (ctx.roundRect) {
             ctx.roundRect(x+1, y+1, width-2, height-2, radius);
          } else {
             ctx.rect(x+1, y+1, width-2, height-2);
          }
          ctx.stroke();
          
          // Texture details / bumps
          for (let i = 0; i < 8; i++) {
             ctx.fillStyle = (random() > 0.5) ? `rgba(255,255,255,0.05)` : `rgba(0,0,0,0.05)`;
             ctx.beginPath();
             ctx.arc(
               x + radius + random()*(width - radius*2), 
               y + radius + random()*(height - radius*2), 
               1 + random()*3, 0, Math.PI*2
             );
             ctx.fill();
          }
        }
      }
      
      // Few subtle moss spots where stones meet
      for(let i=0; i<40; i++) {
        const mx = random() * 512;
        const my = random() * 512;
        const mr = 2 + random() * 4;
        
        ctx.beginPath();
        ctx.arc(mx, my, mr, 0, Math.PI*2);
        const g = 70 + random() * 30;
        ctx.fillStyle = `rgba(${30 + random()*10}, ${g}, ${30 + random()*20}, 0.6)`;
        ctx.fill();
      }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(15, 15);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);

  const hillsTexture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 2048;
    canvas.height = 1024;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      // Sky area
      const skyGradient = ctx.createLinearGradient(0, 0, 0, 620);
      skyGradient.addColorStop(0, "#8bd6ff");
      skyGradient.addColorStop(0.55, "#c7f6ff");
      skyGradient.addColorStop(1, "#f1fff2");
      ctx.fillStyle = skyGradient;
      ctx.fillRect(0, 0, 2048, 1024);

      const drawHillsLayer = (
        color: string,
        baseHeight: number,
        f1: number, a1: number,
        f2: number, a2: number,
        f3: number, a3: number,
        hasRiver: boolean,
        treeDensity: number,
        treeColor: string
      ) => {
        const heightMap: number[] = [];
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(0, 1024);
        let startY = 0;
        for (let x = 0; x <= 2048; x += 1) { // 1px sampling for heights
          let phase = (x / 2048) * Math.PI * 2;
          let y = baseHeight + Math.sin(phase * f1) * a1 + Math.cos(phase * f2) * a2 + Math.sin(phase * f3) * a3;
          if (x === 0) startY = y;
          if (x === 2048) y = startY; 
          heightMap.push(y);
          if (x % 8 === 0) ctx.lineTo(x, y);
        }
        ctx.lineTo(2048, 1024);
        ctx.fill();

        // Draw trees
        ctx.fillStyle = treeColor;
        // Keep trees seeded consistently if needed, but random is okay since it's memoized ONCE on start
        for (let x = 0; x < 2048; x += 8) {
          if (Math.random() < treeDensity) {
            const y = heightMap[x];
            const treeHeight = 15 + Math.random() * 15;
            const treeWidth = 8 + Math.random() * 6;
            ctx.beginPath();
            ctx.moveTo(x, y + 2); // Start slightly below surface string line
            ctx.lineTo(x - treeWidth / 2, y + 2);
            ctx.lineTo(x, y - treeHeight);
            ctx.lineTo(x + treeWidth / 2, y + 2);
            ctx.fill();
          }
        }
      };

      // Farthest hills
      drawHillsLayer("#6d9a60", 450, 2, 60, 1, 80, 4, 20, false, 0.2, "#4a6d41");
      // Mid hills
      drawHillsLayer("#4b7f3d", 600, 3, 50, 2, 70, 5, 15, true, 0.3, "#2a4d20");
      // Close hills
      drawHillsLayer("#325b26", 750, 2, 80, 4, 40, 6, 25, true, 0.4, "#1b3314");
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);

  return (
    <Canvas 
      id="game-canvas"
      camera={{ fov: 75, far: SURVIVAL_BLOCK_SIZE * 18 }}
      gl={{ alpha: false, antialias: false, powerPreference: "high-performance", stencil: false }} 
      dpr={mobilePerformanceMode ? 0.46 : 0.52}
      resize={{ offsetSize: true }}
      onCreated={({ gl }) => configureGameRenderer(gl)}
      style={canvasStyle}
    >
      <CanvasResizeNudge />
      <QaPerfStatsProbe />
      <Suspense fallback={null}>
        {isSurvivalMode ? (
          <SurvivalSkyCycle mobilePerformanceMode={mobilePerformanceMode} />
        ) : mobilePerformanceMode ? (
          <color attach="background" args={["#9bdcff"]} />
        ) : (
          <>
            <Sky sunPosition={[50, 20, 50]} turbidity={0.3} rayleigh={0.5} />
            <Environment preset="sunset" />
          </>
        )}
        {!isSurvivalMode && <ambientLight intensity={ambientIntensity} />}
        {!isSurvivalMode && mobilePerformanceMode && <hemisphereLight args={["#ffffff", "#a37d52", 1.18]} />}
        {!isSurvivalMode && <directionalLight position={[50, 20, 50]} intensity={directionalIntensity} />}
        <AstralRealmVeil />

        <HorizonCylinder
          texture={hillsTexture}
          radius={horizonRadius}
          height={horizonHeight}
          y={horizonY}
          segments={isSurvivalMode ? 48 : 64}
          followCamera={isSurvivalMode}
          dynamicCycle={isSurvivalMode}
        />

        <Physics gravity={[0, -20, 0]}>
          <PlayerController />
          {isMultiplayerMode && <NetworkManager />}
          <Projectiles />
          {renderBaseVillageContent && <Campfire position={[8, getTerrainHeight(8, 30), 30]} />}
          
          {isSurvivalMode && renderBaseVillageContent && <VillagePerimeterWalls wallTexture={wallTexture} />}

          {/* Custom lobbies keep the closed arena walls. Survival uses open gate arches at road exits. */}
          {!isSurvivalMode && (
            <RigidBody type="fixed">
               {/* North/South walls */}
               <CastleWall position={[0, 6, -238]} args={[480, 12, 8]} texture={wallTexture} />
               <CastleWall position={[0, 6, 238]} args={[480, 12, 8]} texture={wallTexture} />
               {/* East/West walls */}
               <CastleWall position={[-238, 6, 0]} args={[8, 12, 468]} texture={wallTexture} />
               <CastleWall position={[238, 6, 0]} args={[8, 12, 468]} texture={wallTexture} />

               {/* Colliders (placed at the innermost face to prevent standing on top) */}
               <CuboidCollider args={[240, 50, 1]} position={[0, 50, -235]} />
               <CuboidCollider args={[240, 50, 1]} position={[0, 50, 235]} />
               <CuboidCollider args={[1, 50, 234]} position={[235, 50, 0]} />
               <CuboidCollider args={[1, 50, 234]} position={[-235, 50, 0]} />
            </RigidBody>
          )}

          {/* Floor & Decoration */}
          {renderBaseVillageContent && <Bushes />}
          <LiveMiniMap />
          
          {renderBaseVillageContent && (
            <>
              <mesh receiveShadow geometry={terrainGeometry} dispose={null}>
                <meshStandardMaterial attach="material-0" map={groundTexture} roughness={0.9} />
                <meshStandardMaterial attach="material-1" map={wallTexture} roughness={0.9} />
                <meshStandardMaterial attach="material-2" color="#c2a077" roughness={1.0} />
                <meshStandardMaterial attach="material-3" color="#4c3d2b" roughness={1.0} />
                <meshStandardMaterial attach="material-4" color="#5c4033" roughness={1.0} />
              </mesh>

              <RigidBody type="fixed" colliders="trimesh" friction={0} restitution={0}>
                <mesh geometry={terrainCollisionGeometry} dispose={null}>
                  <meshBasicMaterial transparent opacity={0} depthWrite={false} />
                </mesh>
              </RigidBody>
            </>
          )}
          
          {/* Water Plane */}
          {renderBaseVillageContent && (
            <RigidBody type="fixed">
               <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.8, 0]} renderOrder={-2}>
                 <planeGeometry args={[512, 512]} />
                 <meshStandardMaterial color="#2d5a88" transparent opacity={0.8} />
               </mesh>
            </RigidBody>
          )}
          
          {renderBaseVillageContent && <Huts />}
          {renderBaseVillageContent && <Villagers />}
          <Runes />
          {renderBaseVillageContent && <WaterRipples />}
          
          {renderBaseVillageContent && <TreeHouseVillage />}
          {isSurvivalMode && (
            <SurvivalProceduralWorld />
          )}
        </Physics>
      </Suspense>
    </Canvas>
  );
}
