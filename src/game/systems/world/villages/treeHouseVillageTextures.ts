import * as THREE from "three";
import { getSeededTextureRandom } from "../../rendering/textures/textureNoise";

const TREE_HOUSE_WOOD_COLOR = "#2a1c12";
const TREE_HOUSE_LIGHT_WOOD_COLOR = "#4a3221";

let cachedBarkTexture: THREE.CanvasTexture | null = null;
let cachedPlankTexture: THREE.CanvasTexture | null = null;

export function getTreeHouseBarkTexture() {
  if (cachedBarkTexture) return cachedBarkTexture;

  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = TREE_HOUSE_WOOD_COLOR;
  ctx.fillRect(0, 0, 64, 64);
  const random = getSeededTextureRandom("tree-house-bark");

  for (let i = 0; i < 200; i += 1) {
    ctx.fillStyle = random() > 0.5 ? "rgba(20, 10, 5, 0.5)" : "rgba(80, 50, 20, 0.3)";
    const x = Math.floor(random() * 64);
    const y = Math.floor(random() * 64);
    const w = Math.floor(1 + random() * 2);
    const h = Math.floor(4 + random() * 16);
    ctx.fillRect(x, y, w, h);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 4);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  cachedBarkTexture = texture;
  return texture;
}

export function getTreeHousePlankTexture() {
  if (cachedPlankTexture) return cachedPlankTexture;

  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = TREE_HOUSE_LIGHT_WOOD_COLOR;
  ctx.fillRect(0, 0, 64, 64);

  ctx.fillStyle = "#1a120b";
  for (let y = 0; y < 64; y += 16) {
    ctx.fillRect(0, y, 64, 2);
  }
  for (let y = 0; y < 64; y += 16) {
    const offsetX = (y / 16) % 2 === 0 ? 0 : 32;
    ctx.fillRect(offsetX, y, 2, 16);
  }

  const random = getSeededTextureRandom("tree-house-plank");
  for (let i = 0; i < 200; i += 1) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
    ctx.fillRect(Math.floor(random() * 64), Math.floor(random() * 64), 4, 1);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 1);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  cachedPlankTexture = texture;
  return texture;
}
