import { useEffect, useMemo, useRef } from "react";
import { Billboard } from "@react-three/drei";
import * as THREE from "three";
import { MOBILE_PERFORMANCE_MODE } from "./spellProjectileTuning";

type WorldPixelPlane = {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  opacity?: number;
  rotation?: number;
};

export type TornadoBoxInstance = {
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
  color: string;
  rotationY?: number;
};

export function TornadoInstancedBoxes({ boxes, opacity }: { boxes: TornadoBoxInstance[]; opacity: number }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);
  const visibleOpacity = Math.min(0.96, opacity * (MOBILE_PERFORMANCE_MODE ? 1.65 : 1.35));

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    for (let index = 0; index < boxes.length; index += 1) {
      const box = boxes[index];
      dummy.position.set(box.x, box.y, box.z);
      dummy.rotation.set(0, box.rotationY ?? 0, 0);
      dummy.scale.set(box.w, box.h, box.d);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      mesh.setColorAt(index, color.set(box.color));
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [boxes, color, dummy]);

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, boxes.length]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial
        vertexColors
        transparent
        opacity={visibleOpacity}
        blending={THREE.NormalBlending}
        depthTest={false}
        depthWrite={false}
        toneMapped={false}
      />
    </instancedMesh>
  );
}

const pixelMeteorBlocks: WorldPixelPlane[] = [
  { x: -0.72, y: 1.34, w: 1.44, h: 0.42, color: "#fed7aa", opacity: 0.62 },
  { x: -1.16, y: 0.96, w: 2.32, h: 0.52, color: "#fb923c", opacity: 0.78 },
  { x: -1.42, y: 0.44, w: 2.84, h: 0.64, color: "#ef4444", opacity: 0.82 },
  { x: -1.62, y: -0.22, w: 3.24, h: 0.82, color: "#f97316", opacity: 0.92 },
  { x: -1.32, y: -0.9, w: 2.64, h: 0.68, color: "#b91c1c", opacity: 0.82 },
  { x: -0.82, y: -1.32, w: 1.64, h: 0.42, color: "#fb923c", opacity: 0.7 },
  { x: -0.72, y: 0.78, w: 1.44, h: 0.46, color: "#fff7ed", opacity: 0.92 },
  { x: -1.02, y: 0.16, w: 2.04, h: 0.68, color: "#fde68a", opacity: 0.94 },
  { x: -0.82, y: -0.48, w: 1.64, h: 0.7, color: "#facc15", opacity: 0.92 },
  { x: -0.42, y: -0.9, w: 0.84, h: 0.42, color: "#fffbeb", opacity: 0.88 },
  { x: -0.38, y: 0.08, w: 0.76, h: 0.44, color: "#7c2d12", opacity: 0.95 },
  { x: 0.42, y: -0.08, w: 0.58, h: 0.42, color: "#9a3412", opacity: 0.95 },
  { x: -0.92, y: -0.38, w: 0.56, h: 0.44, color: "#c2410c", opacity: 0.95 },
  { x: 0.18, y: -0.62, w: 0.72, h: 0.5, color: "#ea580c", opacity: 0.95 },
  { x: -1.68, y: 0.86, w: 0.16, h: 0.16, color: "#fff7ed", opacity: 0.72 },
  { x: 1.66, y: 0.48, w: 0.18, h: 0.18, color: "#fed7aa", opacity: 0.68 },
  { x: -1.54, y: -1.08, w: 0.16, h: 0.16, color: "#fb923c", opacity: 0.66 },
  { x: 1.38, y: -1.08, w: 0.16, h: 0.16, color: "#fef3c7", opacity: 0.68 },
];

let cachedMeteorTexture: THREE.CanvasTexture | null = null;
let cachedTornadoTexture: THREE.CanvasTexture | null = null;

function getPixelMeteorTexture() {
  if (cachedMeteorTexture || typeof document === "undefined") return cachedMeteorTexture;

  const canvas = document.createElement("canvas");
  const size = 64;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.imageSmoothingEnabled = false;
  for (let index = 0; index < pixelMeteorBlocks.length; index += 1) {
    const block = pixelMeteorBlocks[index];
    const x = Math.round(((block.x - block.w / 2 + 2) / 4) * size);
    const y = Math.round(((2 - (block.y + block.h / 2)) / 4) * size);
    const w = Math.max(1, Math.round((block.w / 4) * size));
    const h = Math.max(1, Math.round((block.h / 4) * size));
    ctx.globalAlpha = block.opacity ?? 1;
    ctx.fillStyle = block.color;
    ctx.fillRect(x, y, w, h);
  }
  ctx.globalAlpha = 1;

  cachedMeteorTexture = new THREE.CanvasTexture(canvas);
  cachedMeteorTexture.magFilter = THREE.NearestFilter;
  cachedMeteorTexture.minFilter = THREE.NearestFilter;
  cachedMeteorTexture.generateMipmaps = false;
  cachedMeteorTexture.colorSpace = THREE.SRGBColorSpace;
  cachedMeteorTexture.needsUpdate = true;
  return cachedMeteorTexture;
}

export function PixelMeteorSprite() {
  const texture = getPixelMeteorTexture();
  if (!texture) return null;

  return (
    <Billboard>
      <mesh>
        <planeGeometry args={[4.1, 4.1]} />
        <meshBasicMaterial
          map={texture}
          transparent
          opacity={0.96}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </Billboard>
  );
}

function getPixelTornadoTexture() {
  if (cachedTornadoTexture || typeof document === "undefined") return cachedTornadoTexture;

  const canvas = document.createElement("canvas");
  const width = 96;
  const height = 128;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.imageSmoothingEnabled = false;
  const drawBlock = (x: number, y: number, w: number, h: number, color: string, alpha = 1) => {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  };

  const shades = ["#f8fafc", "#d1d5db", "#9ca3af", "#6b7280", "#4b5563"];
  for (let band = 0; band < 12; band += 1) {
    const t = band / 11;
    const y = 12 + band * 8.4;
    const bandWidth = 62 - t * 42;
    const centerX = width / 2 + Math.sin(t * Math.PI * 5.2) * (8 - t * 4);
    const heightStep = 5 + (band % 3);
    const shade = shades[band % shades.length];
    const highlight = shades[(band + 1) % shades.length];

    drawBlock(centerX - bandWidth / 2, y, bandWidth * 0.72, heightStep, shade, 0.78);
    drawBlock(centerX - bandWidth / 2 + bandWidth * 0.34, y + 3, bandWidth * 0.72, heightStep, highlight, 0.68);
    drawBlock(centerX - bandWidth / 2 + bandWidth * 0.08, y + 6, bandWidth * 0.46, 3, "#ffffff", 0.2);
  }

  for (let i = 0; i < 18; i += 1) {
    const t = i / 17;
    const angle = t * Math.PI * 8.5;
    const radius = 28 - t * 18;
    const x = width / 2 + Math.cos(angle) * radius + Math.sin(t * 13) * 3;
    const y = 10 + t * 108;
    const size = 2 + (i % 3);
    drawBlock(x, y, size + 1, size, shades[(i + 2) % shades.length], 0.78);
  }

  for (let i = 0; i < 7; i += 1) {
    const x = 18 + i * 9 + (i % 2) * 3;
    drawBlock(x, 116 + (i % 2) * 3, 7, 3, i % 2 ? "#a16207" : "#6b7280", 0.54);
  }
  ctx.globalAlpha = 1;

  cachedTornadoTexture = new THREE.CanvasTexture(canvas);
  cachedTornadoTexture.magFilter = THREE.NearestFilter;
  cachedTornadoTexture.minFilter = THREE.NearestFilter;
  cachedTornadoTexture.generateMipmaps = false;
  cachedTornadoTexture.colorSpace = THREE.SRGBColorSpace;
  cachedTornadoTexture.needsUpdate = true;
  return cachedTornadoTexture;
}

export function PixelTornadoSprite() {
  const texture = getPixelTornadoTexture();
  if (!texture) return null;

  return (
    <Billboard position={[0, 4.2, 0]} renderOrder={12}>
      <mesh>
        <planeGeometry args={[7.6, 9.4]} />
        <meshBasicMaterial
          map={texture}
          transparent
          opacity={MOBILE_PERFORMANCE_MODE ? 0.96 : 0.82}
          alphaTest={0.03}
          depthTest={false}
          depthWrite={false}
          toneMapped={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </Billboard>
  );
}
