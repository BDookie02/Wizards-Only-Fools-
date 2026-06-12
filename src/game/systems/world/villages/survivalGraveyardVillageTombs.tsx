import { Fragment, useMemo } from "react";
import * as THREE from "three";
import { configurePixelSpriteTexture } from "../../rendering/textures/pixelSpriteTexture";
import { clamp01, smoothstepRange, survivalHash01 } from "../survival/survivalMath";
import type { GraveyardTomb } from "./survivalGraveyardVillageLayout";

const GRAVEYARD_TOMB_SIDE_SIGNS = [-1, 1] as const;
const GRAVEYARD_TOMB_TEXTURE_CHIP_RECTS: Array<[number, number, number, number]> = [
  [10, 14, 24, 8],
  [214, 14, 32, 10],
  [10, 118, 18, 20],
  [220, 124, 26, 14],
];

const graveyardTombTextureCache = new Map<string, THREE.Texture>();
const graveyardStoneTextureCache = new Map<string, THREE.Texture>();

function mixGraveyardStoneColor(baseHex: string, targetHex: string, amount: number) {
  return new THREE.Color(baseHex).lerp(new THREE.Color(targetHex), clamp01(amount)).getStyle();
}

function makeGraveyardStoneTexture(baseHex: string, variant: number, role: "body" | "dark" | "accent" | "foundation") {
  const seed = Math.round(variant * 10000);
  const cacheKey = `${baseHex}|${seed}|${role}`;
  const cached = graveyardStoneTextureCache.get(cacheKey);
  if (cached) return cached;

  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    ctx.imageSmoothingEnabled = false;
    const highlight = mixGraveyardStoneColor(baseHex, role === "foundation" ? "#62705b" : "#efe6d2", role === "dark" ? 0.14 : 0.28);
    const midtone = mixGraveyardStoneColor(baseHex, role === "foundation" ? "#2f3a29" : "#8a8378", role === "accent" ? 0.22 : 0.16);
    const shadow = mixGraveyardStoneColor(baseHex, role === "foundation" ? "#0b0d09" : "#171512", role === "dark" ? 0.42 : 0.32);
    const moss = role === "foundation" ? "#4a5c33" : "#4f6741";
    const lichen = role === "dark" ? "#74776b" : "#cad0b1";

    ctx.fillStyle = baseHex;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < canvas.height; y += 2) {
      for (let x = 0; x < canvas.width; x += 2) {
        const grain = survivalHash01(x + seed, y - seed, 12480);
        const vein = Math.sin((x + seed * 0.017) * 0.16 + y * 0.045) + Math.cos((y - seed * 0.013) * 0.12 - x * 0.055);
        const damp = smoothstepRange(54, 126, y) * survivalHash01(x - seed, y + seed, 12481);

        if (vein > 1.18) {
          ctx.fillStyle = midtone;
          ctx.fillRect(x, y, 2, 2);
        } else if (grain > 0.91) {
          ctx.fillStyle = highlight;
          ctx.fillRect(x, y, 2, 2);
        } else if (grain < 0.1) {
          ctx.fillStyle = shadow;
          ctx.fillRect(x, y, 2, 2);
        } else if (damp > 0.78) {
          ctx.fillStyle = moss;
          ctx.fillRect(x, y, 2, 2);
        }
      }
    }

    for (let y = 10; y < canvas.height; y += 14 + Math.floor(survivalHash01(seed, y, 12482) * 7)) {
      ctx.fillStyle = "rgba(18, 16, 13, 0.18)";
      ctx.fillRect(0, y, canvas.width, 2);
      if (survivalHash01(seed, y, 12483) > 0.44) {
        ctx.fillStyle = "rgba(238, 232, 216, 0.14)";
        ctx.fillRect(0, y + 2, canvas.width, 2);
      }
    }

    for (let crack = 0; crack < 4; crack += 1) {
      let x = Math.floor(survivalHash01(seed, crack, 12484) * canvas.width);
      let y = Math.floor(survivalHash01(crack, seed, 12485) * 56) + 8;
      const length = 18 + Math.floor(survivalHash01(seed + crack, seed - crack, 12486) * 42);
      const drift = survivalHash01(crack, seed, 12487) > 0.5 ? 2 : -2;

      for (let step = 0; step < length; step += 4) {
        ctx.fillStyle = shadow;
        ctx.fillRect(Math.max(0, Math.min(canvas.width - 2, x)), Math.max(0, Math.min(canvas.height - 4, y)), 2, 4);
        if (step % 12 === 0) {
          ctx.fillStyle = "rgba(236, 228, 207, 0.18)";
          ctx.fillRect(Math.max(0, Math.min(canvas.width - 2, x + 2)), Math.max(0, Math.min(canvas.height - 2, y)), 2, 2);
        }
        x += (survivalHash01(x + seed, y - seed, 12488) > 0.52 ? drift : 0);
        y += 4;
      }
    }

    for (let chip = 0; chip < 12; chip += 1) {
      const side = survivalHash01(seed, chip, 12489);
      const width = 4 + Math.floor(survivalHash01(chip, seed, 12490) * 12);
      const height = 2 + Math.floor(survivalHash01(seed + chip, chip, 12491) * 7);
      const x = side < 0.34 ? 0 : side < 0.68 ? canvas.width - width : Math.floor(survivalHash01(chip, seed, 12492) * (canvas.width - width));
      const y = side >= 0.68 ? 0 : Math.floor(survivalHash01(seed, chip, 12493) * (canvas.height - height));

      ctx.fillStyle = shadow;
      ctx.fillRect(x, y, width, height);
      ctx.fillStyle = "rgba(244, 238, 221, 0.2)";
      ctx.fillRect(Math.min(canvas.width - 2, x + 1), Math.min(canvas.height - 2, y + height), Math.max(2, width - 2), 2);
    }

    for (let spot = 0; spot < 14; spot += 1) {
      const x = Math.floor(survivalHash01(seed + spot, spot, 12494) * 120);
      const y = 58 + Math.floor(survivalHash01(spot, seed - spot, 12495) * 66);
      const size = 2 + Math.floor(survivalHash01(seed, spot, 12496) * 7);
      ctx.fillStyle = survivalHash01(spot, seed, 12497) > 0.5 ? moss : lichen;
      ctx.fillRect(x, y, size, 2);
      ctx.fillRect(x + 2, y + 2, Math.max(2, size - 2), 2);
    }
  }

  const texture = configurePixelSpriteTexture(new THREE.CanvasTexture(canvas));
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(role === "foundation" ? 1.45 : 1.1, role === "foundation" ? 1.25 : 1.0);
  texture.needsUpdate = true;
  graveyardStoneTextureCache.set(cacheKey, texture);
  return texture;
}

function makeGraveyardTombTextTexture(name: string, joke: string, variant: number) {
  const cacheKey = `${name}|${joke}|${variant}`;
  const cached = graveyardTombTextureCache.get(cacheKey);
  if (cached) return cached;

  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 160;
  const ctx = canvas.getContext("2d");
  if (!ctx) return configurePixelSpriteTexture(new THREE.CanvasTexture(canvas));

  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = variant % 2 === 0 ? "#cfc8b8" : "#b9b2a3";
  ctx.fillRect(10, 14, 236, 132);
  ctx.fillStyle = "#81796d";
  ctx.fillRect(10, 138, 236, 8);
  ctx.fillRect(238, 22, 8, 124);
  ctx.fillStyle = "#f1ead9";
  ctx.fillRect(18, 22, 214, 6);
  ctx.fillStyle = "rgba(47, 43, 36, 0.22)";
  ctx.fillRect(22, 130, 202, 2);
  ctx.fillRect(28, 72, 172, 2);

  for (let speckle = 0; speckle < 95; speckle += 1) {
    const x = 18 + Math.floor(survivalHash01(variant + speckle, speckle, 12510) * 214);
    const y = 30 + Math.floor(survivalHash01(speckle, variant - speckle, 12511) * 104);
    const light = survivalHash01(variant, speckle, 12512) > 0.58;
    ctx.fillStyle = light ? "rgba(245, 238, 219, 0.48)" : "rgba(43, 38, 30, 0.32)";
    ctx.fillRect(x, y, 2, 2);
  }

  for (let crack = 0; crack < 3; crack += 1) {
    let x = 38 + Math.floor(survivalHash01(variant, crack, 12513) * 156);
    let y = 34 + Math.floor(survivalHash01(crack, variant, 12514) * 76);
    const length = 16 + Math.floor(survivalHash01(variant + crack, crack, 12515) * 34);
    const drift = survivalHash01(crack, variant, 12516) > 0.5 ? 2 : -2;

    for (let step = 0; step < length; step += 4) {
      ctx.fillStyle = "rgba(32, 27, 20, 0.42)";
      ctx.fillRect(x, y, 2, 4);
      if (step % 12 === 0) {
        ctx.fillStyle = "rgba(242, 235, 217, 0.24)";
        ctx.fillRect(x + 2, y, 2, 2);
      }
      x += survivalHash01(x + variant, y, 12517) > 0.54 ? drift : 0;
      y += 4;
    }
  }

  for (let index = 0; index < GRAVEYARD_TOMB_TEXTURE_CHIP_RECTS.length; index += 1) {
    const [x, y, width, height] = GRAVEYARD_TOMB_TEXTURE_CHIP_RECTS[index];
    ctx.fillStyle = "rgba(67, 59, 48, 0.38)";
    ctx.fillRect(x, y, width, height);
    ctx.fillStyle = "rgba(247, 239, 221, 0.22)";
    ctx.fillRect(x + 2, y + height, Math.max(2, width - 4), 2);
  }

  ctx.fillStyle = "#171512";
  ctx.font = "bold 18px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(name, 128, 50);
  ctx.fillStyle = "#2b2720";
  ctx.font = "bold 14px monospace";
  const words = joke.split(" ");
  const lines: string[] = [];
  let current = "";
  for (let index = 0; index < words.length; index += 1) {
    const word = words[index];
    const next = current ? `${current} ${word}` : word;
    if (next.length > 22 && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  const lineCount = Math.min(3, lines.length);
  for (let index = 0; index < lineCount; index += 1) {
    ctx.fillText(lines[index], 128, 86 + index * 19);
  }

  const texture = configurePixelSpriteTexture(new THREE.CanvasTexture(canvas));
  graveyardTombTextureCache.set(cacheKey, texture);
  return texture;
}

function GraveyardTombstone({ tomb, showInscription }: { tomb: GraveyardTomb; showInscription: boolean }) {
  const styleIndex = Math.floor(survivalHash01(tomb.localX, tomb.localZ, 12412) * 5) % 5;
  const labelTexture = useMemo(
    () => showInscription ? makeGraveyardTombTextTexture(tomb.name, tomb.joke, styleIndex * 11 + Math.floor(tomb.variant * 9)) : null,
    [showInscription, tomb.joke, tomb.name, styleIndex, tomb.variant],
  );
  const stoneColor = tomb.variant > 0.66 ? "#9a9488" : tomb.variant > 0.33 ? "#b2ab9e" : "#7d7972";
  const darkStone = tomb.variant > 0.5 ? "#4a4640" : "#36332f";
  const accentStone = tomb.variant > 0.66 ? "#d2c9b7" : tomb.variant > 0.33 ? "#716b62" : "#bfb7a7";
  const stoneTexture = useMemo(
    () => makeGraveyardStoneTexture(stoneColor, tomb.variant + styleIndex * 0.17, "body"),
    [stoneColor, styleIndex, tomb.variant],
  );
  const darkStoneTexture = useMemo(
    () => makeGraveyardStoneTexture(darkStone, tomb.variant + styleIndex * 0.19, "dark"),
    [darkStone, styleIndex, tomb.variant],
  );
  const accentStoneTexture = useMemo(
    () => makeGraveyardStoneTexture(accentStone, tomb.variant + styleIndex * 0.23, "accent"),
    [accentStone, styleIndex, tomb.variant],
  );
  const width = 11.6 + tomb.variant * 5.2 + (styleIndex === 3 ? 2.4 : 0);
  const height = 15.2 + survivalHash01(tomb.localX, tomb.localZ, 12400) * 7.6 + (styleIndex === 1 ? 4.6 : 0);
  const depth = 1.85 + tomb.variant * 0.72;
  const baseWidth = width + (styleIndex === 3 ? 5.8 : 4.1);
  const baseDepth = depth + 2.45;
  const foundationColor = tomb.variant > 0.5 ? "#1d241b" : "#252c21";
  const foundationTexture = useMemo(
    () => makeGraveyardStoneTexture(foundationColor, tomb.variant + styleIndex * 0.29, "foundation"),
    [foundationColor, styleIndex, tomb.variant],
  );
  const labelY = styleIndex === 1 ? height * 0.42 + 1.25 : styleIndex === 3 ? height * 0.39 + 1.15 : height * 0.48 + 1.05;
  const labelHeight = styleIndex === 1 ? height * 0.42 : styleIndex === 4 ? height * 0.48 : height * 0.52;
  const labelWidth = styleIndex === 3 ? width * 0.43 : width * 0.78;
  const frontZ = -depth / 2 - 0.035;

  return (
    <group name="graveyard-joke-tomb" position={[tomb.localX, tomb.localY, tomb.localZ]} rotation={[0, tomb.rotation, 0]}>
      <mesh position={[0, -0.88, 0.62]} castShadow={false} receiveShadow>
        <boxGeometry args={[baseWidth * 1.08, 1.76, baseDepth * 1.16]} />
        <meshBasicMaterial map={foundationTexture} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 2.0]} castShadow={false} renderOrder={1} scale={[1.9, 1.18, 1]}>
        <circleGeometry args={[7.4 + tomb.variant * 2.2, 12]} />
        <meshBasicMaterial color="#202519" transparent opacity={0.82} />
      </mesh>
      <mesh position={[0, 0.78, 0.62]} castShadow={false} receiveShadow>
        <boxGeometry args={[baseWidth, 1.56, baseDepth]} />
        <meshBasicMaterial map={darkStoneTexture} />
      </mesh>

      {styleIndex === 0 && (
        <>
          <mesh position={[0, height * 0.5 + 1.2, 0]} castShadow={false} receiveShadow>
            <boxGeometry args={[width, height, depth]} />
            <meshBasicMaterial map={stoneTexture} />
          </mesh>
          <mesh position={[0, height + 1.95, 0]} castShadow={false}>
            <boxGeometry args={[width * 0.74, 1.5, depth + 0.12]} />
            <meshBasicMaterial map={stoneTexture} />
          </mesh>
          <mesh position={[0, height * 0.74 + 1.2, frontZ - 0.02]} castShadow={false}>
            <boxGeometry args={[width * 0.56, 0.5, 0.24]} />
            <meshBasicMaterial color="#2d2a27" />
          </mesh>
        </>
      )}

      {styleIndex === 1 && (
        <>
          <mesh position={[0, height * 0.5 + 1.2, 0]} castShadow={false} receiveShadow>
            <boxGeometry args={[width * 0.62, height, depth]} />
            <meshBasicMaterial map={stoneTexture} />
          </mesh>
          <mesh position={[0, height + 2.7, 0]} castShadow={false}>
            <boxGeometry args={[width * 0.42, 4.1, depth + 0.12]} />
            <meshBasicMaterial map={stoneTexture} />
          </mesh>
          <mesh position={[0, height + 3.0, 0]} castShadow={false}>
            <boxGeometry args={[width * 0.95, 1.52, depth + 0.18]} />
            <meshBasicMaterial map={stoneTexture} />
          </mesh>
          <mesh position={[0, height * 0.72 + 1.1, frontZ - 0.02]} castShadow={false}>
            <boxGeometry args={[0.72, 4.25, 0.26]} />
            <meshBasicMaterial color="#2d2a27" />
          </mesh>
          <mesh position={[0, height * 0.82 + 1.1, frontZ - 0.04]} castShadow={false}>
            <boxGeometry args={[3.25, 0.62, 0.24]} />
            <meshBasicMaterial color="#2d2a27" />
          </mesh>
        </>
      )}

      {styleIndex === 2 && (
        <>
          <mesh position={[0, height * 0.46 + 1.1, 0]} castShadow={false} receiveShadow>
            <boxGeometry args={[width, height * 0.92, depth]} />
            <meshBasicMaterial map={stoneTexture} />
          </mesh>
          <mesh position={[0, height * 0.92 + 1.1, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow={false}>
            <cylinderGeometry args={[width * 0.5, width * 0.5, depth + 0.06, 16]} />
            <meshBasicMaterial map={stoneTexture} />
          </mesh>
          <mesh position={[0, height * 0.86 + 1.1, frontZ - 0.04]} castShadow={false}>
            <boxGeometry args={[width * 0.62, 0.46, 0.24]} />
            <meshBasicMaterial color="#2d2a27" />
          </mesh>
        </>
      )}

      {styleIndex === 3 && (
        <>
          {GRAVEYARD_TOMB_SIDE_SIGNS.map((side) => (
            <Fragment key={`double-marker-${side}`}>
              <mesh position={[side * width * 0.27, height * 0.46 + 1.05, 0]} castShadow={false} receiveShadow>
                <boxGeometry args={[width * 0.42, height * 0.92, depth]} />
                <meshBasicMaterial map={side < 0 ? stoneTexture : accentStoneTexture} />
              </mesh>
              <mesh position={[side * width * 0.27, height * 0.95 + 1.02, 0]} castShadow={false}>
                <boxGeometry args={[width * 0.36, 1.35, depth + 0.12]} />
                <meshBasicMaterial map={side < 0 ? stoneTexture : accentStoneTexture} />
              </mesh>
            </Fragment>
          ))}
          <mesh position={[0, height * 0.18 + 1.0, frontZ - 0.04]} castShadow={false}>
            <boxGeometry args={[width * 0.22, 2.8, 0.22]} />
            <meshBasicMaterial color="#2d2a27" />
          </mesh>
        </>
      )}

      {styleIndex === 4 && (
        <>
          <mesh position={[0, height * 0.42 + 1.12, 0]} castShadow={false} receiveShadow>
            <boxGeometry args={[width * 0.74, height * 0.84, depth]} />
            <meshBasicMaterial map={stoneTexture} />
          </mesh>
          <mesh position={[0, height * 0.92 + 1.02, 0]} rotation={[0, Math.PI / 4, 0]} castShadow={false}>
            <coneGeometry args={[width * 0.52, height * 0.34, 4]} />
            <meshBasicMaterial map={accentStoneTexture} />
          </mesh>
          <mesh position={[0, height * 0.62 + 1.1, frontZ - 0.04]} castShadow={false}>
            <boxGeometry args={[width * 0.42, 0.5, 0.24]} />
            <meshBasicMaterial color="#2d2a27" />
          </mesh>
          <mesh position={[0, height * 0.7 + 1.1, frontZ - 0.05]} castShadow={false}>
            <boxGeometry args={[0.54, 2.7, 0.22]} />
            <meshBasicMaterial color="#2d2a27" />
          </mesh>
        </>
      )}

      <mesh position={[0, 1.72, -baseDepth * 0.5 - 0.04]} castShadow={false}>
        <boxGeometry args={[baseWidth * 0.86, 0.34, 0.2]} />
        <meshBasicMaterial color="#15130f" transparent opacity={0.54} />
      </mesh>
      <mesh position={[-baseWidth * 0.38, height * 0.32 + 1.1, frontZ - 0.045]} castShadow={false}>
        <boxGeometry args={[0.34, height * 0.48, 0.22]} />
        <meshBasicMaterial color="#e5dcc8" transparent opacity={0.28} />
      </mesh>
      <mesh position={[baseWidth * 0.34, height * 0.58 + 1.1, frontZ - 0.045]} castShadow={false}>
        <boxGeometry args={[0.28, height * 0.36, 0.22]} />
        <meshBasicMaterial color="#28241e" transparent opacity={0.46} />
      </mesh>
      {labelTexture && (
        <mesh position={[styleIndex === 3 ? -width * 0.27 : 0, labelY, frontZ - 0.075]} rotation={[0, Math.PI, 0]} frustumCulled={false} renderOrder={3}>
          <planeGeometry args={[labelWidth, labelHeight]} />
          <meshBasicMaterial map={labelTexture} transparent depthWrite={false} side={THREE.DoubleSide} polygonOffset polygonOffsetFactor={-3} polygonOffsetUnits={-3} />
        </mesh>
      )}
    </group>
  );
}

export function getGraveyardVisibleTombsForView(tombs: GraveyardTomb[], showDetails: boolean) {
  if (showDetails) return tombs;

  const visibleTombs: GraveyardTomb[] = [];
  for (let index = 0; index < tombs.length; index += 4) {
    visibleTombs.push(tombs[index]);
  }
  return visibleTombs;
}

export function GraveyardTombs({ tombs, showDetails }: { tombs: GraveyardTomb[]; showDetails: boolean }) {
  const visibleTombs = getGraveyardVisibleTombsForView(tombs, showDetails);

  return (
    <group name="graveyard-joke-tombs">
      {visibleTombs.map((tomb, index) => (
        <GraveyardTombstone key={tomb.key} tomb={tomb} showInscription={showDetails && index % 8 === 0} />
      ))}
    </group>
  );
}
