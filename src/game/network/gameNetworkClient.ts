import { MULTIPLAYER_NETWORK_EVENTS, sanitizeOutgoingNetworkEventArgs } from "./multiplayerEventContracts";

export const LOCAL_NETWORK_PLAYER_ID = "local";

export type EnginePlaceableNetworkObject = {
  instanceId: string;
  placeableId: string;
  label: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
};

type GameNetworkTransport = {
  getPlayerId: () => string | null;
  isConnected: () => boolean;
  emit: (eventName: string, ...args: unknown[]) => void;
};

let gameNetworkTransport: GameNetworkTransport | null = null;

export function bindGameNetworkTransport(transport: GameNetworkTransport) {
  gameNetworkTransport = transport;
}

export function clearGameNetworkTransport(transport?: GameNetworkTransport) {
  if (!transport || gameNetworkTransport === transport) {
    gameNetworkTransport = null;
  }
}

export function getConnectedNetworkPlayerId() {
  if (!gameNetworkTransport?.isConnected()) return null;
  return gameNetworkTransport.getPlayerId();
}

export function getLocalNetworkPlayerId() {
  return getConnectedNetworkPlayerId() || LOCAL_NETWORK_PLAYER_ID;
}

export function isLocalNetworkPlayerId(playerId: string | null | undefined) {
  return playerId === getLocalNetworkPlayerId();
}

export function isLocalPresencePlayerId(playerId: string | null | undefined) {
  const connectedPlayerId = getConnectedNetworkPlayerId();
  return playerId === LOCAL_NETWORK_PLAYER_ID || (!!connectedPlayerId && playerId === connectedPlayerId);
}

export function isNetworkConnected() {
  return gameNetworkTransport?.isConnected() ?? false;
}

export function getGameNetworkEventNowMs() {
  return Date.now();
}

export function getNetworkPlayerIdsKey(players: Record<string, unknown>) {
  let key = "";
  for (const playerId in players) {
    if (!Object.prototype.hasOwnProperty.call(players, playerId)) continue;
    key = key ? `${key},${playerId}` : playerId;
  }
  return key;
}

export function visitNetworkPlayerIdsKey(playerIdsKey: string, visit: (playerId: string) => boolean | void) {
  let startIndex = 0;
  for (let index = 0; index <= playerIdsKey.length; index += 1) {
    if (index < playerIdsKey.length && playerIdsKey.charCodeAt(index) !== 44) continue;
    if (index > startIndex && visit(playerIdsKey.slice(startIndex, index)) === false) {
      return false;
    }
    startIndex = index + 1;
  }
  return true;
}

function playerIdSegmentEquals(playerIdsKey: string, startIndex: number, endIndex: number, playerId: string) {
  if (endIndex - startIndex !== playerId.length) return false;
  for (let index = 0; index < playerId.length; index += 1) {
    if (playerIdsKey.charCodeAt(startIndex + index) !== playerId.charCodeAt(index)) return false;
  }
  return true;
}

export function hasRemoteNetworkPlayerId(playerIdsKey: string, localPlayerId: string | undefined) {
  let startIndex = 0;
  for (let index = 0; index <= playerIdsKey.length; index += 1) {
    if (index < playerIdsKey.length && playerIdsKey.charCodeAt(index) !== 44) continue;
    if (index > startIndex && (!localPlayerId || !playerIdSegmentEquals(playerIdsKey, startIndex, index, localPlayerId))) {
      return true;
    }
    startIndex = index + 1;
  }
  return false;
}

export function emitGameNetworkEvent(eventName: string, ...args: unknown[]) {
  if (!gameNetworkTransport?.isConnected()) return false;
  const safeArgs = sanitizeOutgoingNetworkEventArgs(eventName, args);
  if (!safeArgs) return false;
  gameNetworkTransport.emit(eventName, ...safeArgs);
  return true;
}

export function emitLocalPlayerDamage(amount: number) {
  const playerId = getConnectedNetworkPlayerId();
  if (!playerId) return false;
  emitGameNetworkEvent("hitPlayer", playerId, amount);
  return true;
}

export function emitClearLocalStatusEffects(effects: string[]) {
  const playerId = getConnectedNetworkPlayerId();
  if (!playerId) return false;
  emitGameNetworkEvent("clearStatusEffect", { targetId: playerId, effects });
  return true;
}

export function emitEnginePlaceableNetworkUpsert(object: EnginePlaceableNetworkObject) {
  return emitGameNetworkEvent(MULTIPLAYER_NETWORK_EVENTS.ENGINE_PLACEABLE_UPSERT, { object });
}

export function emitEnginePlaceableNetworkDelete(instanceId: string) {
  return emitGameNetworkEvent(MULTIPLAYER_NETWORK_EVENTS.ENGINE_PLACEABLE_DELETE, { instanceId });
}

export function emitEnginePlaceableNetworkSnapshot(objects: EnginePlaceableNetworkObject[]) {
  return emitGameNetworkEvent(MULTIPLAYER_NETWORK_EVENTS.ENGINE_PLACEABLE_SNAPSHOT, { objects });
}
