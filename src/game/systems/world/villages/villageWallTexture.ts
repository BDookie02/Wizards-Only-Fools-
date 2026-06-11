import * as THREE from "three";

let cachedVillageWallTexture: THREE.CanvasTexture | null = null;

export function getVillageWallTexture() {
  if (cachedVillageWallTexture) return cachedVillageWallTexture;

  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    ctx.fillStyle = "#1a1816";
    ctx.fillRect(0, 0, 512, 512);

    const rows = 12;
    const cols = 12;
    const cellWidth = 512 / cols;
    const cellHeight = 512 / rows;
    let seed = 42;
    const random = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    for (let row = -1; row <= rows; row += 1) {
      const rowOffset = (row % 2) * (cellWidth * 0.5) + (random() - 0.5) * (cellWidth * 0.2);

      for (let col = -1; col <= cols; col += 1) {
        const px = col * cellWidth + rowOffset;
        const py = row * cellHeight;
        const stoneWidth = cellWidth * 0.88;
        const stoneHeight = cellHeight * 0.88;
        const x = px + cellWidth * 0.06 + (random() - 0.5) * 4;
        const y = py + cellHeight * 0.06 + (random() - 0.5) * 4;
        const width = stoneWidth + (random() - 0.5) * 6;
        const height = stoneHeight + (random() - 0.5) * 6;
        const radius = Math.min(8 + random() * 4, width / 2, height / 2);

        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(x, y, width, height, radius);
        } else {
          ctx.rect(x, y, width, height);
        }

        const type = random();
        let red: number;
        let green: number;
        let blue: number;
        if (type > 0.8) {
          red = 140 + random() * 30;
          green = 125 + random() * 25;
          blue = 100 + random() * 20;
        } else {
          const lum = 90 + random() * 70;
          red = lum + (random() * 10 - 5);
          green = lum + (random() * 10 - 5);
          blue = lum + (random() * 10 - 5);
        }

        ctx.fillStyle = `rgb(${red}, ${green}, ${blue})`;
        ctx.fill();

        ctx.lineWidth = 1;
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.1 + random() * 0.1})`;
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(x + 1, y + 1, width - 2, height - 2, radius);
        } else {
          ctx.rect(x + 1, y + 1, width - 2, height - 2);
        }
        ctx.stroke();

        for (let i = 0; i < 8; i += 1) {
          ctx.fillStyle = random() > 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)";
          ctx.beginPath();
          ctx.arc(
            x + radius + random() * (width - radius * 2),
            y + radius + random() * (height - radius * 2),
            1 + random() * 3,
            0,
            Math.PI * 2,
          );
          ctx.fill();
        }
      }
    }

    for (let i = 0; i < 40; i += 1) {
      const mossX = random() * 512;
      const mossY = random() * 512;
      const mossRadius = 2 + random() * 4;
      const green = 70 + random() * 30;

      ctx.beginPath();
      ctx.arc(mossX, mossY, mossRadius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${30 + random() * 10}, ${green}, ${30 + random() * 20}, 0.6)`;
      ctx.fill();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(15, 15);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.colorSpace = THREE.SRGBColorSpace;
  cachedVillageWallTexture = texture;
  return cachedVillageWallTexture;
}
