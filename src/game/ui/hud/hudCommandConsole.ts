import {
  FORCED_DAY_ELAPSED_SECONDS,
  FORCED_NIGHT_ELAPSED_SECONDS,
  clearDarrelQuestSpawnOverride,
  saveDarrelQuestSpawnOverride,
  useGameStore,
  type LobbyMessageTone,
  type QuestNpcEditorTarget,
} from "../../../store/gameStore";
import {
  clearNavigationRecordings,
  exportNavigationRecording,
  getNavigationRecorderStatus,
  startNavigationRecording,
  stopNavigationRecording,
} from "../../navigationRecorder";
import {
  getLastKnownLocalPlayerPosition,
  getPublishedLastPlayerYaw,
} from "../../systems/player/playerEventBridge";

export type HudCommandGameplayInputMode = "mouse" | "touch" | "controller";

export type HudCommandConsoleContext = {
  commandValue: string;
  touchGameplayActive: boolean;
  controllerGameplayActive: boolean;
  addLobbyMessage: (text: string, tone?: LobbyMessageTone) => void;
  closeCommandConsole: (resumeGameplay?: boolean) => void;
  setVClipEnabled: (enabled: boolean) => void;
  setQuestDevModeEnabled: (enabled: boolean) => void;
  openEngineMenu: (inputMode: HudCommandGameplayInputMode) => void;
  requestEnginePlaceable: (placeableId: string) => void;
  openQuestNpcEditor: (target: QuestNpcEditorTarget) => void;
  setInventoryOpen: (open: boolean) => void;
  setSurvivalTimeOverrideSeconds: (seconds: number | null) => void;
};

const TRUTHY_COMMAND_VALUES = ["on", "true", "1", "yes", "enable", "enabled"];
const FALSY_COMMAND_VALUES = ["off", "false", "0", "no", "disable", "disabled"];
const DEFAULT_TRUTHY_COMMAND_VALUES = ["", ...TRUTHY_COMMAND_VALUES];

function parseToggleCommandValue(
  normalizedValue: string,
  currentValue: boolean,
  options: { allowEmpty?: boolean } = {},
) {
  if ((options.allowEmpty && normalizedValue.length === 0) || normalizedValue === "toggle") {
    return !currentValue;
  }
  if (TRUTHY_COMMAND_VALUES.includes(normalizedValue)) return true;
  if (FALSY_COMMAND_VALUES.includes(normalizedValue)) return false;
  return null;
}

function getCommandInputMode(touchGameplayActive: boolean, controllerGameplayActive: boolean): HudCommandGameplayInputMode {
  return touchGameplayActive
    ? "touch"
    : controllerGameplayActive
      ? "controller"
      : "mouse";
}

function readCurrentPlayerDarrelSpawn() {
  const position = getLastKnownLocalPlayerPosition();
  const x = Number(position?.x);
  const y = Number(position?.y);
  const z = Number(position?.z);
  const yaw = Number(getPublishedLastPlayerYaw());

  return saveDarrelQuestSpawnOverride({
    x,
    y,
    z,
    yaw: Number.isFinite(yaw) ? yaw : undefined,
  });
}

function parseHudCommandParts(rawCommand: string) {
  const normalizedInput = rawCommand.replace(/^\/+/, "").trim();
  if (normalizedInput.length === 0) return [];

  const splitParts = normalizedInput.split(/\s+/);
  const commandParts: string[] = [];
  for (let index = 0; index < splitParts.length; index += 1) {
    const part = splitParts[index];
    if (part.length > 0) {
      commandParts.push(part);
    }
  }
  return commandParts;
}

export function submitHudCommandConsoleCommand({
  commandValue,
  touchGameplayActive,
  controllerGameplayActive,
  addLobbyMessage,
  closeCommandConsole,
  setVClipEnabled,
  setQuestDevModeEnabled,
  openEngineMenu,
  requestEnginePlaceable,
  openQuestNpcEditor,
  setInventoryOpen,
  setSurvivalTimeOverrideSeconds,
}: HudCommandConsoleContext) {
  const rawCommand = commandValue.trim();
  const commandParts = parseHudCommandParts(rawCommand);
  const [commandName = "", ...commandArgs] = commandParts;
  const rawValue = commandArgs.join(" ");
  const normalizedCommand = commandName.toLowerCase();
  const normalizedValue = rawValue.toLowerCase();

  if (!rawCommand.startsWith("/") || normalizedCommand.length === 0) {
    addLobbyMessage("Commands must start with /", "system");
    closeCommandConsole();
    return;
  }

  if (normalizedCommand === "vclip") {
    const nextEnabled = parseToggleCommandValue(
      normalizedValue,
      useGameStore.getState().isVClipEnabled,
      { allowEmpty: true },
    );

    if (nextEnabled === null) {
      addLobbyMessage("Usage: /vclip on or /vclip off", "system");
    } else {
      setVClipEnabled(nextEnabled);
      addLobbyMessage(`VCLIP ${nextEnabled ? "ENABLED" : "DISABLED"}`, "system");
    }

    closeCommandConsole();
    return;
  }

  if (normalizedCommand === "engine" || normalizedCommand === "devmenu" || normalizedCommand === "placemenu") {
    setQuestDevModeEnabled(true);
    const inputMode = getCommandInputMode(touchGameplayActive, controllerGameplayActive);
    closeCommandConsole(false);
    window.setTimeout(() => openEngineMenu(inputMode), 0);
    return;
  }

  if (normalizedCommand === "place") {
    const placeableId = commandArgs[0]?.toLowerCase();
    if (!placeableId) {
      addLobbyMessage("Usage: /place hut-log-cabin", "system");
    } else {
      requestEnginePlaceable(placeableId);
    }
    closeCommandConsole();
    return;
  }

  if (normalizedCommand === "questdev" || normalizedCommand === "npcdev" || normalizedCommand === "devquests") {
    const [rawAction = "", ...openTargetParts] = commandArgs;
    const action = rawAction.toLowerCase();
    if (action === "open" || action === "editor") {
      const requestedNpcId = openTargetParts.join("-").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
      const npcId = requestedNpcId || "manual-dev-npc";
      setQuestDevModeEnabled(true);
      openQuestNpcEditor({
        npcId,
        townId: "manual-dev-town",
        hutId: npcId,
        defaultName: "Manual Quest NPC",
        theme: "village",
        position: [0, 0, 0],
      });
      addLobbyMessage(`Editing ${npcId}`, "system");
      closeCommandConsole(false);
      return;
    }

    const nextEnabled = parseToggleCommandValue(
      normalizedValue,
      useGameStore.getState().isQuestDevModeEnabled,
      { allowEmpty: true },
    );

    if (nextEnabled === null) {
      addLobbyMessage("Usage: /questdev on or /questdev off", "system");
    } else {
      setQuestDevModeEnabled(nextEnabled);
      addLobbyMessage(`QUEST DEV ${nextEnabled ? "ENABLED" : "DISABLED"}`, "system");
    }

    closeCommandConsole();
    return;
  }

  if (normalizedCommand === "darrelhere" || normalizedCommand === "claimdarrel" || normalizedCommand === "setdarrel") {
    window.dispatchEvent(new Event("quest-claim-darrel-here"));
    addLobbyMessage("Claiming Darrel at your current hut or target.", "system");
    closeCommandConsole();
    return;
  }

  if (normalizedCommand === "darrelspawnhere" || normalizedCommand === "darrelquestspawnhere" || normalizedCommand === "setdarrelquestspawn") {
    const spawn = readCurrentPlayerDarrelSpawn();

    if (spawn) {
      addLobbyMessage(`Darrel realm spawn set: X ${spawn.x.toFixed(1)} Y ${spawn.y.toFixed(1)} Z ${spawn.z.toFixed(1)}`, "system");
    } else {
      addLobbyMessage("Could not read current player position for Darrel spawn.", "system");
    }
    closeCommandConsole();
    return;
  }

  if (normalizedCommand === "resetdarrelspawn" || normalizedCommand === "cleardarrelspawn") {
    clearDarrelQuestSpawnOverride();
    addLobbyMessage("Darrel realm spawn reset to authored default.", "system");
    closeCommandConsole();
    return;
  }

  if (normalizedCommand === "inventory" || normalizedCommand === "inv") {
    setInventoryOpen(true);
    closeCommandConsole(false);
    return;
  }

  if (normalizedCommand === "forage") {
    const ingredient = normalizedValue === "leaf" ? "leaves" : normalizedValue;
    if (ingredient === "leaves" || ingredient === "berries" || ingredient === "roots") {
      useGameStore.getState().collectDarrelIngredient(ingredient);
    } else {
      addLobbyMessage("Usage: /forage leaves, /forage berries, or /forage roots", "system");
    }
    closeCommandConsole();
    return;
  }

  if (normalizedCommand === "brew") {
    useGameStore.getState().brewDarrelGardenDraught();
    closeCommandConsole();
    return;
  }

  if (normalizedCommand === "drinkpotion" || normalizedCommand === "drinkdraught" || normalizedCommand === "drink") {
    closeCommandConsole(false);
    useGameStore.getState().drinkDarrelGardenDraught();
    return;
  }

  if (normalizedCommand === "night") {
    const falsy = [...FALSY_COMMAND_VALUES, "clear", "reset", "day"];

    if (DEFAULT_TRUTHY_COMMAND_VALUES.includes(normalizedValue)) {
      setSurvivalTimeOverrideSeconds(FORCED_NIGHT_ELAPSED_SECONDS);
      addLobbyMessage("NIGHT FORCED", "system");
    } else if (falsy.includes(normalizedValue)) {
      setSurvivalTimeOverrideSeconds(null);
      addLobbyMessage("DAY/NIGHT CYCLE RESUMED", "system");
    } else {
      addLobbyMessage("Usage: /night or /night off", "system");
    }

    closeCommandConsole();
    return;
  }

  if (normalizedCommand === "day") {
    const falsy = [...FALSY_COMMAND_VALUES, "clear", "reset", "cycle"];

    if (DEFAULT_TRUTHY_COMMAND_VALUES.includes(normalizedValue)) {
      setSurvivalTimeOverrideSeconds(FORCED_DAY_ELAPSED_SECONDS);
      addLobbyMessage("DAY FORCED", "system");
    } else if (falsy.includes(normalizedValue)) {
      setSurvivalTimeOverrideSeconds(null);
      addLobbyMessage("DAY/NIGHT CYCLE RESUMED", "system");
    } else {
      addLobbyMessage("Usage: /day or /day off", "system");
    }

    closeCommandConsole();
    return;
  }

  if (normalizedCommand === "navrecord" || normalizedCommand === "nav") {
    const [rawAction = "status", ...labelParts] = commandArgs;
    const action = rawAction.toLowerCase();
    const label = labelParts.join(" ");
    const activeStatus = getNavigationRecorderStatus();

    if (["start", "on", "begin", "record"].includes(action)) {
      const result = startNavigationRecording(label || undefined);
      addLobbyMessage(result.message, "system");
    } else if (["stop", "off", "end", "finish"].includes(action)) {
      const result = stopNavigationRecording();
      addLobbyMessage(result.message, "system");
    } else if (["export", "save", "download"].includes(action)) {
      const result = exportNavigationRecording();
      addLobbyMessage(result.message, "system");
    } else if (["clear", "reset", "delete"].includes(action)) {
      const result = clearNavigationRecordings();
      addLobbyMessage(result.message, "system");
    } else if (["status", "info"].includes(action)) {
      const seconds = Math.round(activeStatus.durationMs / 1000);
      addLobbyMessage(
        activeStatus.active
          ? `NAV recording ${activeStatus.label}: ${activeStatus.sampleCount} samples, ${seconds}s`
          : `NAV idle: ${activeStatus.storedSessionCount} saved sessions`,
        "system",
      );
    } else {
      addLobbyMessage("Usage: /navrecord start, stop, export, status, or clear", "system");
    }

    closeCommandConsole();
    return;
  }

  addLobbyMessage(`Unknown command: /${normalizedCommand}`, "system");
  closeCommandConsole();
}
