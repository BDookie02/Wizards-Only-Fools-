import { getDarrelPetalNoise } from "../../rendering/textures/textureNoise";

const TWO_PI = Math.PI * 2;
const LILY_COIL_EYE_CAP_FLORA_CLEAR_T = 0.075;

export type LilyCoilTubeDecor = {
  t: number;
  angle: number;
  yaw: number;
  scale: number;
};

export type LilyCoilTubeGrassTuft = {
  t: number;
  angle: number;
  yaw: number;
  radius: number;
  height: number;
  width: number;
  lean: number;
};

export type LilyCoilTubeFlower = LilyCoilTubeDecor & {
  stemHeight: number;
  bloomHeight: number;
  bloomWidth: number;
  tilt: number;
};

export type LilyCoilBloomParticle = {
  flowerIndex: number;
  phase: number;
  radius: number;
  speed: number;
  size: number;
  height: number;
};

export type LilyCoilFlyingLight = {
  anchor: number;
  hop: number;
  phase: number;
  speed: number;
  arc: number;
  wander: number;
  size: number;
};

export type LilyCoilGroundGrassTuft = {
  x: number;
  z: number;
  yaw: number;
  height: number;
  width: number;
  lean: number;
};

export type LilyCoilGroundLily = {
  x: number;
  z: number;
  yaw: number;
  scale: number;
};

export function isLilyCoilFloraTAllowed(t: number) {
  return t > LILY_COIL_EYE_CAP_FLORA_CLEAR_T && t < 1 - LILY_COIL_EYE_CAP_FLORA_CLEAR_T;
}

function clampUnitRange(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function makeLilyCoilTubeGrassGroups(mobilePerformanceMode: boolean, tubeRadius: number) {
  const groups: LilyCoilTubeGrassTuft[][] = [[], [], []];
  const longitudinalSegments = mobilePerformanceMode ? 180 : 300;
  const ringSegments = mobilePerformanceMode ? 40 : 56;
  for (let tIndex = 0; tIndex < longitudinalSegments; tIndex += 1) {
    for (let angleIndex = 0; angleIndex < ringSegments; angleIndex += 1) {
      const seed = tIndex * 997 + angleIndex * 37;
      const tone = (tIndex + angleIndex) % groups.length;
      const tJitter = (getDarrelPetalNoise(seed, 191) - 0.5) * 0.72;
      const angleJitter = (getDarrelPetalNoise(seed, 192) - 0.5) * 0.82;
      const t = clampUnitRange((tIndex + 0.5 + tJitter) / longitudinalSegments, 0.012, 0.988);
      if (!isLilyCoilFloraTAllowed(t)) continue;
      groups[tone].push({
        t,
        angle: ((angleIndex + 0.5 + angleJitter) / ringSegments) * TWO_PI,
        yaw: 0,
        radius: tubeRadius - 0.8,
        height: 5.5 + getDarrelPetalNoise(seed, 194) * 4.5,
        width: 10 + getDarrelPetalNoise(seed, 195) * 7,
        lean: 0.04 + getDarrelPetalNoise(seed, 196) * 0.1,
      });
    }
  }
  return groups;
}

export function makeLilyCoilTubeLilies(mobilePerformanceMode: boolean) {
  const generated: LilyCoilTubeDecor[] = [];
  const count = mobilePerformanceMode ? 520 : 1500;
  for (let index = 0; index < count; index += 1) {
    const t = 0.018 + getDarrelPetalNoise(index, 91) * 0.964;
    if (!isLilyCoilFloraTAllowed(t)) continue;
    generated.push({
      t,
      angle: getDarrelPetalNoise(index, 92) * TWO_PI,
      yaw: getDarrelPetalNoise(index, 93) * TWO_PI,
      scale: 0.78 + getDarrelPetalNoise(index, 94) * 1.35,
    });
  }
  return generated;
}

export function makeLilyCoilTubeFlowers(mobilePerformanceMode: boolean) {
  const generated: LilyCoilTubeFlower[] = [];
  const count = mobilePerformanceMode ? 80 : 200;
  for (let index = 0; index < count; index += 1) {
    const scale = 0.82 + getDarrelPetalNoise(index, 681) * 0.7;
    const t = 0.026 + getDarrelPetalNoise(index, 682) * 0.948;
    if (!isLilyCoilFloraTAllowed(t)) continue;
    generated.push({
      t,
      angle: getDarrelPetalNoise(index, 683) * TWO_PI,
      yaw: getDarrelPetalNoise(index, 684) * TWO_PI,
      scale,
      stemHeight: (14 + getDarrelPetalNoise(index, 685) * 5.5) * scale,
      bloomHeight: (9.5 + getDarrelPetalNoise(index, 686) * 4) * scale,
      bloomWidth: (7 + getDarrelPetalNoise(index, 687) * 3.5) * scale,
      tilt: (getDarrelPetalNoise(index, 688) - 0.5) * 0.5,
    });
  }
  return generated;
}

export function makeLilyCoilSmallTubeFlowers(mobilePerformanceMode: boolean) {
  const generated: LilyCoilTubeFlower[] = [];
  const showcaseCount = mobilePerformanceMode ? 12 : 18;
  for (let index = 0; index < showcaseCount; index += 1) {
    const row = Math.floor(index / 3);
    const column = index % 3;
    const scale = 0.62 + getDarrelPetalNoise(index, 756) * 0.2;
    const t = 0.112 + row * 0.0075;
    if (isLilyCoilFloraTAllowed(t)) {
      generated.push({
        t,
        angle: Math.PI + (column - 1) * 0.34 + (getDarrelPetalNoise(index, 757) - 0.5) * 0.08,
        yaw: getDarrelPetalNoise(index, 758) * TWO_PI,
        scale,
        stemHeight: (9.2 + getDarrelPetalNoise(index, 759) * 3.2) * scale,
        bloomHeight: (4.8 + getDarrelPetalNoise(index, 760) * 1.8) * scale,
        bloomWidth: (3.8 + getDarrelPetalNoise(index, 761) * 1.7) * scale,
        tilt: (getDarrelPetalNoise(index, 762) - 0.5) * 0.48,
      });
    }
  }

  const scatteredCount = mobilePerformanceMode ? 90 : 260;
  for (let index = 0; index < scatteredCount; index += 1) {
    const scale = 0.56 + getDarrelPetalNoise(index, 761) * 0.28;
    const t = 0.028 + getDarrelPetalNoise(index, 762) * 0.944;
    if (!isLilyCoilFloraTAllowed(t)) continue;
    generated.push({
      t,
      angle: getDarrelPetalNoise(index, 763) * TWO_PI,
      yaw: getDarrelPetalNoise(index, 764) * TWO_PI,
      scale,
      stemHeight: (8.8 + getDarrelPetalNoise(index, 765) * 3.4) * scale,
      bloomHeight: (4.4 + getDarrelPetalNoise(index, 766) * 1.8) * scale,
      bloomWidth: (3.6 + getDarrelPetalNoise(index, 767) * 1.7) * scale,
      tilt: (getDarrelPetalNoise(index, 768) - 0.5) * 0.62,
    });
  }
  return generated;
}

export function makeLilyCoilBloomParticles(mobilePerformanceMode: boolean, flowerCount: number) {
  const particlesPerFlower = mobilePerformanceMode ? 2 : 3;
  const generated: LilyCoilBloomParticle[] = [];
  const count = flowerCount * particlesPerFlower;
  const divisor = Math.max(1, flowerCount);
  for (let index = 0; index < count; index += 1) {
    generated.push({
      flowerIndex: index % divisor,
      phase: getDarrelPetalNoise(index, 781) * TWO_PI,
      radius: 1.2 + getDarrelPetalNoise(index, 782) * 2.1,
      speed: 0.34 + getDarrelPetalNoise(index, 783) * 0.28,
      size: 0.18 + getDarrelPetalNoise(index, 784) * 0.22,
      height: (getDarrelPetalNoise(index, 785) - 0.5) * 2.4,
    });
  }
  return generated;
}

export function makeLilyCoilFireflies(mobilePerformanceMode: boolean, anchorCount: number) {
  const generated: LilyCoilFlyingLight[] = [];
  const count = mobilePerformanceMode ? 70 : 160;
  const safeAnchorCount = Math.max(1, anchorCount);
  for (let index = 0; index < count; index += 1) {
    generated.push({
      anchor: Math.floor(getDarrelPetalNoise(index, 701) * safeAnchorCount),
      hop: 5 + Math.floor(getDarrelPetalNoise(index, 702) * 23),
      phase: getDarrelPetalNoise(index, 703) * 48,
      speed: 0.055 + getDarrelPetalNoise(index, 704) * 0.13,
      arc: 3.5 + getDarrelPetalNoise(index, 705) * 7,
      wander: 1.1 + getDarrelPetalNoise(index, 706) * 2.6,
      size: 0.68 + getDarrelPetalNoise(index, 707) * 0.72,
    });
  }
  return generated;
}

export function makeLilyCoilButterflies(mobilePerformanceMode: boolean, anchorCount: number) {
  const generated: LilyCoilFlyingLight[] = [];
  const count = mobilePerformanceMode ? 4 : 10;
  const safeAnchorCount = Math.max(1, anchorCount);
  for (let index = 0; index < count; index += 1) {
    generated.push({
      anchor: Math.floor(getDarrelPetalNoise(index, 721) * safeAnchorCount),
      hop: 13 + Math.floor(getDarrelPetalNoise(index, 722) * 39),
      phase: getDarrelPetalNoise(index, 723) * 40,
      speed: 0.055 + getDarrelPetalNoise(index, 724) * 0.09,
      arc: 9 + getDarrelPetalNoise(index, 725) * 15,
      wander: 3.2 + getDarrelPetalNoise(index, 726) * 5,
      size: 1.08 + getDarrelPetalNoise(index, 727) * 0.82,
    });
  }
  return generated;
}

export function makeLilyCoilGroundGrass(mobilePerformanceMode: boolean, coilRadius: number) {
  const items: LilyCoilGroundGrassTuft[] = [];
  const count = mobilePerformanceMode ? 1800 : 5200;
  for (let index = 0; index < count; index += 1) {
    const radius = 4 + Math.pow(getDarrelPetalNoise(index, 11), 1.95) * (coilRadius - 46);
    const angle = getDarrelPetalNoise(index, 12) * TWO_PI;
    items.push({
      x: Math.cos(angle) * radius,
      z: Math.sin(angle) * radius,
      yaw: getDarrelPetalNoise(index, 13) * TWO_PI,
      height: 16 + getDarrelPetalNoise(index, 14) * 22,
      width: 0.35 + getDarrelPetalNoise(index, 15) * 0.65,
      lean: 0.22 + getDarrelPetalNoise(index, 16) * 0.42,
    });
  }
  return items;
}

export function makeLilyCoilGroundLilies(mobilePerformanceMode: boolean, coilRadius: number) {
  const items: LilyCoilGroundLily[] = [];
  const count = mobilePerformanceMode ? 220 : 560;
  for (let index = 0; index < count; index += 1) {
    const radius = 20 + Math.sqrt(getDarrelPetalNoise(index, 31)) * (coilRadius - 50);
    const angle = getDarrelPetalNoise(index, 32) * TWO_PI;
    items.push({
      x: Math.cos(angle) * radius,
      z: Math.sin(angle) * radius,
      yaw: getDarrelPetalNoise(index, 33) * TWO_PI,
      scale: 0.85 + getDarrelPetalNoise(index, 34) * 1.85,
    });
  }
  return items;
}

export function pickLilyCoilGroundLilyLights(lilies: readonly LilyCoilGroundLily[], maxLights = 4, stride = 112) {
  const items: LilyCoilGroundLily[] = [];
  for (let index = 0; index < lilies.length && items.length < maxLights; index += stride) {
    items.push(lilies[index]);
  }
  return items;
}
