import type { PlayerState } from "../../../store/gameStore";
import { getConnectedNetworkPlayerId, getLocalNetworkPlayerId } from "../../network/gameNetworkClient";
import type { ScoreboardRow } from "./PlayerScoreMenu";

type BuildScoreboardRowsOptions = {
  localPlayerName: string;
  isSurvivalMode: boolean;
  survivalLevel: number;
  health: number;
  armor: number;
  sleepSeconds: number;
  slowSeconds: number;
  poisonSeconds: number;
  acidSeconds: number;
  players: Record<string, PlayerState>;
  now: number;
};

function getLocalPlayerStatus({
  health,
  sleepSeconds,
  slowSeconds,
  poisonSeconds,
  acidSeconds,
}: Pick<BuildScoreboardRowsOptions, "health" | "sleepSeconds" | "slowSeconds" | "poisonSeconds" | "acidSeconds">) {
  if (health <= 0) return "DOWN";
  let status = "";
  if (sleepSeconds > 0) status = "SLEEP";
  if (slowSeconds > 0) status = status ? `${status} / SLOWED` : "SLOWED";
  if (poisonSeconds > 0) status = status ? `${status} / POISON` : "POISON";
  if (acidSeconds > 0) status = status ? `${status} / ACID` : "ACID";
  return status || "READY";
}

function getRemotePlayerStatus(player: PlayerState, now: number) {
  if (player.health <= 0) return "DOWN";
  let status = "";
  if (player.sleepUntil && player.sleepUntil > now) status = "SLEEP";
  if (player.slowUntil && player.slowUntil > now) status = status ? `${status} / SLOWED` : "SLOWED";
  if (player.poisonUntil && player.poisonUntil > now) status = status ? `${status} / POISON` : "POISON";
  if (player.acidUntil && player.acidUntil > now) status = status ? `${status} / ACID` : "ACID";
  return status || "READY";
}

export function buildScoreboardRows({
  localPlayerName,
  isSurvivalMode,
  survivalLevel,
  health,
  armor,
  sleepSeconds,
  slowSeconds,
  poisonSeconds,
  acidSeconds,
  players,
  now,
}: BuildScoreboardRowsOptions): ScoreboardRow[] {
  const localLevelSuffix = isSurvivalMode ? ` LVL ${survivalLevel}` : "";
  const localLabel = localPlayerName
    ? `YOU - ${localPlayerName}${localLevelSuffix}`
    : `YOU${localLevelSuffix}`;
  const connectedPlayerId = getConnectedNetworkPlayerId();
  const remotePlayers: PlayerState[] = [];
  for (const playerId in players) {
    if (!Object.prototype.hasOwnProperty.call(players, playerId)) continue;
    const player = players[playerId];
    if (player.id === connectedPlayerId) continue;
    remotePlayers.push(player);
  }
  remotePlayers.sort((a, b) => a.id.localeCompare(b.id));

  const rows: ScoreboardRow[] = [{
    id: getLocalNetworkPlayerId(),
    label: localLabel,
    status: getLocalPlayerStatus({ health, sleepSeconds, slowSeconds, poisonSeconds, acidSeconds }),
    health,
    armor,
    score: Math.max(0, Math.round(health + armor)),
    isLocal: true,
  }];

  for (let index = 0; index < remotePlayers.length; index += 1) {
    const player = remotePlayers[index];
    const playerArmor = player.armor ?? 0;
    rows.push({
      id: player.id,
      label: `${player.playerName || `WIZARD ${index + 1} (${player.id.slice(0, 4).toUpperCase()})`}${isSurvivalMode && player.survivalLevel ? ` LVL ${player.survivalLevel}` : ""}`,
      status: getRemotePlayerStatus(player, now),
      health: player.health,
      armor: playerArmor,
      score: Math.max(0, Math.round(player.health + playerArmor)),
    });
  }

  return rows;
}
