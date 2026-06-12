import * as THREE from "three";
import { configurePixelSpriteTexture } from "../../rendering/textures/pixelSpriteTexture";

export const CHICAGO_FACADE_STYLE_COUNT = 6;

let cachedChicagoWindowTexture: THREE.Texture | null = null;
let cachedChicagoFacadeTextures: THREE.Texture[] | null = null;
let cachedChicagoSignTexture: THREE.Texture | null = null;
let cachedChicagoLedSignTexture: THREE.Texture | null = null;
let cachedChicagoStoreSignTextures: THREE.Texture[] | null = null;
let cachedChicagoAdTextures: THREE.Texture[] | null = null;
let cachedChicagoFacadeMaterials: THREE.MeshBasicMaterial[] | null = null;

export function getChicagoWindowTexture() {
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

export function getChicagoFacadeTextures() {
  if (cachedChicagoFacadeTextures) return cachedChicagoFacadeTextures;
  cachedChicagoFacadeTextures = new Array<THREE.Texture>(CHICAGO_FACADE_STYLE_COUNT);
  for (let style = 0; style < CHICAGO_FACADE_STYLE_COUNT; style += 1) {
    cachedChicagoFacadeTextures[style] = makeChicagoFacadeTexture(style);
  }
  return cachedChicagoFacadeTextures;
}

export function getChicagoFacadeMaterials() {
  if (cachedChicagoFacadeMaterials) return cachedChicagoFacadeMaterials;
  const facadeTextures = getChicagoFacadeTextures();
  cachedChicagoFacadeMaterials = new Array<THREE.MeshBasicMaterial>(facadeTextures.length);
  for (let index = 0; index < facadeTextures.length; index += 1) {
    cachedChicagoFacadeMaterials[index] = new THREE.MeshBasicMaterial({ map: facadeTextures[index], color: "#ffffff" });
  }
  return cachedChicagoFacadeMaterials;
}

export function getChicagoSignTexture() {
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

export function getChicagoLedSignTexture() {
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

export function getChicagoStoreSignTextures() {
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

export function getChicagoAdTextures() {
  if (cachedChicagoAdTextures) return cachedChicagoAdTextures;

  cachedChicagoAdTextures = [
    makeChicagoTextTexture("SPELL\nCOLA", "#0f172a", "#67e8f9", "#f472b6", 192, 256),
    makeChicagoTextTexture("MANA\nMAX", "#312e81", "#fef3c7", "#a78bfa", 192, 256),
    makeChicagoTextTexture("WIZ\nNEWS", "#7f1d1d", "#f8fafc", "#fb7185", 192, 256),
    makeChicagoTextTexture("LAKE\nTOURS", "#075985", "#ecfeff", "#38bdf8", 192, 256),
  ];

  return cachedChicagoAdTextures;
}
