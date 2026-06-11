import { useGameStore } from "../../../store/gameStore";

function isLocalQaHost(hostname: string) {
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.endsWith(".local")
  ) {
    return true;
  }

  if (hostname.startsWith("10.") || hostname.startsWith("192.168.")) {
    return true;
  }

  const private172Match = hostname.match(/^172\.(\d{1,2})\./);
  if (!private172Match) return false;
  const secondOctet = Number(private172Match[1]);
  return secondOctet >= 16 && secondOctet <= 31;
}

export function isDevSurvivalObserver() {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  const survivalQaRequested = params.get("qaSurvival") === "1" ||
    params.has("qaSurvivalChunk") ||
    params.get("qaSpellDummies") === "1" ||
    params.get("spawnMountain") === "1" ||
    params.get("spawnGraveyard") === "1";
  if (!survivalQaRequested) return false;
  return import.meta.env.DEV || isLocalQaHost(window.location.hostname);
}

let survivalQaObserverApplied = false;

export function applySurvivalQaObserver() {
  if (!isDevSurvivalObserver()) return;
  const state = useGameStore.getState();
  if (
    survivalQaObserverApplied &&
    state.localPlayerName &&
    state.gameMode === "solo-survival" &&
    state.isGameLaunched
  ) {
    document.documentElement.dataset.wofQaSurvivalObserver = "1";
    document.documentElement.dataset.wofQaSurvivalObserverMode = state.gameMode;
    return;
  }

  survivalQaObserverApplied = true;
  if (!state.localPlayerName) {
    state.setLocalPlayerName("TerrainQA");
  }
  state.setGameMode("solo-survival");
  state.setGameLaunched(true);
  document.documentElement.dataset.wofQaSurvivalObserver = "1";
  document.documentElement.dataset.wofQaSurvivalObserverMode = useGameStore.getState().gameMode;
}
