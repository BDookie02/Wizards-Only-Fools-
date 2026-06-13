import type { QuestDialogSession, QuestNpcEditorTarget, SpellType } from "../../../store/gameStore";

export type HudStateQaInputMode = "mouse" | "touch" | "controller";
export type HudStateQaSettingsPane = "video" | "keybinds" | "voice" | "character";
export type HudStateQaHand = "left" | "right";
export type HudStateQaMapPage = "live" | "world";

export const HUD_STATE_QA_SETTINGS_PANES: readonly HudStateQaSettingsPane[] = ["video", "keybinds", "voice", "character"];
export const HUD_STATE_QA_MAP_PAGES: readonly HudStateQaMapPage[] = ["live", "world"];
export const HUD_STATE_QA_MAGIC_HAND_SPELLS: readonly SpellType[] = [
  "fireball",
  "iceshard",
  "healspell",
  "icespell",
  "ringsofpower",
  "lightning",
  "portal",
  "blink",
  "grab",
  "tornado",
  "meteorshower",
  "smokebomb",
  "discshield",
  "orbshield",
  "kunai",
  "healingcrystals",
  "magicarmor",
  "jumpboost",
  "speedboost",
  "tungstonballsack",
  "sleep",
  "poison",
  "acid",
  "magicglassorb",
];
export const HUD_STATE_QA_NON_CHARGING_EFFECT_SPELLS: readonly SpellType[] = ["iceshard", "grab"];

export function getHudStateQaRunKey(options: {
  qaHudState: string;
  qaSettingsPane: string;
  qaMapPage: string;
  qaMagicSpell: string;
}) {
  return `${options.qaHudState}:${options.qaSettingsPane}:${options.qaMapPage}:${options.qaMagicSpell}`;
}

export function resolveHudStateQaInputMode(options: {
  touchGameplayActive: boolean;
  controllerGameplayActive: boolean;
}): HudStateQaInputMode {
  if (options.touchGameplayActive) return "touch";
  if (options.controllerGameplayActive) return "controller";
  return "mouse";
}

export function resolveHudStateQaSettingsPane(value: string): HudStateQaSettingsPane {
  return HUD_STATE_QA_SETTINGS_PANES.includes(value as HudStateQaSettingsPane)
    ? value as HudStateQaSettingsPane
    : "video";
}

export function resolveHudStateQaMapPage(value: string): HudStateQaMapPage {
  return HUD_STATE_QA_MAP_PAGES.includes(value as HudStateQaMapPage)
    ? value as HudStateQaMapPage
    : "live";
}

export function resolveHudStateQaMagicSpell(value: string): SpellType {
  return HUD_STATE_QA_MAGIC_HAND_SPELLS.includes(value as SpellType)
    ? value as SpellType
    : "fireball";
}

export function shouldForceHudStateQaMagicHandsCharging(spell: SpellType) {
  return !HUD_STATE_QA_NON_CHARGING_EFFECT_SPELLS.includes(spell);
}

export function isHudStateQaQuestNpcEditorState(value: string) {
  return value === "questnpc" || value === "quest-npc";
}

export function isHudStateQaQuestDialogState(value: string) {
  return value === "questdialog" || value === "quest-dialog";
}

export function isHudStateQaMagicHandsState(value: string) {
  return value === "magichands" || value === "magic-hands";
}

export function createHudStateQaQuestNpcEditorTarget(): QuestNpcEditorTarget {
  return {
    npcId: "qa-runtime-npc",
    townId: "qa-town",
    hutId: "qa-hut",
    defaultName: "QA Quest NPC",
    theme: "qa",
    position: [0, 0, 0],
  };
}

export function createHudStateQaQuestDialogSession(): QuestDialogSession {
  return {
    npcId: "qa-dialog-npc",
    townId: "qa-town",
    displayName: "QA Quest NPC",
    line: "QA dialog route for controller, keyboard, and aspect-ratio checks. This session is synthetic and safe to close.",
    choices: [
      { id: "darrel-close", label: "Close QA dialog" },
      { id: "qa-dialog-hold", label: "Keep dialog open" },
    ],
  };
}
