import * as THREE from "three";

let cachedHorizonHillsTexture: THREE.CanvasTexture | null = null;

function createSeededRandom(seedValue: number) {
  let seed = seedValue;
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

export function getHorizonHillsTexture() {
  if (cachedHorizonHillsTexture) return cachedHorizonHillsTexture;

  const canvas = document.createElement("canvas");
  canvas.width = 2048;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    ctx.clearRect(0, 0, 2048, 1024);

    const drawHillsLayer = (
      color: string,
      baseHeight: number,
      f1: number,
      a1: number,
      f2: number,
      a2: number,
      f3: number,
      a3: number,
      treeDensity: number,
      treeColor: string,
      randomSeed: number,
    ) => {
      const random = createSeededRandom(randomSeed);
      const heightMap: number[] = [];
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, 1024);
      let startY = 0;

      for (let x = 0; x <= 2048; x += 1) {
        const phase = (x / 2048) * Math.PI * 2;
        let y = baseHeight + Math.sin(phase * f1) * a1 + Math.cos(phase * f2) * a2 + Math.sin(phase * f3) * a3;
        if (x === 0) startY = y;
        if (x === 2048) y = startY;
        heightMap.push(y);
        if (x % 3 === 0) ctx.lineTo(x, y);
      }

      ctx.lineTo(2048, 1024);
      ctx.fill();
      ctx.fillStyle = treeColor;

      for (let x = 0; x < 2048; x += 8) {
        if (random() < treeDensity) {
          const y = heightMap[x] ?? baseHeight;
          const treeHeight = 15 + random() * 15;
          const treeWidth = 8 + random() * 6;
          ctx.beginPath();
          ctx.moveTo(x, y + 2);
          ctx.lineTo(x - treeWidth / 2, y + 2);
          ctx.lineTo(x, y - treeHeight);
          ctx.lineTo(x + treeWidth / 2, y + 2);
          ctx.fill();
        }
      }
    };

    drawHillsLayer("#4f9631", 450, 2, 60, 1, 80, 4, 20, 0.2, "#43842b", 381);
    drawHillsLayer("#4f9631", 600, 3, 50, 2, 70, 5, 15, 0.3, "#3f7d28", 727);
    drawHillsLayer("#47892d", 750, 2, 80, 4, 40, 6, 25, 0.4, "#356f22", 1091);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.colorSpace = THREE.SRGBColorSpace;
  cachedHorizonHillsTexture = texture;
  return cachedHorizonHillsTexture;
}
