import {
  ENEMY_DIFFICULTY_SETTINGS,
  LOBBY_MAP_PRESETS,
  MANA_SPAWN_RATE_SETTINGS,
  type LobbyRules,
  type SurvivalRules,
} from "../../../store/gameStore";
import {
  MULTIPLAYER_MAX_PLAYERS_PER_ROOM,
  MULTIPLAYER_MIN_CUSTOM_LOBBY_PLAYERS,
  MULTIPLAYER_MIN_SURVIVAL_PLAYERS,
} from "../../network/multiplayerSessionConfig";
import { cycleOption } from "./hudSettingsUtils";

export type HudRuleStepDirection = 1 | -1;

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
