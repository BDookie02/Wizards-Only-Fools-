import { setMouseLookFallbackActive } from "../../systems/input/browserDisplayMode";
import {
  dispatchHudGameplayModalOpened,
  exitPointerLockIfActive,
  isHudMouseLookFallbackActive,
  isPointerLockActive,
  setHudMouseGameplayActive,
} from "./hudMouseGameplayRuntime";

type BooleanRef = {
  current: boolean;
};

export type HudCommandSuggestion = {
  command: string;
  sample: string;
  label: string;
  aliases: string[];
  normalizedSample: string;
  normalizedLabel: string;
};

function createHudCommandSuggestion(
  command: string,
  sample: string,
  label: string,
  aliases: string[]
): HudCommandSuggestion {
  return {
    command,
    sample,
    label,
    aliases,
    normalizedSample: sample.toLowerCase(),
    normalizedLabel: label.toLowerCase(),
  };
}

export const HUD_COMMAND_SUGGESTIONS: HudCommandSuggestion[] = [
  createHudCommandSuggestion("engine", "/engine", "Engine menu", ["devmenu", "placemenu", "place"]),
  createHudCommandSuggestion("place", "/place hut-log-cabin", "Place object", ["hut", "spawn", "object"]),
  createHudCommandSuggestion("inventory", "/inventory", "Inventory", ["inv", "bag", "items"]),
  createHudCommandSuggestion("questdev", "/questdev on", "Quest dev", ["npcdev", "devquests", "quest"]),
  createHudCommandSuggestion("vclip", "/vclip on", "VCLIP", ["noclip", "clip"]),
  createHudCommandSuggestion("day", "/day", "Force day", ["sun", "morning"]),
  createHudCommandSuggestion("night", "/night", "Force night", ["dark", "moon"]),
  createHudCommandSuggestion("navrecord", "/navrecord start", "Nav record", ["nav", "record", "path"]),
  createHudCommandSuggestion("forage", "/forage leaves", "Forage", ["leaves", "berries", "roots"]),
  createHudCommandSuggestion("brew", "/brew", "Brew potion", ["drink", "draught", "potion"]),
  createHudCommandSuggestion("darrelspawnhere", "/darrelspawnhere", "Darrel spawn", ["darrel", "setdarrelquestspawn"]),
];

export function getHudCommandSuggestions(value: string, maxCount = 5) {
  const normalized = value.replace(/^\/+/, "").trim().toLowerCase();
  let tokenEnd = normalized.length;
  for (let index = 0; index < normalized.length; index += 1) {
    const code = normalized.charCodeAt(index);
    if (code === 9 || code === 10 || code === 13 || code === 32) {
      tokenEnd = index;
      break;
    }
  }
  const firstToken = tokenEnd === normalized.length ? normalized : normalized.slice(0, tokenEnd);
  const suggestions: HudCommandSuggestion[] = [];

  for (let index = 0; index < HUD_COMMAND_SUGGESTIONS.length && suggestions.length < maxCount; index += 1) {
    const suggestion = HUD_COMMAND_SUGGESTIONS[index];
    if (!firstToken) {
      suggestions.push(suggestion);
      continue;
    }

    if (
      suggestion.command.startsWith(firstToken) ||
      suggestion.normalizedSample.includes(firstToken) ||
      suggestion.normalizedLabel.includes(firstToken)
    ) {
      suggestions.push(suggestion);
      continue;
    }

    for (let aliasIndex = 0; aliasIndex < suggestion.aliases.length; aliasIndex += 1) {
      if (suggestion.aliases[aliasIndex].startsWith(firstToken)) {
        suggestions.push(suggestion);
        break;
      }
    }
  }

  return suggestions;
}

export type HudCommandConsoleOpenOptions = {
  isGameLaunched: boolean;
  isCommandConsoleOpen: boolean;
  isSpellMenuOpen: boolean;
  isInventoryOpen: boolean;
  isTouchDevice: boolean;
  hasQuestNpcEditorTarget: boolean;
  hasQuestDialogSession: boolean;
  shouldRelockRef: BooleanRef;
  setKeyboardScoreboardOpen: (open: boolean) => void;
  setControllerScoreboardOpen: (open: boolean) => void;
  setControllerGameplayActive: (active: boolean) => void;
  setShowVideoMenu: (open: boolean) => void;
  setCommandConsoleValue: (value: string) => void;
  setCommandConsoleOpen: (open: boolean) => void;
  setIsLocked: (locked: boolean) => void;
};

export type HudCommandConsoleCloseOptions = {
  resumeGameplay?: boolean;
  shouldRelockRef: BooleanRef;
  setCommandConsoleOpen: (open: boolean) => void;
  setCommandConsoleValue: (value: string) => void;
  setIsReturningToGame: (returning: boolean) => void;
  requestGamePointerLock: () => void;
};

export function openHudCommandConsole({
  isGameLaunched,
  isCommandConsoleOpen,
  isSpellMenuOpen,
  isInventoryOpen,
  isTouchDevice,
  hasQuestNpcEditorTarget,
  hasQuestDialogSession,
  shouldRelockRef,
  setKeyboardScoreboardOpen,
  setControllerScoreboardOpen,
  setControllerGameplayActive,
  setShowVideoMenu,
  setCommandConsoleValue,
  setCommandConsoleOpen,
  setIsLocked,
}: HudCommandConsoleOpenOptions) {
  if (
    !isGameLaunched ||
    isCommandConsoleOpen ||
    isSpellMenuOpen ||
    hasQuestNpcEditorTarget ||
    hasQuestDialogSession ||
    isInventoryOpen
  ) {
    return false;
  }

  shouldRelockRef.current = Boolean(
    (isPointerLockActive() || isHudMouseLookFallbackActive()) && !isTouchDevice
  );
  setKeyboardScoreboardOpen(false);
  setControllerScoreboardOpen(false);
  setControllerGameplayActive(false);
  setShowVideoMenu(false);
  setCommandConsoleValue("/");
  setCommandConsoleOpen(true);
  setHudMouseGameplayActive(false);
  setMouseLookFallbackActive(false);
  setIsLocked(false);
  dispatchHudGameplayModalOpened();
  exitPointerLockIfActive();

  return true;
}

export function closeHudCommandConsole({
  resumeGameplay = true,
  shouldRelockRef,
  setCommandConsoleOpen,
  setCommandConsoleValue,
  setIsReturningToGame,
  requestGamePointerLock,
}: HudCommandConsoleCloseOptions) {
  setCommandConsoleOpen(false);
  setCommandConsoleValue("/");

  if (resumeGameplay && shouldRelockRef.current) {
    setIsReturningToGame(true);
    window.setTimeout(requestGamePointerLock, 0);
  }

  shouldRelockRef.current = false;
}
