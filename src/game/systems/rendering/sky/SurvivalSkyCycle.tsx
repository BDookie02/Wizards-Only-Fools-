import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import * as THREE from "three";
import { DAY_NIGHT_CYCLE_SECONDS, SURVIVAL_BLOCK_SIZE, useGameStore } from "../../../../store/gameStore";
import { useLazyRef } from "../../react/useLazyRef";
import { getEpochMsFromRenderClock } from "../renderClockEpoch";
import {
  clamp01,
  createSurvivalDayNightCycle,
  getEffectiveSurvivalCycleElapsedSeconds,
  getQaSurvivalTimeOverrideSeconds,
  getSurvivalDayNightCycleInto,
  smoothstepRange,
} from "./survivalSkyCycleMath";

function survivalHash01(x: number, z: number, salt = 0) {
  const n = Math.sin(x * 127.1 + z * 311.7 + salt * 74.7) * 43758.5453123;
  return n - Math.floor(n);
}

const SURVIVAL_MOON_SKY_SCALE = 1.85;
const MOBILE_SURVIVAL_SKY_UPDATE_INTERVAL_SECONDS = 1 / 30;
const SURVIVAL_MOON_CRATER_SPECS: readonly [number, number, number][] = [
  [-8, -7, 5],
  [7, 4, 4],
  [-2, 11, 3],
  [9, -11, 3],
];
const SURVIVAL_CLOUD_ELLIPSE_SPECS: readonly [number, number, number, number][] = [
  [44, 50, 50, 23],
  [76, 37, 62, 31],
  [121, 34, 78, 36],
  [165, 41, 66, 29],
  [206, 55, 44, 18],
  [124, 62, 134, 16],
];

type SurvivalMoonSpec = {
  key: string;
  offset: number;
  zBias: number;
  lift: number;
  scale: number;
  opacity: number;
  phaseOffset: number;
};

const SURVIVAL_MOON_SPECS: readonly SurvivalMoonSpec[] = [
  { key: "large", offset: -0.2, zBias: -0.1, lift: 0.02, scale: 94, opacity: 1, phaseOffset: 0 },
  { key: "blue", offset: 0.54, zBias: 0.32, lift: 0.14, scale: 50, opacity: 0.76, phaseOffset: 0.32 },
  { key: "small", offset: -0.76, zBias: -0.42, lift: -0.04, scale: 38, opacity: 0.64, phaseOffset: 0.61 },
];

type SurvivalCloudSpec = {
  key: string;
  angle: number;
  radius: number;
  height: number;
  width: number;
  heightScale: number;
  opacity: number;
  drift: number;
};

export function HorizonCylinder({
  texture,
  radius,
  height,
  y,
  segments,
  followCamera,
  dynamicCycle = false,
  mobilePerformanceMode = false,
}: {
  texture: THREE.Texture;
  radius: number;
  height: number;
  y: number;
  segments: number;
  followCamera: boolean;
  dynamicCycle?: boolean;
  mobilePerformanceMode?: boolean;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);

  return (
    <>
      {(followCamera || dynamicCycle) && (
        <HorizonCylinderRuntime
          meshRef={ref}
          materialRef={materialRef}
          y={y}
          followCamera={followCamera}
          dynamicCycle={dynamicCycle}
          mobilePerformanceMode={mobilePerformanceMode}
        />
      )}
      <mesh ref={ref} name="horizon-cylinder" position={[0, y, 0]} renderOrder={-10} frustumCulled={false}>
        <cylinderGeometry args={[radius, radius, height, segments, 1, true]} />
        <meshBasicMaterial
          ref={materialRef}
          map={texture}
          side={THREE.BackSide}
          transparent
          alphaTest={0.01}
          depthWrite={false}
        />
      </mesh>
    </>
  );
}

function HorizonCylinderRuntime({
  meshRef,
  materialRef,
  y,
  followCamera,
  dynamicCycle,
  mobilePerformanceMode,
}: {
  meshRef: MutableRefObject<THREE.Mesh | null>;
  materialRef: MutableRefObject<THREE.MeshBasicMaterial | null>;
  y: number;
  followCamera: boolean;
  dynamicCycle: boolean;
  mobilePerformanceMode: boolean;
}) {
  const lastHorizonTintUpdateAtRef = useRef(Number.NEGATIVE_INFINITY);
  const { camera } = useThree();
  const dayTint = useMemo(() => new THREE.Color("#ffffff"), []);
  const duskTint = useMemo(() => new THREE.Color("#ffd09a"), []);
  const nightTint = useMemo(() => new THREE.Color("#4b547c"), []);
  const currentTint = useMemo(() => new THREE.Color("#ffffff"), []);
  const cycleScratch = useMemo(createSurvivalDayNightCycle, []);
  const survivalTimeOverrideSeconds = useGameStore(s => s.survivalTimeOverrideSeconds);
  const qaSurvivalTimeOverrideSeconds = useMemo(() => getQaSurvivalTimeOverrideSeconds(), []);

  useFrame((state) => {
    if (followCamera && meshRef.current) {
      meshRef.current.position.set(camera.position.x, y, camera.position.z);
    }

    const elapsed = state.clock.elapsedTime;
    if (
      dynamicCycle &&
      materialRef.current &&
      (!mobilePerformanceMode || elapsed - lastHorizonTintUpdateAtRef.current >= MOBILE_SURVIVAL_SKY_UPDATE_INTERVAL_SECONDS)
    ) {
      lastHorizonTintUpdateAtRef.current = elapsed;
      const cycle = getSurvivalDayNightCycleInto(
        getEffectiveSurvivalCycleElapsedSeconds(
          survivalTimeOverrideSeconds,
          elapsed,
          qaSurvivalTimeOverrideSeconds,
        ),
        cycleScratch,
      );
      currentTint.copy(nightTint).lerp(dayTint, cycle.dayAmount).lerp(duskTint, cycle.duskAmount * 0.32);
      materialRef.current.color.copy(currentTint);
    }
  });

  return null;
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

    if (phaseIndex !== 4) {
      ctx.fillStyle = "rgba(90, 105, 145, 0.22)";
      for (let index = 0; index < SURVIVAL_MOON_CRATER_SPECS.length; index += 1) {
        const [x, y, r] = SURVIVAL_MOON_CRATER_SPECS[index];
        ctx.beginPath();
        ctx.arc(cx + x, cy + y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  };

  cachedSurvivalMoonPhaseTextures = new Array<THREE.CanvasTexture>(8);
  for (let phaseIndex = 0; phaseIndex < cachedSurvivalMoonPhaseTextures.length; phaseIndex += 1) {
    cachedSurvivalMoonPhaseTextures[phaseIndex] = makeSkyCanvasTexture(96, 96, (ctx, width, height) => {
      drawMoonBase(ctx, width, height);
      drawMoonSurface(ctx, phaseIndex);
    });
  }

  return cachedSurvivalMoonPhaseTextures;
}

let cachedSurvivalCloudTexture: THREE.CanvasTexture | null = null;
function getSurvivalCloudTexture() {
  if (cachedSurvivalCloudTexture) return cachedSurvivalCloudTexture;

  cachedSurvivalCloudTexture = makeSkyCanvasTexture(256, 96, (ctx) => {
    ctx.clearRect(0, 0, 256, 96);
    const cloudGradient = ctx.createLinearGradient(0, 18, 0, 78);
    cloudGradient.addColorStop(0, "rgba(255, 255, 255, 0.82)");
    cloudGradient.addColorStop(0.62, "rgba(255, 255, 255, 0.72)");
    cloudGradient.addColorStop(1, "rgba(184, 219, 235, 0.2)");
    ctx.fillStyle = cloudGradient;

    for (let index = 0; index < SURVIVAL_CLOUD_ELLIPSE_SPECS.length; index += 1) {
      const [x, y, rx, ry] = SURVIVAL_CLOUD_ELLIPSE_SPECS[index];
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = "rgba(147, 197, 214, 0.12)";
    ctx.beginPath();
    ctx.ellipse(130, 67, 102, 11, 0, 0, Math.PI * 2);
    ctx.fill();
  });

  return cachedSurvivalCloudTexture;
}

let cachedSurvivalStarTexture: THREE.CanvasTexture | null = null;
function getSurvivalStarTexture() {
  if (cachedSurvivalStarTexture) return cachedSurvivalStarTexture;

  cachedSurvivalStarTexture = makeSkyCanvasTexture(768, 512, (ctx, width, height) => {
    ctx.clearRect(0, 0, width, height);
    const starCount = 520;

    for (let index = 0; index < starCount; index += 1) {
      const x = Math.floor(survivalHash01(index, starCount, 4330) * width);
      const y = Math.floor(Math.pow(survivalHash01(index, starCount, 4370), 0.78) * height);
      const brightness = 0.18 + survivalHash01(index, starCount, 4410) * 0.42;
      const tint = survivalHash01(index, starCount, 4490);
      const color = tint > 0.88
        ? [255, 218, 166]
        : tint > 0.7
          ? [188, 205, 255]
          : [255, 249, 232];

      ctx.fillStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${brightness})`;
      ctx.fillRect(x, y, 1, 1);
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
  });

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

export function SurvivalSkyCycle({ mobilePerformanceMode }: { mobilePerformanceMode: boolean }) {
  const { camera, scene } = useThree();
  const isAstralMeditating = useGameStore(s => s.isAstralMeditating);
  const astralMeditationStartedAt = useGameStore(s => s.astralMeditationStartedAt);
  const renderEpochOffsetMsRef = useRef<number | null>(null);
  const survivalTimeOverrideSeconds = useGameStore(s => s.survivalTimeOverrideSeconds);
  const qaSurvivalTimeOverrideSeconds = useMemo(() => getQaSurvivalTimeOverrideSeconds(), []);
  const sunTexture = useMemo(() => getSurvivalSunTexture(), []);
  const moonTextures = useMemo(() => getSurvivalMoonPhaseTextures(), []);
  const cloudTexture = useMemo(() => getSurvivalCloudTexture(), []);
  const starTexture = useMemo(() => getSurvivalStarTexture(), []);
  const sunRef = useRef<THREE.Sprite>(null);
  const moonRefs = useLazyRef<THREE.Sprite[]>(() => []);
  const cloudRefs = useLazyRef<THREE.Sprite[]>(() => []);
  const cloudGroupRef = useRef<THREE.Group>(null);
  const starFieldRef = useRef<THREE.Mesh>(null);
  const starMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const ambientLightRef = useRef<THREE.AmbientLight>(null);
  const hemisphereLightRef = useRef<THREE.HemisphereLight>(null);
  const directionalLightRef = useRef<THREE.DirectionalLight>(null);
  const lastSkyUpdateAtRef = useRef(Number.NEGATIVE_INFINITY);
  const cycleScratch = useMemo(createSurvivalDayNightCycle, []);
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
  const moonSpecs = SURVIVAL_MOON_SPECS;
  const cloudSpecs = useMemo<SurvivalCloudSpec[]>(() => {
    const count = mobilePerformanceMode ? 8 : 13;
    const specs = new Array<SurvivalCloudSpec>(count);
    for (let index = 0; index < count; index += 1) {
      const hash = survivalHash01(index, count, 240);
      specs[index] = {
        key: `sky-cloud-${index}`,
        angle: (Math.PI * 2 * index) / count + hash * 0.7,
        radius: skyRadius * (0.64 + survivalHash01(index, count, 260) * 0.26),
        height: 130 + survivalHash01(index, count, 280) * 170,
        width: 120 + survivalHash01(index, count, 300) * 140,
        heightScale: 34 + survivalHash01(index, count, 320) * 42,
        opacity: 0.52 + survivalHash01(index, count, 340) * 0.34,
        drift: (0.006 + survivalHash01(index, count, 360) * 0.009) * (index % 2 === 0 ? 1 : -1),
      };
    }
    return specs;
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
    if (
      mobilePerformanceMode &&
      animationElapsedSeconds - lastSkyUpdateAtRef.current < MOBILE_SURVIVAL_SKY_UPDATE_INTERVAL_SECONDS
    ) {
      return;
    }
    lastSkyUpdateAtRef.current = animationElapsedSeconds;

    const renderEpochMs = getEpochMsFromRenderClock(animationElapsedSeconds, renderEpochOffsetMsRef);
    const cycleElapsedSeconds = getEffectiveSurvivalCycleElapsedSeconds(
      survivalTimeOverrideSeconds,
      animationElapsedSeconds,
      qaSurvivalTimeOverrideSeconds,
    );
    const cycle = getSurvivalDayNightCycleInto(cycleElapsedSeconds, cycleScratch);
    const astralStrength = isAstralMeditating
      ? smoothstepRange(0, 1300, Math.max(0, renderEpochMs - astralMeditationStartedAt))
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

    for (let index = 0; index < moonSpecs.length; index += 1) {
      const moon = moonSpecs[index];
      const sprite = moonRefs.current[index];
      if (!sprite) continue;
      const moonAngle = cycle.sunAngle + Math.PI + moon.offset;
      vectors.moon.set(
        Math.cos(moonAngle) * 0.76,
        Math.max(-0.18, Math.sin(moonAngle) * 0.92 + moon.lift),
        -0.34 + moon.zBias,
      ).normalize();
      sprite.position.copy(camera.position).addScaledVector(vectors.moon, skyRadius * 0.92);
      const moonScale = moon.scale * SURVIVAL_MOON_SKY_SCALE * (mobilePerformanceMode ? 0.86 : 1);
      sprite.scale.set(moonScale, moonScale, 1);
      const material = sprite.material as THREE.SpriteMaterial;
      const phaseIndex = Math.floor((((cycleElapsedSeconds / (DAY_NIGHT_CYCLE_SECONDS * 2)) + moon.phaseOffset) % 1) * moonTextures.length) % moonTextures.length;
      if (material.map !== moonTextures[phaseIndex]) {
        material.map = moonTextures[phaseIndex];
        material.needsUpdate = true;
      }
      const phaseDim = phaseIndex === 4 ? 0.42 : phaseIndex === 3 || phaseIndex === 5 ? 0.72 : 1;
      material.opacity = clamp01((cycle.nightAmount * 1.05 + cycle.duskAmount * 0.18) * moon.opacity * phaseDim);
      material.color.copy(colors.moonDay).lerp(colors.moonNight, cycle.nightAmount);
    }

    colors.currentCloud.copy(colors.cloudNight).lerp(colors.cloudDay, cycle.dayAmount).lerp(colors.cloudAstral, astralStrength * 0.55);
    if (cloudGroupRef.current) {
      cloudGroupRef.current.position.set(camera.position.x, camera.position.y * 0.08, camera.position.z);
    }
    for (let index = 0; index < cloudSpecs.length; index += 1) {
      const cloud = cloudSpecs[index];
      const sprite = cloudRefs.current[index];
      if (!sprite) continue;
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
    }
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

export function AstralRealmVeil() {
  const isAstralMeditating = useGameStore(s => s.isAstralMeditating);
  const astralMeditationStartedAt = useGameStore(s => s.astralMeditationStartedAt);
  if (!isAstralMeditating) return null;

  return <ActiveAstralRealmVeil astralMeditationStartedAt={astralMeditationStartedAt} />;
}

function ActiveAstralRealmVeil({
  astralMeditationStartedAt,
}: {
  astralMeditationStartedAt: number;
}) {
  const { camera, size } = useThree();
  const veilTexture = useMemo(() => getAstralVeilTexture(), []);
  const veilRef = useRef<THREE.Sprite>(null);
  const blinkRef = useRef<THREE.Sprite>(null);
  const renderEpochOffsetMsRef = useRef<number | null>(null);
  const forward = useMemo(() => new THREE.Vector3(), []);
  const overlayPosition = useMemo(() => new THREE.Vector3(), []);
  const distance = 1.15;

  useFrame((state) => {
    const renderEpochMs = getEpochMsFromRenderClock(state.clock.elapsedTime, renderEpochOffsetMsRef);
    const sinceStart = Math.max(0, renderEpochMs - astralMeditationStartedAt);
    const strength = smoothstepRange(150, 1350, sinceStart);
    const blink = 1 - smoothstepRange(220, 1150, sinceStart);
    const perspective = camera as THREE.PerspectiveCamera;
    const vertical = perspective.isPerspectiveCamera
      ? 2 * Math.tan(THREE.MathUtils.degToRad(perspective.fov) * 0.5) * distance
      : 2.2;
    const horizontal = vertical * (size.width / Math.max(1, size.height));

    camera.getWorldDirection(forward);
    overlayPosition.copy(camera.position).addScaledVector(forward, distance);

    if (veilRef.current) {
      veilRef.current.position.copy(overlayPosition);
      veilRef.current.scale.set(horizontal * 1.38, vertical * 1.42, 1);
      veilRef.current.material.rotation = state.clock.elapsedTime * 0.025;
      veilRef.current.material.opacity = strength * (0.28 + Math.sin(state.clock.elapsedTime * 0.7) * 0.035);
      veilRef.current.visible = strength > 0.01;
    }

    if (blinkRef.current) {
      blinkRef.current.position.copy(overlayPosition).addScaledVector(forward, 0.01);
      blinkRef.current.scale.set(horizontal * 1.5, vertical * 1.5, 1);
      blinkRef.current.material.opacity = blink * 0.82;
      blinkRef.current.visible = blink > 0.01;
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
