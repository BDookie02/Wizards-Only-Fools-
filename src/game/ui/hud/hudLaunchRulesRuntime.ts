import {
  ENEMY_DIFFICULTY_SETTINGS,
  LOBBY_MAP_PRESETS,
  MANA_SPAWN_RATE_SETTINGS,
  type GameMode,
  type LobbyRules,
  type SurvivalRules,
} from "../../../store/gameStore";
import {
  MULTIPLAYER_MAX_PLAYERS_PER_ROOM,
  MULTIPLAYER_MIN_CUSTOM_LOBBY_PLAYERS,
  MULTIPLAYER_MIN_SURVIVAL_PLAYERS,
} from "../../network/multiplayerSessionConfig";
import { cycleOption } from "./hudSettingsUtils";
import type { StartMenuStage } from "./PauseStartMenuContent";

export type HudRuleStepDirection = 1 | -1;
export type HudStartMenuAction =
  | { type: "set-stage"; stage: StartMenuStage; pauseMenuIndex: number }
  | { type: "launch"; mode: GameMode }
  | { type: "cycle-lobby-map" }
  | { type: "adjust-lobby-max-players" }
  | { type: "cycle-lobby-difficulty" }
  | { type: "cycle-lobby-mana-rate" }
  | { type: "toggle-lobby-friendly-fire" }
  | { type: "adjust-survival-max-players" }
  | { type: "cycle-survival-difficulty" }
  | { type: "cycle-survival-mana-rate" }
  | { type: "toggle-survival-friendly-fire" }
  | { type: "join-invite" };

function clampHudRulePlayerCount(value: number, minPlayers: number) {
  return Math.max(minPlayers, Math.min(MULTIPLAYER_MAX_PLAYERS_PER_ROOM, value));
}

export function getNextHudLobbyMapRules(
  lobbyRules: Pick<LobbyRules, "mapPreset">,
  direction: HudRuleStepDirection,
): Pick<LobbyRules, "mapPreset"> {
  return {
    mapPreset: cycleOption(LOBBY_MAP_PRESETS, lobbyRules.mapPreset, direction) as LobbyRules["mapPreset"],
  };
}

export function getNextHudLobbyDifficultyRules(
  lobbyRules: Pick<LobbyRules, "enemyDifficulty">,
  direction: HudRuleStepDirection,
): Pick<LobbyRules, "enemyDifficulty"> {
  return {
    enemyDifficulty: cycleOption(ENEMY_DIFFICULTY_SETTINGS, lobbyRules.enemyDifficulty, direction) as LobbyRules["enemyDifficulty"],
  };
}

export function getNextHudSurvivalDifficultyRules(
  survivalRules: Pick<SurvivalRules, "enemyDifficulty">,
  direction: HudRuleStepDirection,
): Pick<SurvivalRules, "enemyDifficulty"> {
  return {
    enemyDifficulty: cycleOption(ENEMY_DIFFICULTY_SETTINGS, survivalRules.enemyDifficulty, direction) as SurvivalRules["enemyDifficulty"],
  };
}

export function getNextHudLobbyManaRateRules(
  lobbyRules: Pick<LobbyRules, "manaSpawnRate">,
  direction: HudRuleStepDirection,
): Pick<LobbyRules, "manaSpawnRate"> {
  return {
    manaSpawnRate: cycleOption(MANA_SPAWN_RATE_SETTINGS, lobbyRules.manaSpawnRate, direction) as LobbyRules["manaSpawnRate"],
  };
}

export function getNextHudSurvivalManaRateRules(
  survivalRules: Pick<SurvivalRules, "manaSpawnRate">,
  direction: HudRuleStepDirection,
): Pick<SurvivalRules, "manaSpawnRate"> {
  return {
    manaSpawnRate: cycleOption(MANA_SPAWN_RATE_SETTINGS, survivalRules.manaSpawnRate, direction) as SurvivalRules["manaSpawnRate"],
  };
}

export function getNextHudLobbyMaxPlayersRules(
  lobbyRules: Pick<LobbyRules, "maxPlayers">,
  direction: HudRuleStepDirection,
): Pick<LobbyRules, "maxPlayers"> {
  return {
    maxPlayers: clampHudRulePlayerCount(lobbyRules.maxPlayers + direction, MULTIPLAYER_MIN_CUSTOM_LOBBY_PLAYERS),
  };
}

export function getNextHudSurvivalMaxPlayersRules(
  survivalRules: Pick<SurvivalRules, "maxPlayers">,
  direction: HudRuleStepDirection,
): Pick<SurvivalRules, "maxPlayers"> {
  return {
    maxPlayers: clampHudRulePlayerCount(survivalRules.maxPlayers + direction, MULTIPLAYER_MIN_SURVIVAL_PLAYERS),
  };
}

export function resolveHudStartMenuAction(startMenuStage: StartMenuStage, index: number): HudStartMenuAction | null {
  switch (startMenuStage) {
    case "press-start":
      return { type: "set-stage", stage: "mode-select", pauseMenuIndex: 0 };
    case "mode-select":
      return index === 0
        ? { type: "launch", mode: "solo-survival" }
        : { type: "set-stage", stage: "multiplayer-select", pauseMenuIndex: 0 };
    case "multiplayer-select":
      if (index === 0) return { type: "set-stage", stage: "custom-lobby", pauseMenuIndex: 0 };
      if (index === 1) return { type: "set-stage", stage: "survival-options", pauseMenuIndex: 0 };
      return { type: "set-stage", stage: "mode-select", pauseMenuIndex: 1 };
    case "custom-lobby":
      if (index === 0) return { type: "cycle-lobby-map" };
      if (index === 1) return { type: "adjust-lobby-max-players" };
      if (index === 2) return { type: "cycle-lobby-difficulty" };
      if (index === 3) return { type: "cycle-lobby-mana-rate" };
      if (index === 4) return { type: "toggle-lobby-friendly-fire" };
      if (index === 5) return { type: "join-invite" };
      if (index === 6) return { type: "launch", mode: "custom-lobby" };
      return { type: "set-stage", stage: "multiplayer-select", pauseMenuIndex: 0 };
    case "survival-options":
      if (index === 0) return { type: "adjust-survival-max-players" };
      if (index === 1) return { type: "cycle-survival-difficulty" };
      if (index === 2) return { type: "cycle-survival-mana-rate" };
      if (index === 3) return { type: "toggle-survival-friendly-fire" };
      if (index === 4) return { type: "join-invite" };
      if (index === 5) return { type: "launch", mode: "multiplayer-survival" };
      return { type: "set-stage", stage: "multiplayer-select", pauseMenuIndex: 1 };
    case "resume":
      return null;
  }
}
