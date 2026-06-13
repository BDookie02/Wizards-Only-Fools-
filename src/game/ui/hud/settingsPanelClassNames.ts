import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { SettingsPane } from "./hudSettingsPanelConfig";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const focusedMenuClass = "ring-2 ring-yellow-200 ring-offset-2 ring-offset-black shadow-[0_0_20px_rgba(250,204,21,0.55)] brightness-125";
export const settingsCardClass = "settings-card border text-left transition-all";
export const settingsTitleRowClass = "settings-card-title flex items-center justify-between gap-3 tracking-widest";
export const settingsHintClass = "settings-card-hint leading-4 tracking-widest";

export const settingsTabButtons: readonly {
  pane: SettingsPane;
  label: string;
  activeClassName: string;
}[] = [
  { pane: "video", label: "Video", activeClassName: "border-yellow-400 bg-yellow-400/10 text-yellow-300" },
  { pane: "keybinds", label: "Keybinds", activeClassName: "border-cyan-300 bg-cyan-300/10 text-cyan-100" },
  { pane: "voice", label: "Voice", activeClassName: "border-emerald-300 bg-emerald-300/10 text-emerald-100" },
  { pane: "character", label: "Character", activeClassName: "border-pink-300 bg-pink-300/10 text-pink-100" },
];
