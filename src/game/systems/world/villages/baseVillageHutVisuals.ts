import * as THREE from "three";

const MUSHROOM_CAP_COLORS = ["#DB0F27", "#00ff00", "#3877FC", "#b57edc"];
const DIRT_COLORS = ["#866043", "#745239", "#694931", "#5d412b"];
const GRASS_COLORS = ["#3a6828", "#2a4a1a", "#3c6e28"];

type HutTextureOptions = {
  repeat?: [number, number];
  wrap?: boolean;
};

function getSeededHutRandom(seedText: string) {
  let seed = 2166136261;
  for (let index = 0; index < seedText.length; index += 1) {
    seed ^= seedText.charCodeAt(index);
    seed = Math.imul(seed, 16777619);
  }

  return () => {
    seed += 0x6D2B79F5;
    let value = seed;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function createHutCanvasTexture(
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
  options: HutTextureOptions = {},
) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (ctx) draw(ctx);

  const texture = new THREE.CanvasTexture(canvas);
  if (options.wrap ?? options.repeat !== undefined) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
  }
  if (options.repeat) {
    texture.repeat.set(options.repeat[0], options.repeat[1]);
  }
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export function createMushroomCapTextures() {
  const textures = new Array<THREE.CanvasTexture>(MUSHROOM_CAP_COLORS.length);
  for (let colorIndex = 0; colorIndex < MUSHROOM_CAP_COLORS.length; colorIndex += 1) {
    const color = MUSHROOM_CAP_COLORS[colorIndex];
    textures[colorIndex] = createHutCanvasTexture(128, 128, (ctx) => {
      const random = getSeededHutRandom(`mushroom-cap-${colorIndex}`);
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 128, 128);
      ctx.fillStyle = "#ffffff";
      for (let index = 0; index < 6; index += 1) {
        const size = 16 + random() * 16;
        ctx.fillRect(10 + random() * 90, 10 + random() * 90, size, size);
      }
    }, { wrap: true });
  }
  return textures;
}

export function createStemWallTexture() {
  return createHutCanvasTexture(128, 128, (ctx) => {
    const random = getSeededHutRandom("stem-wall");
    ctx.fillStyle = "#f4f1ea";
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = "rgba(0,0,0,0.05)";
    for (let x = 0; x < 128; x += 16) {
      ctx.fillRect(x + random() * 4, 0, 2, 128);
    }
  }, { repeat: [2, 1] });
}

export function createDirtDoorTexture() {
  return createHutCanvasTexture(64, 64, (ctx) => {
    ctx.fillStyle = "#4a3525";
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = "#332211";
    for (let x = 0; x < 64; x += 8) {
      ctx.fillRect(x, 0, 1, 64);
    }
    ctx.fillStyle = "#111";
    ctx.fillRect(48, 30, 4, 4);
  });
}

export function createGrassTexture() {
  return createHutCanvasTexture(128, 128, (ctx) => {
    const random = getSeededHutRandom("grass-roof");
    ctx.fillStyle = "#3a6828";
    ctx.fillRect(0, 0, 128, 128);
    for (let index = 0; index < 4000; index += 1) {
      ctx.fillStyle = random() > 0.5 ? "rgba(42, 74, 26, 0.6)" : "rgba(60, 110, 40, 0.6)";
      ctx.fillRect(Math.floor(random() * 128), Math.floor(random() * 128), 2, 2);
    }
  }, { repeat: [4, 4] });
}

export function createLogTexture() {
  return createHutCanvasTexture(128, 128, (ctx) => {
    const random = getSeededHutRandom("log-wall-v2");
    ctx.fillStyle = "#89755b";
    ctx.fillRect(0, 0, 128, 128);

    const logHeight = 64;
    for (let y = 0; y < 128; y += logHeight) {
      const logTop = y + 6;
      const logH = logHeight - 12;

      ctx.fillStyle = "#2a1c12";
      ctx.fillRect(0, logTop, 128, logH);
      ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
      ctx.fillRect(0, logTop + logH, 128, 3);
      ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
      ctx.fillRect(0, logTop, 128, 2);
      ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
      ctx.fillRect(0, logTop + logH - 4, 128, 4);

      for (let index = 0; index < 60; index += 1) {
        ctx.fillStyle = random() > 0.5 ? "rgba(20, 10, 5, 0.5)" : "rgba(80, 50, 20, 0.3)";
        const x = random() * 128;
        const len = 10 + random() * 40;
        ctx.fillRect(x, logTop + 2 + random() * (logH - 6), len, 1 + random());
      }
    }
  }, { repeat: [2, 1] });
}

export function createDirtGrassTexture() {
  return createHutCanvasTexture(128, 128, (ctx) => {
    const random = getSeededHutRandom("dirt-grass-v2");
    for (let y = 0; y < 16; y += 1) {
      for (let x = 0; x < 16; x += 1) {
        ctx.fillStyle = DIRT_COLORS[Math.floor(random() * DIRT_COLORS.length)];
        ctx.fillRect(x * 8, y * 8, 8, 8);
      }
    }

    for (let x = 0; x < 16; x += 1) {
      const depth = 4 + Math.floor(random() * 5);
      for (let y = 0; y < depth; y += 1) {
        ctx.fillStyle = GRASS_COLORS[Math.floor(random() * GRASS_COLORS.length)];
        ctx.fillRect(x * 8, y * 8, 8, 8);
      }
    }
  }, { repeat: [4, 1] });
}

export function createWoodPlankTexture() {
  return createHutCanvasTexture(128, 128, (ctx) => {
    const random = getSeededHutRandom("wood-plank");
    ctx.fillStyle = "#8b5a2b";
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = "#5c3317";
    for (let x = 0; x < 128; x += 32) {
      ctx.fillRect(x, 0, 2, 128);
    }
    ctx.fillStyle = "rgba(60, 30, 10, 0.4)";
    for (let index = 0; index < 200; index += 1) {
      const x = random() * 128;
      const y = random() * 128;
      const len = 10 + random() * 30;
      ctx.fillRect(x, y, 1, len);
    }
  }, { repeat: [4, 4] });
}

export function createDirtWallTexture() {
  return createHutCanvasTexture(128, 128, (ctx) => {
    ctx.fillStyle = "#7c7c7c";
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = "#5c5c5c";
    for (let y = 0; y < 128; y += 16) {
      ctx.fillRect(0, y, 128, 2);
      for (let x = 0; x < 128; x += 32) {
        const offset = (y / 16) % 2 === 0 ? 0 : 16;
        ctx.fillRect(x + offset, y, 2, 16);
      }
    }
  }, { repeat: [2, 1] });
}
