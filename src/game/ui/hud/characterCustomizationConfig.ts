import type { CharacterCustomization } from "../../../store/gameStore";

export type CharacterColorRow = {
  key: keyof CharacterCustomization;
  label: string;
  hint: string;
};

export type CharacterStyleRow = {
  key: keyof CharacterCustomization;
  label: string;
  options: string[];
};

export const characterColorRows: CharacterColorRow[] = [
  { key: "skinColor", label: "Skin", hint: "base body color" },
  { key: "topColor", label: "Top", hint: "shirt / robe color" },
  { key: "pantsColor", label: "Pants", hint: "legs color" },
  { key: "shoesColor", label: "Shoes", hint: "feet color" },
  { key: "hatColor", label: "Hat", hint: "hat color" },
  { key: "hairColor", label: "Hair", hint: "head hair color" },
  { key: "facialHairColor", label: "Facial Hair", hint: "beard / mustache color" },
];

export const characterStyleRows: CharacterStyleRow[] = [
  { key: "topStyle", label: "Top Style", options: ["simple", "robe", "vest", "tunic"] },
  { key: "pantsStyle", label: "Pants Style", options: ["pants", "shorts", "skirt", "robe"] },
  { key: "shoesStyle", label: "Shoes", options: ["boots", "shoes", "sandals", "barefoot"] },
  { key: "hatStyle", label: "Hat", options: ["none", "wizard", "floppy-wizard", "cap", "hood", "pharaoh"] },
  { key: "hairStyle", label: "Hair", options: ["none", "short", "bob", "spikes", "long"] },
  { key: "facialHairStyle", label: "Facial Hair", options: ["none", "mustache", "goatee", "beard"] },
  { key: "eyeStyle", label: "Eyes", options: ["calm", "angry", "content", "dull", "sus", "sus-shadow", "terrified", "sad", "hard-shut", "done", "happy", "nervous", "nervous-teary"] },
];

export const characterMouthRows: CharacterStyleRow[] = [
  { key: "mouthStyle", label: "Mouth Shape", options: ["neutral", "smile", "frown", "open"] },
];

export const characterColorPresets = [
  "#d6cf91",
  "#8d5524",
  "#c68642",
  "#f1c27d",
  "#ffdbac",
  "#f472b6",
  "#60a5fa",
  "#22c55e",
  "#facc15",
  "#f8fafc",
];
