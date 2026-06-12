import { type CharacterCustomization } from "../../../../store/gameStore";
import { type HutInfo } from "./baseVillageHutLayout";

export interface VillagerInfo {
  id: string;
  hut: HutInfo;
  character: CharacterCustomization;
  x: number;
  y: number;
  z: number;
  baseYaw: number;
}

const SKIN_COLORS = ["#f0d2b6", "#d7a77f", "#a86f4b", "#6f4632", "#d6cf91", "#e7c69b", "#b7785f", "#f5dfc8"];
const CLOTHING_COLORS = ["#2563eb", "#dc2626", "#16a34a", "#f97316", "#0891b2", "#9333ea", "#475569", "#be123c", "#ca8a04", "#0f766e"];
const PANTS_COLORS = ["#1f2937", "#334155", "#292524", "#4b5563", "#312e81", "#3f3f46"];
const HAIR_COLORS = ["#2b1b12", "#5c4033", "#7c4a24", "#d6a85f", "#111827", "#f8fafc", "#8b5cf6"];
const EYE_STYLES: CharacterCustomization["eyeStyle"][] = ["calm", "content", "dull", "sus", "happy", "nervous"];
const MOUTH_STYLES: CharacterCustomization["mouthStyle"][] = ["neutral", "smile", "frown"];
const TOP_STYLES: CharacterCustomization["topStyle"][] = ["simple", "vest", "tunic"];
const PANTS_STYLES: CharacterCustomization["pantsStyle"][] = ["pants", "shorts", "skirt"];
const SHOES_STYLES: CharacterCustomization["shoesStyle"][] = ["boots", "shoes", "sandals", "barefoot"];
const HAIR_STYLES: CharacterCustomization["hairStyle"][] = ["none", "short", "bob", "spikes", "long"];
const FACIAL_HAIR_STYLES: CharacterCustomization["facialHairStyle"][] = ["none", "none", "none", "mustache", "goatee", "beard"];
const EGYPTIAN_LINEN_COLORS = ["#f8e7bf", "#ffe8a3", "#e9c46a", "#facc15"];
const EGYPTIAN_ACCENT_COLORS = ["#2563eb", "#0891b2", "#0f766e", "#1d4ed8"];
const EGYPTIAN_EYE_STYLES: CharacterCustomization["eyeStyle"][] = ["calm", "dull", "sus", "content"];
const EGYPTIAN_MOUTH_STYLES: CharacterCustomization["mouthStyle"][] = ["neutral", "frown", "smile"];
const SWAMP_CLOTHING_COLORS = ["#4d5b2a", "#5f6f33", "#3d4a24", "#6a5430", "#2f5138"];
const SWAMP_PANTS_COLORS = ["#2b2f1e", "#3d3522", "#26351f", "#4b3b24"];
const SWAMP_HAIR_COLORS = ["#23170e", "#3b2618", "#4b341f", "#182414"];

export const DARREL_CHARACTER: CharacterCustomization = {
  skinColor: "#d7a77f",
  topColor: "#4c1d95",
  pantsColor: "#312e81",
  shoesColor: "#2c2116",
  hatColor: "#7f1d1d",
  hairColor: "#f8fafc",
  facialHairColor: "#f8fafc",
  topStyle: "robe",
  pantsStyle: "robe",
  shoesStyle: "boots",
  hatStyle: "floppy-wizard",
  hairStyle: "long",
  facialHairStyle: "beard",
  eyeStyle: "sus",
  mouthStyle: "frown",
};

export function hashValue(seed: string, salt: number) {
  let hash = 2166136261 ^ salt;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

function pick<T>(items: T[], seed: string, salt: number) {
  return items[Math.floor(hashValue(seed, salt) * items.length) % items.length];
}

export function makeVillagerCharacter(hut: HutInfo, index: number): CharacterCustomization {
  const seed = `${hut.id}:${hut.hutType}:${hut.colorIndex}:${index}`;
  if (hut.villagerTheme === "egyptian") {
    const accentColor = pick(EGYPTIAN_ACCENT_COLORS, seed, 20);
    const linenColor = pick(EGYPTIAN_LINEN_COLORS, seed, 21);
    const hairColor = pick(["#0b0b0f", "#171717", "#2b1b12"], seed, 22);
    const hasRoyalLook = hashValue(seed, 23) > 0.35;

    return {
      skinColor: pick(["#c68656", "#b8734a", "#d79a63", "#a8643f", "#e0b07a"], seed, 24),
      topColor: hasRoyalLook ? accentColor : linenColor,
      pantsColor: hasRoyalLook ? linenColor : "#facc15",
      shoesColor: "#7c4a24",
      hatColor: accentColor,
      hairColor,
      facialHairColor: hairColor,
      topStyle: hasRoyalLook ? "tunic" : "robe",
      pantsStyle: hashValue(seed, 25) > 0.45 ? "skirt" : "robe",
      shoesStyle: hashValue(seed, 26) > 0.5 ? "sandals" : "barefoot",
      hatStyle: hasRoyalLook ? "pharaoh" : "none",
      hairStyle: hasRoyalLook ? "none" : "bob",
      facialHairStyle: hashValue(seed, 27) > 0.68 ? "goatee" : "none",
      eyeStyle: pick(EGYPTIAN_EYE_STYLES, seed, 28),
      mouthStyle: pick(EGYPTIAN_MOUTH_STYLES, seed, 29),
    };
  }

  if (hut.villagerTheme === "swamp") {
    const topColor = pick(SWAMP_CLOTHING_COLORS, seed, 31);
    const hairColor = pick(SWAMP_HAIR_COLORS, seed, 32);

    return {
      skinColor: pick(["#d1aa7c", "#b9845d", "#8e5f43", "#c79069", "#d6bc8b"], seed, 33),
      topColor,
      pantsColor: pick(SWAMP_PANTS_COLORS, seed, 34),
      shoesColor: "#2c2116",
      hatColor: topColor,
      hairColor,
      facialHairColor: hairColor,
      topStyle: pick(["simple", "vest", "tunic"], seed, 35) as CharacterCustomization["topStyle"],
      pantsStyle: pick(["pants", "shorts", "skirt"], seed, 36) as CharacterCustomization["pantsStyle"],
      shoesStyle: pick(["boots", "sandals", "barefoot"], seed, 37) as CharacterCustomization["shoesStyle"],
      hatStyle: "none",
      hairStyle: pick(["short", "bob", "long", "spikes"], seed, 38) as CharacterCustomization["hairStyle"],
      facialHairStyle: pick(FACIAL_HAIR_STYLES, seed, 39),
      eyeStyle: pick(["calm", "dull", "sus", "nervous"], seed, 40) as CharacterCustomization["eyeStyle"],
      mouthStyle: pick(["neutral", "frown", "smile"], seed, 41) as CharacterCustomization["mouthStyle"],
    };
  }

  const topColor = pick(CLOTHING_COLORS, seed, 1);
  const hairColor = pick(HAIR_COLORS, seed, 2);

  return {
    skinColor: pick(SKIN_COLORS, seed, 3),
    topColor,
    pantsColor: pick(PANTS_COLORS, seed, 4),
    shoesColor: pick(PANTS_COLORS, seed, 5),
    hatColor: topColor,
    hairColor,
    facialHairColor: hairColor,
    topStyle: pick(TOP_STYLES, seed, 6),
    pantsStyle: pick(PANTS_STYLES, seed, 7),
    shoesStyle: pick(SHOES_STYLES, seed, 8),
    hatStyle: "none",
    hairStyle: pick(HAIR_STYLES, seed, 9),
    facialHairStyle: pick(FACIAL_HAIR_STYLES, seed, 10),
    eyeStyle: pick(EYE_STYLES, seed, 11),
    mouthStyle: pick(MOUTH_STYLES, seed, 12),
  };
}

export function makeVillager(hut: HutInfo, index: number): VillagerInfo {
  const doorDirX = Math.sin(hut.rotation);
  const doorDirZ = Math.cos(hut.rotation);
  const sideDirX = Math.cos(hut.rotation);
  const sideDirZ = -Math.sin(hut.rotation);
  const backOffset = hut.villagerBackOffset ?? (hut.isMushroom ? -1.25 : -2.1);
  const sideOffset = hut.villagerSideOffset ?? 0;

  return {
    id: hut.id,
    hut,
    character: makeVillagerCharacter(hut, index),
    x: hut.x + doorDirX * backOffset + sideDirX * sideOffset,
    y: hut.y + (hut.villagerYOffset ?? 0.95),
    z: hut.z + doorDirZ * backOffset + sideDirZ * sideOffset,
    baseYaw: hut.rotation,
  };
}
