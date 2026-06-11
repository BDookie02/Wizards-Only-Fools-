import type { CharacterCustomization } from "../../../store/gameStore";
export {
  clampMenuIndex as clampLaunchMenuIndex,
  findDirectionalMenuIndex,
} from "../menu/menuNavigation";
export type { MenuDirection } from "../menu/menuNavigation";

export type LaunchMenuStage = "press" | "save" | "new" | "multiplayer" | "custom" | "survival";
export type LaunchInputSource = "mouse" | "controller";

export const launchColorPresets = [
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

export const launchHatStyles: CharacterCustomization["hatStyle"][] = [
  "none",
  "wizard",
  "floppy-wizard",
  "cap",
  "hood",
  "pharaoh",
];

export const launchHairStyles: CharacterCustomization["hairStyle"][] = [
  "none",
  "short",
  "bob",
  "spikes",
  "long",
];

export const newSurvivalActionCount = 8;

export function getLaunchMenuOptionCount(stage: LaunchMenuStage) {
  if (stage === "save") return 3;
  if (stage === "new") return newSurvivalActionCount;
  if (stage === "multiplayer") return 3;
  if (stage === "custom" || stage === "survival") return 3;
  return 1;
}

export function wrapLaunchMenuIndex(index: number, count: number) {
  return ((index % count) + count) % count;
}

export function cycleLaunchOption<T>(options: T[], current: T, direction: 1 | -1 = 1) {
  const index = Math.max(0, options.indexOf(current));
  return options[wrapLaunchMenuIndex(index + direction, options.length)];
}

export function formatLaunchOption(value: string) {
  const parts = value.split(/(?=[A-Z])|[-_\s]+/);
  let label = "";
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    if (!part) continue;
    if (label) label += " ";
    label += part.charAt(0).toUpperCase() + part.slice(1);
  }
  return label;
}
