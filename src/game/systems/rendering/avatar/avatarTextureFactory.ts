import * as THREE from "three";
import {
  AvatarAnimation,
  CharacterCustomization,
  DEFAULT_CHARACTER_CUSTOMIZATION,
} from "../../../../store/gameStore";

const AVATAR_BASE_SIZE = 64;
export const AVATAR_CANVAS_SIZE = 512;
const AVATAR_DETAIL_SCALE = AVATAR_CANVAS_SIZE / AVATAR_BASE_SIZE;
export const AVATAR_WORLD_HEIGHT = 2.95;
export const AVATAR_WORLD_WIDTH = AVATAR_WORLD_HEIGHT;
export const AVATAR_WORLD_CENTER_Y = 0.62;
const AVATAR_WORLD_FOOT_DROP = AVATAR_WORLD_HEIGHT / 2 - AVATAR_WORLD_CENTER_Y;

export const NPC_AVATAR_SCALE = 2.25;
export const NPC_AVATAR_GROUND_LIFT = (NPC_AVATAR_SCALE - 1) * AVATAR_WORLD_FOOT_DROP;

export type AvatarDrawOptions = {
  character?: Partial<CharacterCustomization>;
  direction?: number;
  animation?: AvatarAnimation | string;
  frame?: number;
  x?: number;
  y?: number;
  scale?: number;
  detailScale?: number;
  drawShadow?: boolean;
  isSpeaking?: boolean;
  isBlinking?: boolean;
};

const HEX_COLOR_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

export function normalizeCharacterCustomization(character?: Partial<CharacterCustomization>): CharacterCustomization {
  const normalized = {
    ...DEFAULT_CHARACTER_CUSTOMIZATION,
    ...(character ?? {}),
  };

  return {
    ...normalized,
    hatColor: normalized.topColor,
  };
}

function safeColor(value: string | undefined, fallback: string) {
  return value && HEX_COLOR_PATTERN.test(value) ? value : fallback;
}

function hexToRgb(color: string) {
  const safe = safeColor(color, "#ffffff").slice(1);
  const expanded = safe.length === 3
    ? `${safe[0]}${safe[0]}${safe[1]}${safe[1]}${safe[2]}${safe[2]}`
    : safe;

  return {
    r: parseInt(expanded.slice(0, 2), 16),
    g: parseInt(expanded.slice(2, 4), 16),
    b: parseInt(expanded.slice(4, 6), 16),
  };
}

function shadeColor(color: string, amount: number) {
  const rgb = hexToRgb(color);
  const mix = amount >= 0 ? 255 : 0;
  const strength = Math.abs(amount);
  const channel = (value: number) => Math.round(value + (mix - value) * strength).toString(16).padStart(2, "0");

  return `#${channel(rgb.r)}${channel(rgb.g)}${channel(rgb.b)}`;
}

function withAlpha(color: string, alpha: number) {
  const rgb = hexToRgb(color);
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

function drawBlock(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, color: string) {
  ctx.fillStyle = color;
  const snap = (value: number) => Math.round(value * 8) / 8;
  ctx.fillRect(snap(x), snap(y), Math.max(0.125, width), Math.max(0.125, height));
}

function getSegmentPixelSteps(dx: number, dy: number) {
  return Math.max(3, Math.ceil(Math.sqrt(dx * dx + dy * dy) / 4));
}

function drawPixelLine(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  color: string,
  thickness = 1,
) {
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * (thickness < 1 ? 2 : 1)));
  const offset = Math.floor(thickness / 2);

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    drawBlock(
      ctx,
      x0 + (x1 - x0) * t - offset,
      y0 + (y1 - y0) * t - offset,
      thickness,
      thickness,
      color,
    );
  }
}

function drawPixelEllipse(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  color: string,
) {
  const rows = Math.max(2, Math.round(height / 1.5));

  for (let row = 0; row < rows; row++) {
    const t = rows === 1 ? 0.5 : row / (rows - 1);
    const dy = (t - 0.5) * 2;
    const rowWidth = Math.max(2, width * Math.sqrt(Math.max(0, 1 - dy * dy * 0.88)));
    const rowHeight = height / rows;
    drawBlock(ctx, x + (width - rowWidth) / 2, y + row * rowHeight, rowWidth, rowHeight, color);
  }
}

function drawHair(
  ctx: CanvasRenderingContext2D,
  hairStyle: CharacterCustomization["hairStyle"],
  color: string,
  headX: number,
  headY: number,
  sideSign: number,
  isBack: boolean,
) {
  if (hairStyle === "none") return;

  if (hairStyle === "short") {
    drawBlock(ctx, headX - 9, headY + 3, 18, 4, color);
    drawBlock(ctx, headX - 10, headY + 7, 5, 9, shadeColor(color, -0.16));
    drawBlock(ctx, headX + 5, headY + 7, 5, 8, shadeColor(color, -0.12));
    return;
  }

  if (hairStyle === "bob") {
    drawBlock(ctx, headX - 10, headY + 4, 20, 5, color);
    drawBlock(ctx, headX - 12, headY + 8, 6, 16, shadeColor(color, -0.18));
    drawBlock(ctx, headX + 6, headY + 8, 6, 16, shadeColor(color, -0.18));
    drawBlock(ctx, headX - 7, headY + 22, 14, 4, shadeColor(color, -0.1));
    return;
  }

  if (hairStyle === "spikes") {
    drawBlock(ctx, headX - 10, headY + 7, 20, 5, color);
    drawBlock(ctx, headX - 8, headY + 1, 4, 8, color);
    drawBlock(ctx, headX - 2, headY - 1, 4, 9, shadeColor(color, 0.06));
    drawBlock(ctx, headX + 5, headY + 1, 4, 8, shadeColor(color, -0.08));
    return;
  }

  drawBlock(ctx, headX - 10, headY + 4, 20, 5, color);
  drawBlock(ctx, headX - 12, headY + 9, 5, 23, shadeColor(color, -0.16));
  drawBlock(ctx, headX + 7, headY + 9, 5, 23, shadeColor(color, -0.18));
  if (isBack) {
    drawBlock(ctx, headX - 8, headY + 18, 16, 17, shadeColor(color, -0.2));
  } else if (sideSign !== 0) {
    drawBlock(ctx, headX + sideSign * 3, headY + 18, 8, 15, shadeColor(color, -0.2));
  }
}

function drawHat(
  ctx: CanvasRenderingContext2D,
  hatStyle: CharacterCustomization["hatStyle"],
  color: string,
  headX: number,
  headY: number,
  sideSign: number,
  isBack: boolean,
  isSide: boolean,
) {
  if (hatStyle === "none") return;

  if (hatStyle === "cap") {
    drawBlock(ctx, headX - 11, headY + 2, 22, 5, color);
    drawBlock(ctx, headX - 6, headY - 2, 14, 5, shadeColor(color, 0.05));
    drawBlock(ctx, headX + 8, headY + 5, 7, 3, shadeColor(color, -0.1));
    return;
  }

  if (hatStyle === "hood") {
    drawPixelEllipse(ctx, headX - 13, headY + 0, 26, 25, shadeColor(color, -0.06));
    drawBlock(ctx, headX - 8, headY + 9, 16, 13, "#09090b");
    return;
  }

  if (hatStyle === "pharaoh") {
    const orient = sideSign === 0 ? 1 : -sideSign;
    const blue = safeColor(color, "#2563eb");
    const gold = "#facc15";
    const darkBlue = shadeColor(blue, -0.22);
    const deepBlue = shadeColor(blue, -0.38);
    const lightGold = "#fde68a";
    const hatBlock = (localX: number, localY: number, width: number, height: number, fill: string) => {
      const x = orient > 0 ? headX + localX : headX - localX - width;
      drawBlock(ctx, x, localY, width, height, fill);
    };

    if (isSide) {
      hatBlock(-13, headY + 1, 26, 5, gold);
      hatBlock(-9, headY - 3, 16, 5, lightGold);
      hatBlock(-13, headY + 7, 7, 22, darkBlue);
      hatBlock(5, headY + 7, 7, 22, blue);
      hatBlock(-11, headY + 11, 5, 3, gold);
      hatBlock(5, headY + 16, 5, 3, gold);
      hatBlock(1, headY - 7, 7, 5, blue);
      hatBlock(5, headY - 10, 4, 4, gold);
      return;
    }

    hatBlock(-16, headY + 1, 32, 5, gold);
    hatBlock(-11, headY - 4, 22, 6, lightGold);
    hatBlock(-15, headY + 7, 8, 23, darkBlue);
    hatBlock(7, headY + 7, 8, 23, deepBlue);
    hatBlock(-5, headY + 7, 5, 22, blue);
    hatBlock(1, headY + 7, 5, 22, darkBlue);
    hatBlock(-13, headY + 13, 6, 3, gold);
    hatBlock(7, headY + 13, 6, 3, gold);
    hatBlock(-1, headY - 8, 6, 5, blue);
    hatBlock(3, headY - 11, 3, 4, gold);
    if (!isBack) {
      hatBlock(-2, headY + 5, 5, 4, gold);
    }
    return;
  }

  if (hatStyle === "floppy-wizard") {
    const orient = sideSign === 0 ? 1 : -sideSign;
    const shade = shadeColor(color, -0.16);
    const deepShade = shadeColor(color, -0.34);
    const light = shadeColor(color, 0.16);
    const fold = shadeColor(color, -0.28);
    const brimY = headY + (isBack ? 6 : 5);
    const hatBlock = (localX: number, localY: number, width: number, height: number, fill: string) => {
      const x = orient > 0 ? headX + localX : headX - localX - width;
      drawBlock(ctx, x, localY, width, height, fill);
    };

    if (isSide) {
      hatBlock(-18, brimY + 3, 35, 5, deepShade);
      hatBlock(-16, brimY + 1, 29, 4, shade);
      hatBlock(5, brimY - 1, 24, 4, color);
      hatBlock(23, brimY - 2, 8, 2, light);
      hatBlock(-10, headY + 0, 19, 8, color);
      hatBlock(-7, headY - 3, 13, 7, shadeColor(color, 0.06));
      hatBlock(3, headY - 5, 13, 5, shade);
      hatBlock(13, headY - 6, 12, 4, shadeColor(color, -0.08));
      hatBlock(24, headY - 5, 9, 3, shade);
      hatBlock(31, headY - 4, 7, 2, deepShade);
      hatBlock(-4, headY + 2, 3, 8, fold);
      hatBlock(9, headY - 2, 3, 4, deepShade);
      return;
    }

    if (isBack) {
      hatBlock(-23, brimY + 3, 46, 5, deepShade);
      hatBlock(-20, brimY + 1, 40, 4, shade);
      hatBlock(-16, brimY - 1, 32, 3, color);
      hatBlock(-9, headY + 1, 18, 8, shade);
      hatBlock(-6, headY - 4, 13, 8, color);
      hatBlock(5, headY - 5, 14, 5, shade);
      hatBlock(17, headY - 4, 13, 3, shadeColor(color, -0.1));
      hatBlock(28, headY - 3, 9, 2, deepShade);
      hatBlock(-2, headY - 2, 2, 12, fold);
      hatBlock(11, headY - 3, 4, 4, deepShade);
      return;
    }

    hatBlock(-24, brimY + 4, 48, 5, deepShade);
    hatBlock(-21, brimY + 2, 42, 4, shade);
    hatBlock(-16, brimY, 34, 4, color);
    hatBlock(-25, brimY + 1, 11, 3, shadeColor(color, -0.1));
    hatBlock(13, brimY - 1, 18, 3, light);
    hatBlock(27, brimY - 1, 9, 2, shadeColor(color, 0.08));
    hatBlock(-10, headY + 0, 21, 8, color);
    hatBlock(-7, headY - 4, 15, 8, shadeColor(color, 0.06));
    hatBlock(5, headY - 6, 14, 6, shade);
    hatBlock(17, headY - 6, 14, 4, shadeColor(color, -0.08));
    hatBlock(29, headY - 5, 11, 3, shade);
    hatBlock(38, headY - 4, 7, 2, deepShade);
    hatBlock(-5, headY + 2, 3, 7, fold);
    hatBlock(11, headY - 3, 3, 4, deepShade);
    hatBlock(25, headY - 4, 2, 3, deepShade);
    return;
  }

  const orient = sideSign === 0 ? 1 : -sideSign;
  const hatBlock = (localX: number, localY: number, width: number, height: number, fill: string) => {
    const x = orient > 0 ? headX + localX : headX - localX - width;
    drawBlock(ctx, x, localY, width, height, fill);
  };
  hatBlock(-15, headY + 7, 30, 4, shadeColor(color, -0.18));
  hatBlock(-9, headY + 2, 19, 5, color);
  hatBlock(-5, headY - 5, 12, 7, shadeColor(color, 0.04));
  hatBlock(-1, headY - 13, 8, 8, shadeColor(color, 0.12));
  hatBlock(3, headY - 18, 5, 6, shadeColor(color, 0.18));
}

function drawEyeOval(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  width: number,
  height: number,
  fillColor: string,
  outlineColor: string,
  pupil: "left" | "center" | "right" | "tiny" | null = null,
) {
  drawPixelEllipse(ctx, centerX - width / 2, centerY - height / 2, width, height, outlineColor);
  drawPixelEllipse(ctx, centerX - width / 2 + 1, centerY - height / 2 + 1, Math.max(2, width - 2), Math.max(2, height - 2), fillColor);

  if (!pupil) return;

  const pupilOffset = pupil === "left" ? -2 : pupil === "right" ? 2 : 0;
  const pupilSize = pupil === "tiny" ? 2 : 3;
  drawBlock(ctx, centerX + pupilOffset - Math.floor(pupilSize / 2), centerY - Math.floor(pupilSize / 2), pupilSize, pupilSize + 1, outlineColor);
}

function drawClosedHappyEye(ctx: CanvasRenderingContext2D, centerX: number, centerY: number, color: string) {
  drawPixelLine(ctx, centerX - 6, centerY + 2, centerX - 3, centerY - 3, color, 2.25);
  drawPixelLine(ctx, centerX - 3, centerY - 3, centerX + 3, centerY - 3, color, 2.25);
  drawPixelLine(ctx, centerX + 3, centerY - 3, centerX + 6, centerY + 2, color, 2.25);
}

function drawHalfLiddedEye(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  width: number,
  fillColor: string,
  outlineColor: string,
  pupilOffset: number,
) {
  drawBlock(ctx, centerX - width / 2, centerY - 2, width, 2, outlineColor);
  drawBlock(ctx, centerX - width / 2 + 1, centerY, width - 1, 3, fillColor);
  drawBlock(ctx, centerX - width / 2, centerY + 2, width, 1, outlineColor);
  drawBlock(ctx, centerX + pupilOffset, centerY, 2, 2, outlineColor);
}

function drawTear(ctx: CanvasRenderingContext2D, x: number, y: number) {
  drawBlock(ctx, x, y, 3, 4, "#bae6fd");
  drawBlock(ctx, x - 1, y + 4, 5, 3, "#60a5fa");
  drawBlock(ctx, x, y + 7, 3, 3, "#38bdf8");
}

function drawMouth(
  ctx: CanvasRenderingContext2D,
  mouthStyle: CharacterCustomization["mouthStyle"],
  headX: number,
  mouthY: number,
  color: string,
) {
  if (mouthStyle === "smile") {
    drawBlock(ctx, headX - 4, mouthY, 2, 1, color);
    drawBlock(ctx, headX - 2, mouthY + 1, 6, 1, color);
  } else if (mouthStyle === "frown") {
    drawBlock(ctx, headX - 4, mouthY + 1, 2, 1, color);
    drawBlock(ctx, headX - 2, mouthY, 6, 1, color);
  } else if (mouthStyle === "open") {
    drawBlock(ctx, headX - 2, mouthY - 1, 5, 4, "#2b1010");
    drawBlock(ctx, headX - 1, mouthY + 2, 3, 1, "#fca5a5");
  } else {
    drawBlock(ctx, headX - 3, mouthY, 6, 1, color);
  }
}

function drawTalkingMouth(
  ctx: CanvasRenderingContext2D,
  headX: number,
  mouthY: number,
  color: string,
  frame: number,
) {
  const openFrame = frame % 4 === 1 || frame % 4 === 2;

  if (openFrame) {
    drawBlock(ctx, headX - 4, mouthY - 1, 8, 5, color);
    drawBlock(ctx, headX - 3, mouthY, 6, 4, "#2b1010");
    drawBlock(ctx, headX - 2, mouthY + 3, 4, 1, "#fca5a5");
    return;
  }

  drawBlock(ctx, headX - 5, mouthY, 10, 1.25, color);
  drawBlock(ctx, headX - 2, mouthY + 2, 4, 1, color);
}

function drawEyes(
  ctx: CanvasRenderingContext2D,
  character: CharacterCustomization,
  headX: number,
  headY: number,
  sideSign: number,
  isSleeping: boolean,
) {
  const eyeY = headY + 18;
  const eyeColor = "#171717";
  const skinColor = safeColor(character.skinColor, DEFAULT_CHARACTER_CUSTOMIZATION.skinColor);
  const eyeWhite = shadeColor(skinColor, 0.72);
  const eyeShadow = shadeColor(skinColor, -0.2);
  const leftEyeX = sideSign > 0 ? headX - 5 : headX - 8;
  const rightEyeX = sideSign < 0 ? headX + 5 : headX + 8;
  const eyeStyle = character.eyeStyle;

  if (isSleeping) {
    drawBlock(ctx, leftEyeX - 5, eyeY, 10, 1.25, eyeColor);
    drawBlock(ctx, rightEyeX - 5, eyeY, 10, 1.25, eyeColor);
  } else if (eyeStyle === "sleepy" || eyeStyle === "done") {
    drawHalfLiddedEye(ctx, leftEyeX, eyeY, 13, eyeWhite, eyeColor, -2);
    drawHalfLiddedEye(ctx, rightEyeX, eyeY, 13, eyeWhite, eyeColor, -2);
    drawBlock(ctx, leftEyeX - 6, eyeY + 3, 12, 1.5, withAlpha(eyeShadow, 0.55));
    drawBlock(ctx, rightEyeX - 6, eyeY + 3, 12, 1.5, withAlpha(eyeShadow, 0.55));
  } else if (eyeStyle === "content") {
    drawPixelLine(ctx, leftEyeX - 5, eyeY - 8, leftEyeX - 1, eyeY - 10, eyeColor, 1.25);
    drawPixelLine(ctx, rightEyeX + 1, eyeY - 10, rightEyeX + 5, eyeY - 8, eyeColor, 1.25);
    drawClosedHappyEye(ctx, leftEyeX, eyeY - 1, eyeColor);
    drawClosedHappyEye(ctx, rightEyeX, eyeY - 1, eyeColor);
    drawPixelLine(ctx, leftEyeX - 5, eyeY + 2, leftEyeX - 2, eyeY + 5, eyeColor, 1.5);
    drawPixelLine(ctx, leftEyeX - 2, eyeY + 5, leftEyeX + 4, eyeY + 5, eyeColor, 1.5);
    drawPixelLine(ctx, rightEyeX - 4, eyeY + 5, rightEyeX + 2, eyeY + 5, eyeColor, 1.5);
    drawPixelLine(ctx, rightEyeX + 2, eyeY + 5, rightEyeX + 5, eyeY + 2, eyeColor, 1.5);
  } else if (eyeStyle === "dull") {
    drawEyeOval(ctx, leftEyeX, eyeY, 12, 14, eyeWhite, eyeColor, null);
    drawEyeOval(ctx, rightEyeX, eyeY, 12, 14, eyeWhite, eyeColor, null);
    drawBlock(ctx, leftEyeX - 5, eyeY + 4, 10, 2.25, withAlpha(eyeShadow, 0.38));
    drawBlock(ctx, rightEyeX - 5, eyeY + 4, 10, 2.25, withAlpha(eyeShadow, 0.38));
  } else if (eyeStyle === "sus" || eyeStyle === "sus-shadow") {
    if (eyeStyle === "sus-shadow") {
      drawBlock(ctx, headX - 13, eyeY - 8, 26, 7, "rgba(88, 28, 135, 0.28)");
      drawBlock(ctx, headX - 11, eyeY - 1, 22, 4, "rgba(88, 28, 135, 0.2)");
    }
    drawPixelLine(ctx, leftEyeX - 7, eyeY - 6, leftEyeX - 1, eyeY - 8, eyeColor, 1.25);
    drawPixelLine(ctx, rightEyeX + 1, eyeY - 8, rightEyeX + 7, eyeY - 6, eyeColor, 1.25);
    drawHalfLiddedEye(ctx, leftEyeX, eyeY, 14, eyeWhite, eyeColor, eyeStyle === "sus-shadow" ? 2 : -3);
    drawHalfLiddedEye(ctx, rightEyeX, eyeY, 14, eyeWhite, eyeColor, eyeStyle === "sus-shadow" ? 2 : -3);
  } else if (eyeStyle === "terrified" || eyeStyle === "wide") {
    drawEyeOval(ctx, leftEyeX, eyeY, 13, 16, eyeWhite, eyeColor, "tiny");
    drawEyeOval(ctx, rightEyeX, eyeY, 13, 16, eyeWhite, eyeColor, "tiny");
    drawPixelLine(ctx, headX - 16, eyeY - 8, headX - 15, eyeY + 6, eyeColor, 1.25);
    drawPixelLine(ctx, headX + 16, eyeY - 8, headX + 15, eyeY + 6, eyeColor, 1.25);
    drawPixelLine(ctx, headX - 12, eyeY - 11, headX - 8, eyeY - 14, eyeColor, 1.25);
    drawPixelLine(ctx, headX + 8, eyeY - 14, headX + 12, eyeY - 11, eyeColor, 1.25);
  } else if (eyeStyle === "sad") {
    drawPixelLine(ctx, leftEyeX - 6, eyeY - 5, leftEyeX - 2, eyeY - 9, eyeColor, 1.25);
    drawPixelLine(ctx, rightEyeX + 2, eyeY - 9, rightEyeX + 6, eyeY - 5, eyeColor, 1.25);
    drawEyeOval(ctx, leftEyeX, eyeY, 12, 12, eyeWhite, eyeColor, "center");
    drawEyeOval(ctx, rightEyeX, eyeY, 12, 12, eyeWhite, eyeColor, "center");
    drawTear(ctx, leftEyeX - 9, eyeY + 4);
    drawTear(ctx, rightEyeX + 7, eyeY + 4);
  } else if (eyeStyle === "hard-shut") {
    drawPixelLine(ctx, leftEyeX - 7, eyeY - 6, leftEyeX + 5, eyeY, eyeColor, 2.5);
    drawPixelLine(ctx, leftEyeX - 7, eyeY + 5, leftEyeX + 5, eyeY, eyeColor, 2.5);
    drawPixelLine(ctx, rightEyeX + 7, eyeY - 6, rightEyeX - 5, eyeY, eyeColor, 2.5);
    drawPixelLine(ctx, rightEyeX + 7, eyeY + 5, rightEyeX - 5, eyeY, eyeColor, 2.5);
  } else if (eyeStyle === "happy") {
    drawEyeOval(ctx, leftEyeX, eyeY + 1, 13, 17, eyeWhite, eyeColor, null);
    drawEyeOval(ctx, rightEyeX, eyeY + 1, 13, 17, eyeWhite, eyeColor, null);
    drawBlock(ctx, leftEyeX - 2, eyeY - 4, 3, 3, "#ffffff");
    drawBlock(ctx, rightEyeX - 2, eyeY - 4, 3, 3, "#ffffff");
  } else if (eyeStyle === "nervous" || eyeStyle === "nervous-teary") {
    drawPixelLine(ctx, leftEyeX - 7, eyeY - 8, leftEyeX - 1, eyeY - 11, eyeColor, 1.25);
    drawPixelLine(ctx, rightEyeX + 1, eyeY - 11, rightEyeX + 7, eyeY - 8, eyeColor, 1.25);
    drawEyeOval(ctx, leftEyeX, eyeY, 13, 13, eyeWhite, eyeColor, eyeStyle === "nervous-teary" ? "center" : "right");
    drawEyeOval(ctx, rightEyeX, eyeY, 13, 13, eyeWhite, eyeColor, eyeStyle === "nervous-teary" ? "center" : "left");
    if (eyeStyle === "nervous-teary") {
      drawBlock(ctx, leftEyeX - 3, eyeY - 2, 3, 3, "#ffffff");
      drawBlock(ctx, rightEyeX - 3, eyeY - 2, 3, 3, "#ffffff");
      drawTear(ctx, rightEyeX + 7, eyeY + 5);
    }
  } else if (eyeStyle === "angry") {
    drawBlock(ctx, headX - 12, eyeY - 8, 24, 7, "rgba(239, 68, 68, 0.24)");
    drawPixelLine(ctx, leftEyeX - 7, eyeY - 6, leftEyeX + 5, eyeY + 2, eyeColor, 2.25);
    drawPixelLine(ctx, leftEyeX - 6, eyeY + 2, leftEyeX + 4, eyeY + 3, eyeWhite, 2.25);
    drawPixelLine(ctx, rightEyeX + 7, eyeY - 6, rightEyeX - 5, eyeY + 2, eyeColor, 2.25);
    drawPixelLine(ctx, rightEyeX + 6, eyeY + 2, rightEyeX - 4, eyeY + 3, eyeWhite, 2.25);
    drawPixelLine(ctx, leftEyeX - 1, eyeY - 3, headX - 1, eyeY + 2, eyeColor, 1.25);
    drawPixelLine(ctx, rightEyeX + 1, eyeY - 3, headX + 1, eyeY + 2, eyeColor, 1.25);
  } else {
    drawEyeOval(ctx, leftEyeX, eyeY, 12, 14, eyeWhite, eyeColor, null);
    drawEyeOval(ctx, rightEyeX, eyeY, 12, 14, eyeWhite, eyeColor, null);
  }

}

function drawSideEyes(
  ctx: CanvasRenderingContext2D,
  character: CharacterCustomization,
  headX: number,
  headY: number,
  sideSign: number,
  isSleeping: boolean,
) {
  const eyeY = headY + 19;
  const eyeX = headX + sideSign * 6;
  const eyeColor = "#171717";
  const skinColor = safeColor(character.skinColor, DEFAULT_CHARACTER_CUSTOMIZATION.skinColor);
  const eyeWhite = shadeColor(skinColor, 0.72);
  const style = character.eyeStyle;

  if (isSleeping) {
    drawBlock(ctx, eyeX - 5, eyeY, 10, 1.25, eyeColor);
  } else if (style === "content") {
    drawClosedHappyEye(ctx, eyeX, eyeY - 1, eyeColor);
  } else if (style === "sleepy" || style === "done" || style === "sus" || style === "sus-shadow") {
    if (style === "sus-shadow") {
      drawBlock(ctx, eyeX - 8, eyeY - 8, 16, 7, "rgba(88, 28, 135, 0.28)");
      drawBlock(ctx, eyeX - 7, eyeY - 1, 14, 3, "rgba(88, 28, 135, 0.2)");
    }
    drawHalfLiddedEye(ctx, eyeX, eyeY, 13, eyeWhite, eyeColor, sideSign > 0 ? 2 : -4);
  } else if (style === "terrified" || style === "wide") {
    drawEyeOval(ctx, eyeX, eyeY, 12, 15, eyeWhite, eyeColor, "tiny");
    drawPixelLine(ctx, eyeX + sideSign * 9, eyeY - 8, eyeX + sideSign * 10, eyeY + 6, eyeColor, 1.25);
  } else if (style === "sad") {
    drawPixelLine(ctx, eyeX - sideSign * 6, eyeY - 5, eyeX - sideSign, eyeY - 9, eyeColor, 1.25);
    drawEyeOval(ctx, eyeX, eyeY, 12, 12, eyeWhite, eyeColor, "center");
    drawTear(ctx, eyeX + sideSign * 7, eyeY + 4);
  } else if (style === "hard-shut") {
    drawPixelLine(ctx, eyeX - sideSign * 7, eyeY - 6, eyeX + sideSign * 5, eyeY, eyeColor, 2.5);
    drawPixelLine(ctx, eyeX - sideSign * 7, eyeY + 5, eyeX + sideSign * 5, eyeY, eyeColor, 2.5);
  } else if (style === "happy") {
    drawEyeOval(ctx, eyeX, eyeY + 1, 12, 16, eyeWhite, eyeColor, null);
    drawBlock(ctx, eyeX - 2, eyeY - 4, 3, 3, "#ffffff");
  } else if (style === "nervous" || style === "nervous-teary") {
    drawPixelLine(ctx, eyeX - sideSign * 7, eyeY - 8, eyeX - sideSign, eyeY - 11, eyeColor, 1.25);
    drawEyeOval(ctx, eyeX, eyeY, 12, 12, eyeWhite, eyeColor, style === "nervous-teary" ? "center" : sideSign > 0 ? "right" : "left");
    if (style === "nervous-teary") {
      drawBlock(ctx, eyeX - 3, eyeY - 2, 3, 3, "#ffffff");
      drawTear(ctx, eyeX + sideSign * 7, eyeY + 5);
    }
  } else if (style === "angry") {
    drawBlock(ctx, eyeX - 8, eyeY - 8, 16, 7, "rgba(239, 68, 68, 0.24)");
    drawPixelLine(ctx, eyeX - sideSign * 7, eyeY - 6, eyeX + sideSign * 5, eyeY + 2, eyeColor, 2.25);
    drawPixelLine(ctx, eyeX - sideSign * 6, eyeY + 2, eyeX + sideSign * 4, eyeY + 3, eyeWhite, 2.25);
  } else {
    drawEyeOval(ctx, eyeX, eyeY, style === "dull" ? 12 : 11, style === "dull" ? 14 : 13, eyeWhite, eyeColor, null);
  }

}

function drawFacialHair(
  ctx: CanvasRenderingContext2D,
  style: CharacterCustomization["facialHairStyle"],
  color: string,
  headX: number,
  headY: number,
  sideSign: number,
) {
  if (style === "none") return;

  if (style === "mustache" || style === "beard") {
    drawBlock(ctx, headX - 6 + sideSign, headY + 22, 5, 2, color);
    drawBlock(ctx, headX + 1 + sideSign, headY + 22, 5, 2, color);
  }

  if (style === "goatee" || style === "beard") {
    drawBlock(ctx, headX - 3 + sideSign, headY + 25, 6, 3, shadeColor(color, -0.08));
  }

  if (style === "beard") {
    drawBlock(ctx, headX - 8, headY + 25, 16, 5, shadeColor(color, -0.13));
  }
}

function drawArm(
  ctx: CanvasRenderingContext2D,
  shoulderX: number,
  shoulderY: number,
  handX: number,
  handY: number,
  skinColor: string,
  sleeveColor: string,
) {
  const dx = handX - shoulderX;
  const dy = handY - shoulderY;
  const steps = getSegmentPixelSteps(dx, dy);

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = shoulderX + dx * t;
    const y = shoulderY + dy * t;
    drawBlock(ctx, x - 2, y - 2, 4, 4, i < steps * 0.55 ? sleeveColor : skinColor);
  }

  drawPixelEllipse(ctx, handX - 3, handY - 2, 6, 5, skinColor);
}

function drawLeg(
  ctx: CanvasRenderingContext2D,
  hipX: number,
  hipY: number,
  footX: number,
  footY: number,
  pantsColor: string,
  shoesColor: string,
) {
  const dx = footX - hipX;
  const dy = footY - hipY;
  const steps = getSegmentPixelSteps(dx, dy);

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = hipX + dx * t;
    const y = hipY + dy * t;
    drawBlock(ctx, x - 2, y - 2, 4, 5, i < steps * 0.78 ? pantsColor : shoesColor);
  }

  drawBlock(ctx, footX - 4, footY + 1, 8, 3, shoesColor);
}

function drawSlideDust(ctx: CanvasRenderingContext2D, frame: number, directionSign: number) {
  const sign = directionSign || 1;
  const pulse = frame % 4;
  const baseX = 32 - sign * 10;
  const pulseWidth = pulse % 2;

  drawBlock(ctx, baseX - sign * (6 + pulse), 57, 2 + pulseWidth, 2, "rgba(206, 179, 130, 0.36)");
  drawBlock(ctx, baseX - sign * (12 + pulse * 2), 60, 3 + pulseWidth, 3, "rgba(206, 179, 130, 0.28)");
  drawBlock(ctx, baseX - sign * (18 + pulse), 55, 2 + pulseWidth, 2, "rgba(206, 179, 130, 0.22)");
  drawBlock(ctx, baseX - sign * (24 + pulse * 2), 61, 1 + pulseWidth, 1, "rgba(206, 179, 130, 0.18)");
}

function drawJumpTrail(ctx: CanvasRenderingContext2D, frame: number) {
  const pulse = frame % 4;
  const pulseY = pulse % 2;

  drawBlock(ctx, 23, 57 + pulseY, 2, 3, "rgba(165, 220, 255, 0.42)");
  drawBlock(ctx, 31, 59 - pulseY, 2, 2, "rgba(255, 255, 255, 0.34)");
  drawBlock(ctx, 39, 57 + ((pulse + 1) % 2), 2, 3, "rgba(165, 220, 255, 0.38)");
  drawBlock(ctx, 28, 62, 1, 2, "rgba(130, 185, 255, 0.3)");
  drawBlock(ctx, 36, 62, 1, 2, "rgba(130, 185, 255, 0.3)");
}

function drawCastingSpark(ctx: CanvasRenderingContext2D, x: number, y: number, frame: number) {
  const flicker = frame % 4;
  const glowColor = flicker % 2 === 0 ? "rgba(216, 180, 254, 0.75)" : "rgba(244, 114, 182, 0.68)";
  drawBlock(ctx, x - 2, y - 2, 4, 4, glowColor);
  drawBlock(ctx, x - 7 - flicker, y, 3, 2, "rgba(192, 132, 252, 0.62)");
  drawBlock(ctx, x + 5 + flicker, y - 1, 3, 2, "rgba(147, 197, 253, 0.58)");
  drawBlock(ctx, x - 1, y - 7 - (flicker % 2), 2, 3, "rgba(255, 255, 255, 0.72)");
}

export function drawPixelAvatarFrame(ctx: CanvasRenderingContext2D, options: AvatarDrawOptions = {}) {
  const character = normalizeCharacterCustomization(options.character);
  const direction = ((Math.round(options.direction ?? 0) % 8) + 8) % 8;
  const animation = (options.animation ?? "idle") as AvatarAnimation | string;
  const frame = options.frame ?? 0;
  const x = options.x ?? 0;
  const y = options.y ?? 0;
  const scale = options.scale ?? 1;
  const detailScale = options.detailScale ?? 1;
  const skinColor = safeColor(character.skinColor, DEFAULT_CHARACTER_CUSTOMIZATION.skinColor);
  const topColor = safeColor(character.topColor, DEFAULT_CHARACTER_CUSTOMIZATION.topColor);
  const pantsColor = safeColor(character.pantsColor, DEFAULT_CHARACTER_CUSTOMIZATION.pantsColor);
  const shoesColor = safeColor(character.shoesColor, DEFAULT_CHARACTER_CUSTOMIZATION.shoesColor);
  const hatColor = safeColor(character.hatColor, DEFAULT_CHARACTER_CUSTOMIZATION.hatColor);
  const hairColor = safeColor(character.hairColor, DEFAULT_CHARACTER_CUSTOMIZATION.hairColor);
  const facialHairColor = safeColor(character.facialHairColor, DEFAULT_CHARACTER_CUSTOMIZATION.facialHairColor);
  const sideSign = direction === 1 || direction === 2 || direction === 3 ? 1 : direction === 5 || direction === 6 || direction === 7 ? -1 : 0;
  const isBack = direction === 3 || direction === 4 || direction === 5;
  const isFront = direction === 0 || direction === 1 || direction === 7;
  const isSide = direction === 2 || direction === 6;
  const isWalking = animation === "walk";
  const isSprinting = animation === "sprint";
  const isJumping = animation === "jump";
  const isSliding = animation === "slide";
  const isCrouching = animation === "crouch" || animation === "crouchwalk";
  const isCrouchWalking = animation === "crouchwalk";
  const isCasting = animation === "casting";
  const isStartled = animation === "startled";
  const isAngry = animation === "angry";
  const isHolding = animation === "holding" || animation === "idle";
  const isSleeping = animation === "sleep";
  const isMeditating = animation === "meditate";
  const isDamaged = animation === "damaged";
  const isSpeaking = Boolean(options.isSpeaking && !isSleeping && !isMeditating && !isDamaged);
  const isBlinking = Boolean(options.isBlinking && !isSleeping && !isMeditating && !isDamaged);
  const motionFrame = frame % 4;
  const walkStep = motionFrame === 0 ? -3 : motionFrame === 1 ? -1 : motionFrame === 2 ? 3 : 1;
  const sprintStep = motionFrame === 0 ? -5 : motionFrame === 1 ? 2 : motionFrame === 2 ? 5 : -2;
  const stride = isSprinting ? sprintStep : isWalking ? walkStep : 0;
  const jumpFloat = isJumping ? Math.sin((motionFrame / 4) * Math.PI * 2) : 0;
  const startleLift = isStartled ? -5 + (motionFrame % 2 === 0 ? -2 : 0) : 0;
  const crouchBob = isCrouchWalking ? (motionFrame % 2 === 0 ? -1 : 1) : 0;
  const bodyLift = isMeditating ? 11 : isJumping ? -8 + jumpFloat * 2 : isCrouching ? 12 + crouchBob : isSliding ? 9 : isSprinting ? (motionFrame % 2 === 0 ? -2 : 1) : isWalking ? (motionFrame % 2 === 1 ? -1 : 0) : startleLift;
  const sleepLean = isSleeping ? 4 : 0;
  const slideSign = sideSign || 1;
  const slideLean = isSliding ? slideSign * 6 : 0;
  const crouchLean = isCrouching ? slideSign * 2 : 0;
  const walkLean = isWalking && isSide ? sideSign * (motionFrame < 2 ? 1 : -1) : 0;
  const sprintLean = isSprinting && !isSide ? (motionFrame < 2 ? 1 : -1) : 0;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale * detailScale, scale * detailScale);
  ctx.imageSmoothingEnabled = false;

  if (options.drawShadow !== false) {
    if (isSliding) {
      drawPixelEllipse(ctx, 8, 59, 48, 4, "rgba(0, 0, 0, 0.26)");
      drawSlideDust(ctx, frame, slideSign);
    } else if (isCrouching) {
      drawPixelEllipse(ctx, 7, 59, 50, 4, "rgba(0, 0, 0, 0.28)");
    } else if (isMeditating) {
      drawPixelEllipse(ctx, 9, 56, 46, 7, "rgba(168, 85, 247, 0.28)");
      drawPixelEllipse(ctx, 13, 58, 38, 4, "rgba(0, 0, 0, 0.2)");
    } else if (isJumping) {
      drawPixelEllipse(ctx, 20, 59, 24, 4, "rgba(0, 0, 0, 0.16)");
      drawJumpTrail(ctx, frame);
    } else if (isSprinting) {
      drawPixelEllipse(ctx, 15, 57, 34, 5, "rgba(0, 0, 0, 0.23)");
    } else {
      drawPixelEllipse(ctx, 18, 56, 28, 5, "rgba(0, 0, 0, 0.25)");
    }
  }

  const torsoX = 32 + sideSign * (isSide ? 1 : 0) + slideLean + crouchLean + sprintLean + walkLean;
  const torsoY = 32 + bodyLift + sleepLean;
  const headX = 32 + sideSign * 2 + slideLean + (isSliding ? slideSign * 5 : isCrouching ? slideSign * 4 : 0);
  const headY = 6 + bodyLift + sleepLean + (isSliding ? 8 : isCrouching ? 8 : isJumping ? -1 : 0);
  const headWidth = 27;
  const headHeight = 27;
  const headLeft = headX - headWidth / 2;
  const headRight = headX + headWidth / 2;
  const lightSkin = shadeColor(skinColor, 0.16);
  const darkSkin = shadeColor(skinColor, -0.18);
  const sleeveColor = character.topStyle === "vest" ? skinColor : topColor;
  const pantsShade = shadeColor(pantsColor, -0.16);
  const topShade = shadeColor(topColor, -0.14);

  const rearLegOffset = isBack ? -sideSign : sideSign;
  if (isMeditating) {
    const kneeY = torsoY + 22;
    drawLeg(ctx, torsoX - 4, torsoY + 16, torsoX + 14, kneeY, pantsShade, shoesColor);
    drawLeg(ctx, torsoX + 4, torsoY + 16, torsoX - 14, kneeY + 1, pantsColor, shadeColor(shoesColor, -0.08));
    drawBlock(ctx, torsoX + 11, kneeY + 1, 8, 3, shoesColor);
    drawBlock(ctx, torsoX - 19, kneeY + 2, 8, 3, shadeColor(shoesColor, -0.1));
  } else if (isCrouching) {
    const crawl = isCrouchWalking ? (motionFrame < 2 ? 2 : -2) : 0;
    drawLeg(ctx, torsoX - 6, torsoY + 13, torsoX - 23 - crawl, 58, pantsShade, shadeColor(shoesColor, -0.1));
    drawLeg(ctx, torsoX + 6, torsoY + 13, torsoX + 20 + crawl, 58, pantsColor, shoesColor);
    drawBlock(ctx, torsoX - 29 - crawl, 58, 11, 3, shadeColor(shoesColor, -0.12));
    drawBlock(ctx, torsoX + 16 + crawl, 58, 11, 3, shoesColor);
  } else if (isSliding) {
    drawLeg(ctx, torsoX - 5, torsoY + 15, torsoX - slideSign * 20, 57, pantsShade, shadeColor(shoesColor, -0.1));
    drawLeg(ctx, torsoX + 4, torsoY + 15, torsoX + slideSign * 12, 54, pantsColor, shoesColor);
    drawBlock(ctx, torsoX - slideSign * 25, 55, 7, 3, shadeColor(shoesColor, -0.12));
    drawBlock(ctx, torsoX + slideSign * 10, 52, 7, 3, shoesColor);
  } else if (isJumping) {
    const hoverSway = motionFrame === 1 ? 1 : motionFrame === 3 ? -1 : 0;
    const legSpread = isSide ? 2 : 4;
    const trailingDrift = sideSign * 3;
    const footY = torsoY + 29;
    drawLeg(ctx, torsoX - 4, torsoY + 18, torsoX - legSpread + trailingDrift + hoverSway, footY, pantsShade, shoesColor);
    drawLeg(ctx, torsoX + 4, torsoY + 18, torsoX + legSpread + trailingDrift + hoverSway, footY + 1, pantsColor, shadeColor(shoesColor, -0.08));
  } else {
    const sprintFootLift = isSprinting ? (motionFrame === 0 ? -5 : motionFrame === 2 ? 2 : 0) : 0;
    const sprintRearLift = isSprinting ? (motionFrame === 2 ? -5 : motionFrame === 0 ? 2 : 0) : 0;
    const walkLeftLift = isWalking && motionFrame === 1 ? -4 : 0;
    const walkRightLift = isWalking && motionFrame === 3 ? -4 : 0;
    const walkLeftReach = isWalking && isSide ? sideSign * (motionFrame === 0 ? 2 : motionFrame === 2 ? -2 : 0) : 0;
    const walkRightReach = isWalking && isSide ? sideSign * (motionFrame === 2 ? 2 : motionFrame === 0 ? -2 : 0) : 0;
    drawLeg(ctx, torsoX - 4, torsoY + 18, torsoX - 7 + stride + rearLegOffset + walkLeftReach, 55 + bodyLift + sprintFootLift + walkLeftLift, pantsShade, shoesColor);
    drawLeg(ctx, torsoX + 4, torsoY + 18, torsoX + 7 - stride - rearLegOffset + walkRightReach, 55 + bodyLift + sprintRearLift + walkRightLift, pantsColor, shadeColor(shoesColor, -0.08));
  }

  if (character.pantsStyle === "skirt" || character.pantsStyle === "robe") {
    drawBlock(ctx, torsoX - 10, torsoY + 12, 20, 16, character.pantsStyle === "robe" ? topShade : pantsColor);
  } else if (character.pantsStyle === "shorts") {
    drawBlock(ctx, torsoX - 9, torsoY + 16, 18, 7, pantsColor);
  }

  const leftShoulderX = torsoX - 9;
  const rightShoulderX = torsoX + 9;
  const shoulderY = torsoY + 5;
  const castPulse = isCasting ? (motionFrame === 1 || motionFrame === 2 ? -2 : 1) : 0;
  const holdForward = isHolding ? 2 : 0;
  const jumpRaise = isJumping ? -12 : 0;
  const armSwing = isSprinting ? -stride * 1.35 : isWalking ? -stride * 1.55 : 0;

  if (isMeditating) {
    drawArm(ctx, leftShoulderX, shoulderY, torsoX - 15, torsoY + 23, skinColor, sleeveColor);
    drawArm(ctx, rightShoulderX, shoulderY, torsoX + 15, torsoY + 23, skinColor, sleeveColor);
    drawBlock(ctx, torsoX - 19, torsoY + 22, 5, 3, withAlpha(skinColor, 0.95));
    drawBlock(ctx, torsoX + 14, torsoY + 22, 5, 3, withAlpha(skinColor, 0.95));
  } else if (isSliding) {
    drawArm(ctx, leftShoulderX, shoulderY, torsoX - slideSign * 14, torsoY + 17, skinColor, sleeveColor);
    drawArm(ctx, rightShoulderX, shoulderY, torsoX + slideSign * 17, torsoY + 13, skinColor, sleeveColor);
  } else if (isCrouching) {
    const crawl = isCrouchWalking ? (motionFrame % 2 === 0 ? 2 : -2) : 0;
    if (isSide) {
      drawArm(ctx, leftShoulderX, shoulderY, torsoX + sideSign * (24 + crawl), 58, skinColor, sleeveColor);
      drawArm(ctx, rightShoulderX, shoulderY, torsoX + sideSign * (12 - crawl), 57, skinColor, sleeveColor);
      drawPixelEllipse(ctx, torsoX + sideSign * (24 + crawl) - 4, 57, 8, 5, skinColor);
    } else {
      drawArm(ctx, leftShoulderX, shoulderY, torsoX - 22 - crawl, 57, skinColor, sleeveColor);
      drawArm(ctx, rightShoulderX, shoulderY, torsoX + 22 + crawl, 57, skinColor, sleeveColor);
      drawPixelEllipse(ctx, torsoX - 26 - crawl, 56, 8, 5, skinColor);
      drawPixelEllipse(ctx, torsoX + 18 + crawl, 56, 8, 5, skinColor);
    }
  } else if (isStartled) {
    drawArm(ctx, leftShoulderX, shoulderY, torsoX - 18 - sideSign * 2, torsoY - 6 + (motionFrame % 2), skinColor, sleeveColor);
    drawArm(ctx, rightShoulderX, shoulderY, torsoX + 18 - sideSign * 2, torsoY - 7 - (motionFrame % 2), skinColor, sleeveColor);
  } else if (isCasting) {
    if (isSide) {
      const handX = torsoX + sideSign * 25;
      const offHandX = torsoX + sideSign * 18;
      drawArm(ctx, leftShoulderX, shoulderY, offHandX, torsoY + 13 + castPulse, skinColor, sleeveColor);
      drawArm(ctx, rightShoulderX, shoulderY, handX, torsoY + 8 + castPulse, skinColor, sleeveColor);
      drawCastingSpark(ctx, handX, torsoY + 8 + castPulse, frame);
    } else if (isBack) {
      drawArm(ctx, leftShoulderX, shoulderY, torsoX - 20, torsoY + 10 + castPulse, skinColor, sleeveColor);
      drawArm(ctx, rightShoulderX, shoulderY, torsoX + 20, torsoY + 10 + castPulse, skinColor, sleeveColor);
      drawCastingSpark(ctx, torsoX - 20, torsoY + 10 + castPulse, frame);
      drawCastingSpark(ctx, torsoX + 20, torsoY + 10 + castPulse, frame + 1);
    } else {
      const reach = isFront ? 23 : 20;
      drawArm(ctx, leftShoulderX, shoulderY, torsoX - reach, torsoY + 12 + castPulse, skinColor, sleeveColor);
      drawArm(ctx, rightShoulderX, shoulderY, torsoX + reach, torsoY + 11 + castPulse, skinColor, sleeveColor);
      drawCastingSpark(ctx, torsoX - reach, torsoY + 12 + castPulse, frame);
      drawCastingSpark(ctx, torsoX + reach, torsoY + 11 + castPulse, frame + 1);
    }
  } else if (isBack) {
    drawArm(ctx, leftShoulderX, shoulderY, torsoX - 17 + armSwing, torsoY + 22 + holdForward + jumpRaise, skinColor, sleeveColor);
    drawArm(ctx, rightShoulderX, shoulderY, torsoX + 17 - armSwing, torsoY + 22 + holdForward + jumpRaise, skinColor, sleeveColor);
  } else {
    drawArm(ctx, leftShoulderX, shoulderY, torsoX - 17 - armSwing, torsoY + 21 + holdForward + jumpRaise, skinColor, sleeveColor);
    drawArm(ctx, rightShoulderX, shoulderY, torsoX + 17 + armSwing, torsoY + 21 + holdForward + jumpRaise, skinColor, sleeveColor);
  }

  if (character.topStyle === "robe") {
    drawBlock(ctx, torsoX - 9, torsoY + 3, 18, 26, topColor);
    drawBlock(ctx, torsoX - 2, torsoY + 4, 4, 25, shadeColor(topColor, 0.1));
  } else {
    drawBlock(ctx, torsoX - 10, torsoY + 2, 20, 19, topColor);
    if (character.topStyle === "vest") {
      drawBlock(ctx, torsoX - 7, torsoY + 4, 5, 16, shadeColor(topColor, -0.05));
      drawBlock(ctx, torsoX + 2, torsoY + 4, 5, 16, shadeColor(topColor, -0.12));
      drawBlock(ctx, torsoX - 2, torsoY + 4, 4, 15, skinColor);
    } else if (character.topStyle === "tunic") {
      drawBlock(ctx, torsoX - 12, torsoY + 18, 24, 7, topShade);
    }
  }

  drawBlock(ctx, torsoX - 8, torsoY + 2, 16, 3, shadeColor(topColor, 0.16));
  drawBlock(ctx, torsoX + 6, torsoY + 5, 3, 13, topShade);

  if (isBack) {
    drawPixelEllipse(ctx, headLeft, headY + 2, headWidth, headHeight, skinColor);
    drawBlock(ctx, headX + 9, headY + 8, 4, 14, darkSkin);
  } else if (isSide) {
    drawPixelEllipse(ctx, headLeft, headY + 2, headWidth, headHeight, skinColor);
    drawBlock(ctx, headX + sideSign * 11, headY + 17, 5, 4, darkSkin);
    drawBlock(ctx, headX - sideSign * 9, headY + 9, 4, 10, lightSkin);
  } else {
    drawPixelEllipse(ctx, headLeft, headY + 2, headWidth, headHeight, skinColor);
    drawBlock(ctx, headX - 12, headY + 8, 6, 10, lightSkin);
    drawBlock(ctx, headX + 10, headY + 10, 5, 12, darkSkin);
  }

  if (!isBack) {
    drawBlock(ctx, headLeft - 3, headY + 15, 4, 7, darkSkin);
    drawBlock(ctx, headRight - 1, headY + 15, 4, 7, darkSkin);
  } else {
    drawBlock(ctx, headLeft - 2, headY + 16, 3, 6, shadeColor(skinColor, -0.2));
    drawBlock(ctx, headRight - 1, headY + 16, 3, 6, shadeColor(skinColor, -0.2));
  }

  drawHair(ctx, character.hairStyle, hairColor, headX, headY, sideSign, isBack);
  drawHat(ctx, character.hatStyle, hatColor, headX, headY, sideSign, isBack, isSide);

  if (!isBack) {
    const faceLineColor = "#171717";
    const faceCharacter = isDamaged
      ? { ...character, eyeStyle: "hard-shut" as CharacterCustomization["eyeStyle"] }
      : isMeditating
        ? { ...character, eyeStyle: "content" as CharacterCustomization["eyeStyle"], mouthStyle: "neutral" as CharacterCustomization["mouthStyle"] }
      : isStartled
        ? { ...character, eyeStyle: "terrified" as CharacterCustomization["eyeStyle"], mouthStyle: "open" as CharacterCustomization["mouthStyle"] }
        : isAngry
          ? { ...character, eyeStyle: "angry" as CharacterCustomization["eyeStyle"], mouthStyle: "frown" as CharacterCustomization["mouthStyle"] }
      : character;
    const faceSleeping = isSleeping && !isDamaged;
    const faceClosed = faceSleeping || isBlinking || (isMeditating && frame < 2);

    if (isSide) {
      drawSideEyes(ctx, faceCharacter, headX, headY, sideSign, faceClosed);
      if (isSpeaking) {
        drawTalkingMouth(ctx, headX + sideSign * 4, headY + 26, faceLineColor, frame);
      } else {
        drawMouth(ctx, faceCharacter.mouthStyle, headX + sideSign * 4, headY + 26, faceLineColor);
      }
      drawFacialHair(ctx, character.facialHairStyle, facialHairColor, headX + sideSign * 2, headY, sideSign);
    } else {
      drawEyes(ctx, faceCharacter, headX, headY, sideSign, faceClosed);
      if (isSpeaking) {
        drawTalkingMouth(ctx, headX, headY + 25, faceLineColor, frame);
      } else {
        drawMouth(ctx, faceCharacter.mouthStyle, headX, headY + 25, faceLineColor);
      }
      drawFacialHair(ctx, character.facialHairStyle, facialHairColor, headX, headY, sideSign);
    }
  }

  if (isDamaged) {
    drawBlock(ctx, headX - 18, headY - 4, 36, 34, "rgba(239, 68, 68, 0.18)");
    drawBlock(ctx, torsoX - 5, torsoY - 2, 18, 22, "rgba(127, 29, 29, 0.16)");
    drawBlock(ctx, headX + 11, headY + 11, 5, 3, "#ef4444");
  }

  if (isSleeping) {
    drawBlock(ctx, 45, 6, 7, 2, "#bae6fd");
    drawBlock(ctx, 51, 3, 7, 2, "#bae6fd");
    drawBlock(ctx, 48, 10, 9, 2, "#60a5fa");
  }

  if (isMeditating) {
    const pulse = frame % 4;
    drawBlock(ctx, 9 - pulse, 50, 46 + pulse * 2, 1.5, "rgba(216, 180, 254, 0.55)");
    drawBlock(ctx, 13, 53 + pulse, 38, 1, "rgba(147, 51, 234, 0.45)");
    drawBlock(ctx, 29, 47 - (pulse % 2), 6, 2, "rgba(255, 255, 255, 0.54)");
  }

  ctx.restore();
}

export function getAvatarDirection(playerYaw: number, worldPosition: THREE.Vector3, camera: THREE.Camera) {
  const toCamera = Math.atan2(camera.position.x - worldPosition.x, -(camera.position.z - worldPosition.z));
  const relative = THREE.MathUtils.euclideanModulo(toCamera - playerYaw + Math.PI * 2, Math.PI * 2);
  return Math.round(relative / (Math.PI / 4)) % 8;
}

export function getFrameDelay(animation: string, isSpeaking = false) {
  if (isSpeaking) return 110;
  if (animation === "sprint" || animation === "slide") return 70;
  if (animation === "crouchwalk") return 135;
  if (animation === "crouch") return 220;
  if (animation === "startled") return 85;
  if (animation === "jump") return 95;
  if (animation === "walk" || animation === "casting" || animation === "grabbed") return 120;
  if (animation === "meditate") return 520;
  if (animation === "sleep" || animation === "damaged") return 360;
  return 210;
}

export const AVATAR_ALPHA_TEST = 0.12;
const AVATAR_TEXTURE_CACHE_LIMIT = 384;
const avatarTextureCache = new Map<string, THREE.CanvasTexture>();

function getAvatarTextureKey(
  character: Partial<CharacterCustomization> | undefined,
  animation: string,
  direction: number,
  frame: number,
  isSpeaking: boolean,
  isBlinking: boolean,
) {
  return JSON.stringify([
    character ?? null,
    animation,
    direction,
    frame,
    isSpeaking ? 1 : 0,
    isBlinking ? 1 : 0,
  ]);
}

export function createAvatarTexture(
  character: Partial<CharacterCustomization> | undefined,
  animation: string,
  direction: number,
  frame: number,
  isSpeaking = false,
  isBlinking = false,
) {
  const cacheKey = getAvatarTextureKey(character, animation, direction, frame, isSpeaking, isBlinking);
  const cached = avatarTextureCache.get(cacheKey);
  if (cached) return cached;

  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_CANVAS_SIZE;
  canvas.height = AVATAR_CANVAS_SIZE;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawPixelAvatarFrame(ctx, {
      character,
      animation,
      direction,
      frame,
      isSpeaking,
      isBlinking,
      detailScale: AVATAR_DETAIL_SCALE,
      drawShadow: false,
    });
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  avatarTextureCache.set(cacheKey, texture);
  if (avatarTextureCache.size > AVATAR_TEXTURE_CACHE_LIMIT) {
    const oldestKey = avatarTextureCache.keys().next().value;
    if (oldestKey) {
      avatarTextureCache.get(oldestKey)?.dispose();
      avatarTextureCache.delete(oldestKey);
    }
  }
  return texture;
}
