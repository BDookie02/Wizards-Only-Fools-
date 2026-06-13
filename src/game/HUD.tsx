import { startTransition, Suspense, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import {
  ALL_SPELLS,
  HOTBAR_SIZE,
  SPELL_DISPLAY_NAMES,
  SPELL_QUEST_DEFINITIONS,
  SLEEP_DURATION_MS,
  TUNGSTON_SLOW_DURATION_MS,
  DEFAULT_CONTROLLER_LOOK_SENSITIVITY,
  DEFAULT_VOICE_OUTPUT_VOLUME,
  DEFAULT_VOICE_PROXIMITY_RANGE,
  DEFAULT_VOICE_PUSH_TO_TALK_KEY,
  getSurvivalDifficultyMultiplier,
  useGameStore,
  SpellType,
  HandType,
  GameMode,
  ControllerAction,
  type QuestDialogSession,
  sanitizePlayerName,
} from "../store/gameStore";
import {
  canRequestPointerLockHere,
  isPermanentPointerLockRejection,
  isPointerLockSecurityError,
  setMouseLookFallbackActive,
  shouldUseRemoteMouseLookFallback,
} from "./systems/input/browserDisplayMode";
import {
  createControllerPollScheduler,
  GAMEPAD_NO_DEVICE_POLL_INTERVAL_MS,
  getPrimaryGamepad,
  hasGamepadInput,
  isGamepadButtonPressed,
  type GamepadButtonName,
} from "./systems/input/controllerInput";
import { controllerActionRows, controllerButtonOptions } from "./systems/input/controllerSettingsConfig";
import { isEditableTarget } from "./systems/input/editableTargets";
import { requestTouchFullscreenMode, subscribeDocumentFullscreenState } from "./systems/input/fullscreenRuntime";
import { CONTROLLER_INVENTORY_HOLD_MS, MAGIC_UNARM_HOLD_MS, getPlatformDefaultLookSensitivity } from "./systems/input/hudInputConfig";
import { getNumberSlotFromCode } from "./systems/input/playerInputState";
import type { DevFastTravelLocation } from "./tools/devFastTravel";
import { releaseMobileGameplayInputs } from "./ui/hud/mobileTouchEvents";
import { readCurrentHudQaRouteFlags } from "./ui/hud/hudQaRouteFlags";
import { isQuestNpcEditorTarget } from "./ui/hud/questNpcEditorGuard";
import { dispatchEnginePlaceableSignal, subscribeEnginePlaceableEvent } from "./systems/placeables/enginePlaceableEvents";
import { wrapIndex } from "./ui/hud/hudSettingsUtils";
import {
  getNextHudLobbyDifficultyRules,
  getNextHudLobbyManaRateRules,
  getNextHudLobbyMapRules,
  getNextHudLobbyMaxPlayersRules,
  getNextHudSurvivalDifficultyRules,
  getNextHudSurvivalManaRateRules,
  getNextHudSurvivalMaxPlayersRules,
  resolveHudStartMenuAction,
  type HudStartMenuAction,
} from "./ui/hud/hudLaunchRulesRuntime";
import { useHudLobbyMessageCleanup } from "./ui/hud/useHudLobbyMessageCleanup";
import { clampMenuIndex, findDirectionalMenuIndex, getHudMenuNowMs, type MenuDirection } from "./ui/hud/hudMenuNavigation";
import {
  clearHudEnginePlaceables,
  deleteHudEnginePlacedObject,
  formatHudEnginePlaceableResultMessage,
  moveHudEnginePlacedObject,
  previewHudEnginePlaceable,
  previewHudEnginePlacedObject,
  requestHudEnginePlaceable,
  type EnginePlaceableOptions,
  type EnginePlaceableSelection,
  type EnginePlacedObjectSelection,
} from "./ui/hud/hudEnginePlaceableRuntime";
import {
  HUD_SURVIVAL_AUTOSAVE_INTERVAL_MS,
  installHudSurvivalAutosaveLoop,
  isHudSurvivalGameMode,
  shouldRunHudSurvivalAutosave,
} from "./ui/hud/hudSurvivalAutosaveRuntime";
import {
  LazyCommandConsole,
  LazyDevFastTravelMenu,
  LazyEngineMenu,
  LazyFullscreenHelpModal,
  LazyHudLayoutQaMetricsProbe,
  LazyHudStateQaRuntimeProbe,
  LazyHudSettingsPanel,
  LazyInventoryPanel,
  LazyLobbyChatBox,
  LazyMagicHands,
  LazyMobileTouchControls,
  LazyPlayerNamePrompt,
  LazyPlayerScoreMenu,
  LazyQuestDialogPanel,
  LazyQuestNpcEditor,
  LazySpellMenu,
} from "./ui/hud/hudLazyModules";
import {
  aspectRatioOptions,
  keybindBackIndex,
  keybindArrowLookIndex,
  keybindControlStartIndex,
  keybindSensitivityStartIndex,
  pauseMenuItemCount,
  settingsTabCount,
  videoAspectStartIndex,
  videoBackIndex,
  voiceEnabledIndex,
  voiceInputModeIndex,
  voiceOutputVolumeIndex,
  voiceProximityRangeIndex,
  voicePushToTalkKeyIndex,
  type SettingsPane,
  getSettingsActionCount,
  getSettingsPaneForTabIndex,
} from "./ui/hud/hudSettingsPanelConfig";
import { getCharacterCustomizationStep } from "./ui/hud/characterCustomizationRuntime";
import { closeHudCommandConsole, openHudCommandConsole } from "./ui/hud/hudCommandConsoleRuntime";
import {
  getHudFillSafeFrameStyle,
  getHudMainMenuActionCount,
  HUD_ROOT_STYLE,
  resolveHudDeveloperToolAccess,
  resolveHudMenuOverlayState,
} from "./ui/hud/hudOverlayRuntime";
import {
  countOwnRecordEntries,
  getHudScoreboardSourceUpdate,
  type HudScoreboardSource,
} from "./ui/hud/hudScoreboardRuntime";
import {
  dispatchHudGameplayModalOpened,
  exitPointerLockIfActive,
  getHudPointerLockNowMs,
  getHudPointerLockRequester,
  getHudPointerLockResumeGraceUntil,
  getHudPointerLockTarget,
  installHudMouseGameplayResumeLoop,
  isHudMouseLookFallbackActive,
  isPointerLockActive,
  setHudMouseGameplayActive,
  shouldPollHudMouseGameplayResume,
  shouldTreatPointerLockLossAsResumeGrace,
} from "./ui/hud/hudMouseGameplayRuntime";
import {
  consumeHudControllerPress,
  consumeHudControllerRepeat,
  canOpenControllerDevFastTravelMenu,
  canUseControllerInventory,
  canUseControllerMagicShortcut,
  canUseControllerMapShortcut,
  dispatchInventoryControllerBack,
  dispatchInventoryControllerMove,
  dispatchInventoryControllerSelect,
  dispatchSpellMenuControllerNavigate,
  dispatchSpellMenuControllerScroll,
  dispatchSpellMenuControllerSelect,
  hasHudControllerGameplaySignal,
  isStandingStillForControllerInventory,
  createHudControllerInputSnapshot,
  readHudControllerInputSnapshotInto,
  resetHudControllerInventoryHoldState,
  resetHudControllerMagicHoldState,
  resetHudControllerTransientState,
} from "./ui/hud/hudControllerRuntime";
import { GameplayHudOverlay } from "./ui/hud/GameplayHudOverlay";
import { PauseStartMenuContent, type StartMenuStage } from "./ui/hud/PauseStartMenuContent";
import {
  getCurrentInviteRoomCode,
  getCurrentLanMobileInviteUrl,
  resolveInviteRoomJoin,
  shouldRequireSecureOriginForVoice,
  type LanInfoResponse,
} from "./network/inviteRoom";
import { useHudTouchGameplayRuntime } from "./ui/hud/useHudTouchGameplayRuntime";
import { setHudMapSuppressedByToolOverlay } from "./ui/hud/hudMapSuppressionRuntime";
import {
  installHudRunePowerDecayLoop,
  shouldRunHudRunePowerDecay,
} from "./ui/hud/hudRunePowerDecayRuntime";
import {
  clearHudKeyboardMagicHoldState,
  resolveHudKeyboardMagicHoldRelease,
  startHudKeyboardMagicHold,
} from "./ui/hud/hudKeyboardMagicRuntime";

let hudCommandConsoleModulePromise: Promise<typeof import("./ui/hud/hudCommandConsole")> | null = null;

function loadHudCommandConsoleModule() {
  hudCommandConsoleModulePromise ??= import("./ui/hud/hudCommandConsole");
  return hudCommandConsoleModulePromise;
}

let devFastTravelModulePromise: Promise<typeof import("./tools/devFastTravel")> | null = null;

function loadDevFastTravelModule() {
  devFastTravelModulePromise ??= import("./tools/devFastTravel");
  return devFastTravelModulePromise;
}

type GameplayInputMode = "mouse" | "touch" | "controller";
type HudPlayerState = {
  isMoving: boolean;
  isSprinting: boolean;
  isSliding: boolean;
  isCrouching: boolean;
  isGrounded: boolean;
  isMeditating: boolean;
};

export function HUD() {
  const health = useGameStore(s => s.health);
  const armor = useGameStore(s => s.armor);
  const currentSpell = useGameStore(s => s.currentSpell);
  const leftCurrentSpell = useGameStore(s => s.leftCurrentSpell);
  const rightCurrentSpell = useGameStore(s => s.rightCurrentSpell);
  const leftHotbarSpells = useGameStore(s => s.leftHotbarSpells);
  const rightHotbarSpells = useGameStore(s => s.rightHotbarSpells);
  const leftSelectedHotbarIndex = useGameStore(s => s.leftSelectedHotbarIndex);
  const rightSelectedHotbarIndex = useGameStore(s => s.rightSelectedHotbarIndex);
  const activeHand = useGameStore(s => s.activeHand);
  const setActiveHand = useGameStore(s => s.setActiveHand);
  const isMagicArmed = useGameStore(s => s.isMagicArmed);
  const setMagicArmed = useGameStore(s => s.setMagicArmed);
  const setSpell = useGameStore(s => s.setSpell);
  const selectHotbarSlot = useGameStore(s => s.selectHotbarSlot);
  const setHotbarSpell = useGameStore(s => s.setHotbarSpell);
  const isSpellMenuOpen = useGameStore(s => s.isSpellMenuOpen);
  const setSpellMenuOpen = useGameStore(s => s.setSpellMenuOpen);
  const thrusterFuel = useGameStore(s => s.thrusterFuel);
  const leftRunePower = useGameStore(s => s.leftRunePower);
  const rightRunePower = useGameStore(s => s.rightRunePower);
  const speedBoostUntil = useGameStore(s => s.speedBoostUntil);
  const jumpBoostUntil = useGameStore(s => s.jumpBoostUntil);
  const slowUntil = useGameStore(s => s.slowUntil);
  const sleepUntil = useGameStore(s => s.sleepUntil);
  const poisonUntil = useGameStore(s => s.poisonUntil);
  const acidUntil = useGameStore(s => s.acidUntil);
  const magicGlassOrbUntil = useGameStore(s => s.magicGlassOrbUntil);
  const flashbangOpacity = useGameStore(s => s.flashbangOpacity);
  const setLeftRunePower = useGameStore(s => s.setLeftRunePower);
  const setRightRunePower = useGameStore(s => s.setRightRunePower);
  const setHandCharging = useGameStore(s => s.setHandCharging);
  const isMapExpanded = useGameStore(s => s.isMapExpanded);
  const toggleMap = useGameStore(s => s.toggleMap);
  const setExpandedMapPage = useGameStore(s => s.setExpandedMapPage);
  const setPauseMenuOpen = useGameStore(s => s.setPauseMenuOpen);
  const isScoreboardOpen = useGameStore(s => s.isScoreboardOpen);
  const setScoreboardOpen = useGameStore(s => s.setScoreboardOpen);
  const isInventoryOpen = useGameStore(s => s.isInventoryOpen);
  const setInventoryOpen = useGameStore(s => s.setInventoryOpen);
  const isTouchControlsActive = useGameStore(s => s.isTouchControlsActive);
  const setTouchControlsActive = useGameStore(s => s.setTouchControlsActive);
  const isControllerGameplayActive = useGameStore(s => s.isControllerGameplayActive);
  const setControllerGameplayActive = useGameStore(s => s.setControllerGameplayActive);
  const mouseSensitivity = useGameStore(s => s.mouseSensitivity);
  const controllerLookSensitivity = useGameStore(s => s.controllerLookSensitivity);
  const keyboardArrowLookEnabled = useGameStore(s => s.keyboardArrowLookEnabled);
  const setMouseSensitivity = useGameStore(s => s.setMouseSensitivity);
  const setControllerLookSensitivity = useGameStore(s => s.setControllerLookSensitivity);
  const setKeyboardArrowLookEnabled = useGameStore(s => s.setKeyboardArrowLookEnabled);
  const controllerBindings = useGameStore(s => s.controllerBindings);
  const setControllerBinding = useGameStore(s => s.setControllerBinding);
  const voiceChatEnabled = useGameStore(s => s.voiceChatEnabled);
  const voiceInputMode = useGameStore(s => s.voiceInputMode);
  const voicePushToTalkKey = useGameStore(s => s.voicePushToTalkKey);
  const voiceOutputVolume = useGameStore(s => s.voiceOutputVolume);
  const voiceProximityRange = useGameStore(s => s.voiceProximityRange);
  const isVoiceSpeaking = useGameStore(s => s.isVoiceSpeaking);
  const voiceStatus = useGameStore(s => s.voiceStatus);
  const voiceError = useGameStore(s => s.voiceError);
  const setVoiceChatEnabled = useGameStore(s => s.setVoiceChatEnabled);
  const setVoiceInputMode = useGameStore(s => s.setVoiceInputMode);
  const setVoicePushToTalkKey = useGameStore(s => s.setVoicePushToTalkKey);
  const setVoiceOutputVolume = useGameStore(s => s.setVoiceOutputVolume);
  const setVoiceProximityRange = useGameStore(s => s.setVoiceProximityRange);
  const characterCustomization = useGameStore(s => s.characterCustomization);
  const setCharacterCustomization = useGameStore(s => s.setCharacterCustomization);
  const gameMode = useGameStore(s => s.gameMode);
  const isGameLaunched = useGameStore(s => s.isGameLaunched);
  const setGameMode = useGameStore(s => s.setGameMode);
  const setGameLaunched = useGameStore(s => s.setGameLaunched);
  const lobbyRules = useGameStore(s => s.lobbyRules);
  const setLobbyRules = useGameStore(s => s.setLobbyRules);
  const survivalRules = useGameStore(s => s.survivalRules);
  const setSurvivalRules = useGameStore(s => s.setSurvivalRules);
  const localPlayerName = useGameStore(s => s.localPlayerName);
  const setLocalPlayerName = useGameStore(s => s.setLocalPlayerName);
  const survivalSave = useGameStore(s => s.survivalSave);
  const survivalLevel = useGameStore(s => s.survivalLevel);
  const saveSurvivalProgress = useGameStore(s => s.saveSurvivalProgress);
  const lobbyMessages = useGameStore(s => s.lobbyMessages);
  const addLobbyMessage = useGameStore(s => s.addLobbyMessage);
  const removeLobbyMessage = useGameStore(s => s.removeLobbyMessage);
  const isVClipEnabled = useGameStore(s => s.isVClipEnabled);
  const setVClipEnabled = useGameStore(s => s.setVClipEnabled);
  const setSurvivalTimeOverrideSeconds = useGameStore(s => s.setSurvivalTimeOverrideSeconds);
  const players = useGameStore(s => s.players);
  const isQuestDevModeEnabled = useGameStore(s => s.isQuestDevModeEnabled);
  const setQuestDevModeEnabled = useGameStore(s => s.setQuestDevModeEnabled);
  const questNpcEditorTarget = useGameStore(s => s.questNpcEditorTarget);
  const questDialogSession = useGameStore(s => s.questDialogSession);
  const openQuestNpcEditor = useGameStore(s => s.openQuestNpcEditor);
  const closeQuestNpcEditor = useGameStore(s => s.closeQuestNpcEditor);

  const aspectRatio = useGameStore(s => s.aspectRatio);
  const setAspectRatio = useGameStore(s => s.setAspectRatio);
  const isFillAspect = aspectRatio === "Fill";
  const fillSafeFrameStyle = getHudFillSafeFrameStyle(aspectRatio);
  const hudRootStyle = HUD_ROOT_STYLE;
  const [showVideoMenu, setShowVideoMenu] = useState(false);

  const [isLocked, setIsLocked] = useState(false);
  const [isDocumentFullscreen, setIsDocumentFullscreen] = useState(false);
  const [isFullscreenHintOpen, setIsFullscreenHintOpen] = useState(false);
  const [canLock, setCanLock] = useState(true);
  const [isReturningToGame, setIsReturningToGame] = useState(false);
  const [isPauseOverlayOpen, setPauseOverlayOpen] = useState(() => {
    const state = useGameStore.getState();
    return state.isGameLaunched && !state.isControllerGameplayActive && !state.isTouchControlsActive;
  });
  const [playerState, setPlayerState] = useState<HudPlayerState>({
    isMoving: false,
    isSprinting: false,
    isSliding: false,
    isCrouching: false,
    isGrounded: true,
    isMeditating: false
  });
  const [menuSpellIndex, setMenuSpellIndex] = useState(0);
  const [isRightHandModifier, setIsRightHandModifier] = useState(false);
  const [menuBindingHand, setMenuBindingHand] = useState<HandType>("left");
  const [pauseMenuIndex, setPauseMenuIndex] = useState(0);
  const [isDevFastTravelOpen, setDevFastTravelOpen] = useState(false);
  const [devFastTravelIndex, setDevFastTravelIndex] = useState(0);
  const [devFastTravelLocations, setDevFastTravelLocations] = useState<DevFastTravelLocation[]>([]);
  const [isEngineMenuOpen, setEngineMenuOpen] = useState(false);
  const [engineMenuSelectedId, setEngineMenuSelectedId] = useState<string | undefined>();
  const [startMenuStage, setStartMenuStage] = useState<StartMenuStage>(() => (
    useGameStore.getState().isGameLaunched ? "resume" : "press-start"
  ));
  const [inviteCodeInput, setInviteCodeInput] = useState(() => getCurrentInviteRoomCode());
  const [inviteCodeMessage, setInviteCodeMessage] = useState("");
  const [playerNameInput, setPlayerNameInput] = useState(() => localPlayerName);
  const [isCommandConsoleOpen, setCommandConsoleOpen] = useState(false);
  const [commandConsoleValue, setCommandConsoleValue] = useState("/");
  const [settingsPane, setSettingsPane] = useState<SettingsPane>("video");
  const [remappingAction, setRemappingAction] = useState<ControllerAction | null>(null);
  const [remappingVoiceKey, setRemappingVoiceKey] = useState(false);
  const qHeldRef = useRef(false);
  const keyboardScoreboardRef = useRef(false);
  const controllerScoreboardRef = useRef(false);
  const controllerResumeRequestedRef = useRef(false);
  const pointerLockUnavailableRef = useRef(false);
  const pointerLockRequestIdRef = useRef(0);
  const pointerLockResumeGraceUntilRef = useRef(0);
  const pauseMenuExplicitlyRequestedRef = useRef(false);
  const pauseMenuRequestedRef = useRef(
    useGameStore.getState().isGameLaunched &&
    !useGameStore.getState().isControllerGameplayActive &&
    !useGameStore.getState().isTouchControlsActive
  );
  const commandConsoleShouldRelockRef = useRef(false);
  const lastGameplayInputModeRef = useRef<GameplayInputMode>(
    useGameStore.getState().isControllerGameplayActive
      ? "controller"
      : useGameStore.getState().isTouchControlsActive
        ? "touch"
        : "mouse"
  );
  const lastMapToggleRef = useRef(0);
  const remapReadyAtRef = useRef(0);
  const controllerLastSeenAtRef = useRef(0);
  const settingsScrollRef = useRef<HTMLDivElement>(null);
  const controllerButtonsRef = useRef<Record<string, boolean>>({});
  const controllerRepeatRef = useRef<Partial<Record<string, number>>>({});
  const controllerInputSnapshot = useMemo(createHudControllerInputSnapshot, []);
  const controllerInventoryHoldStartedAtRef = useRef<number | null>(null);
  const controllerInventoryTapEligibleRef = useRef(false);
  const controllerInventoryIgnoreUntilReleaseRef = useRef(false);
  const devFastTravelOpenedAtRef = useRef(0);
  const keyboardMagicHoldStartedAtRef = useRef<number | null>(null);
  const keyboardMagicHoldTimeoutRef = useRef<number | null>(null);
  const keyboardMagicHoldConsumedRef = useRef(false);
  const controllerMagicHoldStartedAtRef = useRef<number | null>(null);
  const controllerMagicHoldConsumedRef = useRef(false);

  const isTouchDevice = useHudTouchGameplayRuntime({
    isGameLaunched,
    isTouchControlsActive,
    lastGameplayInputModeRef,
    setControllerGameplayActive,
    setIsReturningToGame,
    setPauseMenuOpen,
    setPauseOverlayOpen,
    setShowVideoMenu,
    setTouchControlsActive,
  });

  useEffect(() => () => {
    setHudMouseGameplayActive(false);
  }, []);

  useEffect(() => subscribeDocumentFullscreenState(setIsDocumentFullscreen), []);

  useEffect(() => {
    if (localPlayerName) {
      setPlayerNameInput(localPlayerName);
    }
  }, [localPlayerName]);

  useEffect(() => {
    if (!isQuestDevModeEnabled) return undefined;

    const handleQuestNpcEditorRequest = (event: Event) => {
      const target = (event as CustomEvent<unknown>).detail;
      if (!isQuestNpcEditorTarget(target)) return;
      openQuestNpcEditor(target);
      addLobbyMessage(`Editing ${target.npcId}`, "system");
    };

    window.addEventListener("quest-npc-editor-request", handleQuestNpcEditorRequest);
    return () => window.removeEventListener("quest-npc-editor-request", handleQuestNpcEditorRequest);
  }, [addLobbyMessage, isQuestDevModeEnabled, openQuestNpcEditor]);

  useEffect(() => {
    if (isGameLaunched && startMenuStage === "press-start") {
      setStartMenuStage("resume");
    }
  }, [isGameLaunched, startMenuStage]);

  useEffect(() => {
    if (!isDevFastTravelOpen) return undefined;

    let cancelled = false;
    void loadDevFastTravelModule().then((module) => {
      if (!cancelled) setDevFastTravelLocations(module.DEV_FAST_TRAVEL_LOCATIONS);
    }).catch(() => {
      if (!cancelled) {
        setDevFastTravelLocations([]);
        addLobbyMessage("Fast travel locations unavailable.", "system");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [addLobbyMessage, isDevFastTravelOpen]);

  useHudLobbyMessageCleanup(lobbyMessages, removeLobbyMessage);

  const touchGameplayActive = isTouchDevice && isTouchControlsActive;
  const controllerGameplayActive = isControllerGameplayActive;
  const hasRunePowerToDecay = leftRunePower > 0 || rightRunePower > 0;
  const {
    qaHudState,
    shouldMountHudStateQaRuntimeProbe,
    qaMagicSpell,
    qaMapPage,
    qaSettingsPane,
    shouldMountHudLayoutQaMetricsProbe,
    isMenuOverlaySuppressedForQa,
    shouldHideGameplayViewObstructionsForQa,
    shouldHideGameplayHudForQa,
  } = useMemo(() => readCurrentHudQaRouteFlags(), []);
  const hasPointerLock = isPointerLockActive();
  const hasMouseLookFallback = isHudMouseLookFallbackActive();
  const mouseGameplayActive = !pauseMenuRequestedRef.current && (hasPointerLock || hasMouseLookFallback);
  const isGameplayActive = mouseGameplayActive || touchGameplayActive || controllerGameplayActive;
  const {
    isResumePauseOverlayRequested,
    menuOverlayStyle,
    shouldRenderGameplayHud,
    shouldShowMenuOverlay,
  } = resolveHudMenuOverlayState({
    isCommandConsoleOpen,
    isGameLaunched,
    isGameplayActive,
    isInventoryOpen,
    isMenuOverlaySuppressedForQa,
    isPauseOverlayOpen,
    isReturningToGame,
    isSpellMenuOpen,
    mouseGameplayActive,
    pauseMenuExplicitlyRequested: pauseMenuExplicitlyRequestedRef.current,
    pauseMenuRequested: pauseMenuRequestedRef.current,
    questDialogActive: Boolean(questDialogSession),
    questNpcEditorActive: Boolean(questNpcEditorTarget),
    showVideoMenu,
    startMenuStage,
  });
  const roomUrl = window.location.href;
  const currentInviteRoomCode = getCurrentInviteRoomCode();
  const voiceNeedsSecureOrigin = shouldRequireSecureOriginForVoice(window.isSecureContext, window.location.hostname);
  const isMultiplayerMode = gameMode !== "solo-survival";
  const isSurvivalMode = gameMode === "solo-survival" || gameMode === "multiplayer-survival";
  const {
    isDevFastTravelAllowed,
    isEngineMenuAllowed,
  } = resolveHudDeveloperToolAccess({
    gameMode,
    isDevBuild: import.meta.env.DEV,
    isQuestDevModeEnabled,
    isSurvivalMode,
  });
  const devFastTravelLocationCount = devFastTravelLocations.length;
  const resumeMenuActionCount = isMultiplayerMode ? pauseMenuItemCount : 2;
  const settingsActionCount = getSettingsActionCount(settingsPane);
  const mainMenuActionCount = getHudMainMenuActionCount(startMenuStage, resumeMenuActionCount);
  const isPauseMenuVisible = shouldShowMenuOverlay && isGameLaunched && startMenuStage === "resume";
  const activeBindingHand: HandType = isRightHandModifier ? "right" : menuBindingHand;
  const requestMapToggle = (now: number) => {
    if (now - lastMapToggleRef.current < 180) return;
    lastMapToggleRef.current = now;
    startTransition(toggleMap);
  };
  const copyInvite = () => {
    void (async () => {
      let inviteUrl = roomUrl;
      try {
        const response = await fetch("/api/lan-info", { cache: "no-store" });
        if (response.ok) {
          const info = await response.json() as LanInfoResponse;
          inviteUrl = getCurrentLanMobileInviteUrl(info, roomUrl);
        }
      } catch {
        // Fall back to the current URL if the LAN helper is unavailable.
      }

      await navigator.clipboard?.writeText(inviteUrl).catch(() => {});
    })();
  };

  const joinInviteCode = () => {
    const joinResolution = resolveInviteRoomJoin(inviteCodeInput, currentInviteRoomCode, window.location.href);
    if (joinResolution.roomCode) {
      setInviteCodeInput(joinResolution.roomCode);
    }
    if (joinResolution.status !== "navigate") {
      setInviteCodeMessage(joinResolution.message);
      return;
    }

    window.location.assign(joinResolution.nextUrl);
  };

  const submitPlayerName = () => {
    const cleaned = sanitizePlayerName(playerNameInput);
    if (cleaned.length < 2) return;
    setLocalPlayerName(cleaned);
  };

  const setScoreboardSource = (source: HudScoreboardSource, open: boolean) => {
    const update = getHudScoreboardSourceUpdate({
      source,
      open,
      keyboardOpen: keyboardScoreboardRef.current,
      controllerOpen: controllerScoreboardRef.current,
      currentOpen: useGameStore.getState().isScoreboardOpen,
    });
    if (!update.changed) return;

    keyboardScoreboardRef.current = update.keyboardOpen;
    controllerScoreboardRef.current = update.controllerOpen;
    if (update.shouldSetOpen) {
      setScoreboardOpen(update.open);
    }
  };

  const finishMouseGameplayResume = (mode: "pointer-lock" | "fallback" = "pointer-lock") => {
    pauseMenuExplicitlyRequestedRef.current = false;
    pauseMenuRequestedRef.current = false;
    pointerLockResumeGraceUntilRef.current = 0;
    setHudMouseGameplayActive(true);
    setMouseLookFallbackActive(mode === "fallback");
    lastGameplayInputModeRef.current = "mouse";
    setIsLocked(true);
    setPauseOverlayOpen(false);
    setPauseMenuOpen(false);
    setIsReturningToGame(false);
    setShowVideoMenu(false);
    setRemappingAction(null);
    setRemappingVoiceKey(false);
    setTouchControlsActive(false);
    releaseMobileGameplayInputs();
    setControllerGameplayActive(false);
    setScoreboardSource("keyboard", false);
    setScoreboardSource("controller", false);
    getHudPointerLockTarget()?.focus({ preventScroll: true });
  };

  const openPauseMenuFromGameplay = (inputMode: GameplayInputMode) => {
    pointerLockRequestIdRef.current += 1;
    pauseMenuExplicitlyRequestedRef.current = true;
    pauseMenuRequestedRef.current = true;
    pointerLockResumeGraceUntilRef.current = 0;
    setHudMouseGameplayActive(false);
    setMouseLookFallbackActive(false);
    lastGameplayInputModeRef.current = inputMode;
    setStartMenuStage("resume");
    setPauseMenuIndex(0);
    setPauseOverlayOpen(true);
    setIsReturningToGame(false);
    setShowVideoMenu(false);
    setRemappingAction(null);
    setRemappingVoiceKey(false);
    setTouchControlsActive(false);
    releaseMobileGameplayInputs();
    setControllerGameplayActive(false);
    setScoreboardSource("keyboard", false);
    setScoreboardSource("controller", false);
    setIsLocked(false);
    setCanLock(true);
    setPauseMenuOpen(true);
    exitPointerLockIfActive();
  };

  const beginControllerRemap = (action: ControllerAction) => {
    remapReadyAtRef.current = getHudMenuNowMs() + 260;
    setRemappingVoiceKey(false);
    setRemappingAction(action);
  };

  const beginVoiceKeyRemap = () => {
    setRemappingAction(null);
    setRemappingVoiceKey(true);
  };

  const toggleVoiceInputMode = () => {
    setVoiceInputMode(voiceInputMode === "openMic" ? "pushToTalk" : "openMic");
  };

  const scrollSettingsPanel = (amount: number) => {
    const panel = settingsScrollRef.current;
    if (!panel) return;
    panel.scrollTop += amount;
  };

  const adjustFocusedSetting = (direction: 1 | -1) => {
    if (!showVideoMenu) {
      if (startMenuStage === "custom-lobby") {
        if (pauseMenuIndex === 0) {
          cycleLobbyMap(direction);
          return true;
        }
        if (pauseMenuIndex === 1) {
          adjustLobbyMaxPlayers(direction);
          return true;
        }
        if (pauseMenuIndex === 2) {
          cycleLobbyDifficulty(direction);
          return true;
        }
        if (pauseMenuIndex === 3) {
          cycleLobbyManaRate(direction);
          return true;
        }
      }

      if (startMenuStage === "survival-options") {
        if (pauseMenuIndex === 0) {
          adjustSurvivalMaxPlayers(direction);
          return true;
        }
        if (pauseMenuIndex === 1) {
          cycleSurvivalDifficulty(direction);
          return true;
        }
        if (pauseMenuIndex === 2) {
          cycleSurvivalManaRate(direction);
          return true;
        }
      }

      return false;
    }

    if (settingsPane === "keybinds" && pauseMenuIndex === keybindSensitivityStartIndex) {
      setMouseSensitivity(mouseSensitivity + direction * 0.00025);
      return true;
    }

    if (settingsPane === "keybinds" && pauseMenuIndex === keybindSensitivityStartIndex + 1) {
      setControllerLookSensitivity(controllerLookSensitivity + direction * 0.25);
      return true;
    }

    if (settingsPane === "keybinds" && pauseMenuIndex === keybindArrowLookIndex) {
      setKeyboardArrowLookEnabled(!keyboardArrowLookEnabled);
      return true;
    }

    if (settingsPane === "voice") {
      if (pauseMenuIndex === voiceEnabledIndex) {
        setVoiceChatEnabled(!voiceChatEnabled);
        return true;
      }

      if (pauseMenuIndex === voiceInputModeIndex) {
        toggleVoiceInputMode();
        return true;
      }

      if (pauseMenuIndex === voiceOutputVolumeIndex) {
        setVoiceOutputVolume(voiceOutputVolume + direction * 0.05);
        return true;
      }

      if (pauseMenuIndex === voiceProximityRangeIndex) {
        setVoiceProximityRange(voiceProximityRange + direction * 2);
        return true;
      }
    }

    if (settingsPane === "character") {
      const nextCharacterUpdate = getCharacterCustomizationStep(characterCustomization, pauseMenuIndex, direction);
      if (nextCharacterUpdate) {
        setCharacterCustomization(nextCharacterUpdate);
        return true;
      }
    }

    return false;
  };

  useEffect(() => {
    setPauseMenuOpen(isGameLaunched && startMenuStage === "resume" && isPauseMenuVisible);
    return () => setPauseMenuOpen(false);
  }, [isGameLaunched, isPauseMenuVisible, setPauseMenuOpen, startMenuStage]);

  // Deplete rune energy
  useEffect(() => {
    if (!isGameLaunched) {
      qHeldRef.current = false;
      setIsRightHandModifier(false);
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isCommandConsoleOpen || questNpcEditorTarget || questDialogSession || isInventoryOpen || isEditableTarget(e.target)) return;
      if (e.code !== "KeyQ" || e.repeat) return;
      qHeldRef.current = true;
      setIsRightHandModifier(true);
      setMenuBindingHand("right");
      setActiveHand("right");
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (isCommandConsoleOpen || questNpcEditorTarget || questDialogSession || isInventoryOpen || isEditableTarget(e.target)) return;
      if (e.code !== "KeyQ") return;
      qHeldRef.current = false;
      setIsRightHandModifier(false);
      if (!useGameStore.getState().isSpellMenuOpen) {
        setMenuBindingHand("left");
        setActiveHand("left");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [isCommandConsoleOpen, isGameLaunched, isInventoryOpen, questDialogSession, questNpcEditorTarget, setActiveHand]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isCommandConsoleOpen || questNpcEditorTarget || questDialogSession || isInventoryOpen || isEditableTarget(e.target)) return;
      if (
        e.code === "Escape" &&
        isGameLaunched &&
        startMenuStage === "resume" &&
        !isPauseMenuVisible &&
        !isSpellMenuOpen &&
        !showVideoMenu
      ) {
        e.preventDefault();
        e.stopPropagation();
        openPauseMenuFromGameplay(touchGameplayActive
          ? "touch"
          : controllerGameplayActive
            ? "controller"
            : "mouse");
        return;
      }

      if (e.code === "Escape" && !isLocked && !isSpellMenuOpen && isReturningToGame) {
        e.preventDefault();
        e.stopPropagation();
        setIsReturningToGame(false);
        pauseMenuExplicitlyRequestedRef.current = true;
        pauseMenuRequestedRef.current = true;
        setPauseOverlayOpen(true);
        setPauseMenuOpen(true);
        return;
      }

      if (e.code === "Escape" && !isLocked && !isSpellMenuOpen && showVideoMenu) {
        e.preventDefault();
        e.stopPropagation();
        setShowVideoMenu(false);
        setSettingsPane("video");
        setRemappingAction(null);
        setRemappingVoiceKey(false);
        setPauseMenuIndex(3);
        pauseMenuExplicitlyRequestedRef.current = true;
        pauseMenuRequestedRef.current = true;
        setPauseOverlayOpen(true);
        setPauseMenuOpen(true);
        return;
      }

    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [controllerGameplayActive, isCommandConsoleOpen, isGameLaunched, isInventoryOpen, isLocked, isPauseMenuVisible, isReturningToGame, isSpellMenuOpen, openPauseMenuFromGameplay, questDialogSession, questNpcEditorTarget, setPauseMenuOpen, showVideoMenu, startMenuStage, touchGameplayActive]);

  useEffect(() => {
    if (!shouldRunHudRunePowerDecay({
      controllerGameplayActive,
      hasRunePowerToDecay,
      isLocked,
      touchGameplayActive,
    })) return;

    return installHudRunePowerDecayLoop({
      getState: useGameStore.getState,
      setLeftRunePower,
      setRightRunePower,
      setTimer: (callback, delayMs) => window.setTimeout(callback, delayMs),
      clearTimer: (timerId) => window.clearTimeout(timerId),
    });
  }, [
    controllerGameplayActive,
    hasRunePowerToDecay,
    isLocked,
    setLeftRunePower,
    setRightRunePower,
    touchGameplayActive,
  ]);

  useEffect(() => {
    const handleLockChange = () => {
      const locked = isPointerLockActive();
      setIsLocked(locked);
      if (locked) {
        setHudMouseGameplayActive(true);
        finishMouseGameplayResume();
      } else {
        if (shouldTreatPointerLockLossAsResumeGrace({
          nowMs: getHudPointerLockNowMs(),
          pauseRequested: pauseMenuRequestedRef.current,
          resumeGraceUntilMs: pointerLockResumeGraceUntilRef.current,
        })) {
          setHudMouseGameplayActive(false);
          setCanLock(true);
          return;
        }
        setHudMouseGameplayActive(false);
        setCanLock(true);
        if (
          useGameStore.getState().isGameLaunched &&
          !useGameStore.getState().isSpellMenuOpen &&
          !useGameStore.getState().questNpcEditorTarget &&
          !useGameStore.getState().questDialogSession &&
          !useGameStore.getState().isInventoryOpen &&
          !isCommandConsoleOpen &&
          !pauseMenuRequestedRef.current
        ) {
          pauseMenuExplicitlyRequestedRef.current = true;
          pauseMenuRequestedRef.current = true;
          setStartMenuStage("resume");
          setPauseOverlayOpen(true);
          setPauseMenuOpen(true);
        }
      }
    };
    const handlePlayerState = (e: any) => setPlayerState(prev => {
      if (
        prev.isMoving === e.detail.isMoving && 
        prev.isSprinting === e.detail.isSprinting && 
        prev.isSliding === e.detail.isSliding &&
        prev.isCrouching === Boolean(e.detail.isCrouching) &&
        prev.isGrounded === e.detail.isGrounded &&
        prev.isMeditating === e.detail.isMeditating
      ) return prev;
      return { ...e.detail, isCrouching: Boolean(e.detail.isCrouching) };
    });
    const handlePointerError = (e: Event) => {
      // Embedded browsers may reject pointer lock; keep the fallback quiet and recoverable.
      e.stopImmediatePropagation();
    };

    const handleUnhandledRejection = (e: PromiseRejectionEvent) => {
      if (isPointerLockSecurityError(e.reason)) {
        e.preventDefault();
      }
    };

    document.addEventListener("pointerlockchange", handleLockChange);
    window.addEventListener("pointerlockerror", handlePointerError, true);
    document.addEventListener("pointerlockerror", handlePointerError, true);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    window.addEventListener("player-state", handlePlayerState);
    return () => {
      document.removeEventListener("pointerlockchange", handleLockChange);
      window.removeEventListener("pointerlockerror", handlePointerError, true);
      document.removeEventListener("pointerlockerror", handlePointerError, true);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
      window.removeEventListener("player-state", handlePlayerState);
    };
  }, [isCommandConsoleOpen, isReturningToGame, setPauseMenuOpen, setTouchControlsActive]);

  useEffect(() => {
    if (!isGameLaunched) return;

    const reconcileMouseGameplayResume = () => {
      if (pauseMenuRequestedRef.current || !isPointerLockActive()) return;
      if (!isPauseOverlayOpen && !isReturningToGame && !showVideoMenu && isLocked) return;

      setHudMouseGameplayActive(true);
      lastGameplayInputModeRef.current = "mouse";
      setIsLocked(true);
      setPauseOverlayOpen(false);
      setPauseMenuOpen(false);
      setIsReturningToGame(false);
      setShowVideoMenu(false);
      setRemappingAction(null);
      setRemappingVoiceKey(false);
      setTouchControlsActive(false);
      releaseMobileGameplayInputs();
      setControllerGameplayActive(false);
      setScoreboardSource("keyboard", false);
      setScoreboardSource("controller", false);
    };

    const shouldPollMouseGameplayResume = () => shouldPollHudMouseGameplayResume({
      controllerGameplayActive,
      isLocked,
      isPauseOverlayOpen,
      isReturningToGame,
      pointerLockActive: isPointerLockActive(),
      showVideoMenu,
      touchGameplayActive,
    });

    reconcileMouseGameplayResume();
    if (!shouldPollMouseGameplayResume()) return;

    return installHudMouseGameplayResumeLoop({
      reconcile: reconcileMouseGameplayResume,
      shouldPoll: shouldPollMouseGameplayResume,
      setTimer: (callback, delayMs) => window.setTimeout(callback, delayMs),
      clearTimer: (timerId) => window.clearTimeout(timerId),
    });
  }, [
    controllerGameplayActive,
    isGameLaunched,
    isLocked,
    isPauseOverlayOpen,
    isReturningToGame,
    setControllerGameplayActive,
    setPauseMenuOpen,
    setTouchControlsActive,
    showVideoMenu,
    touchGameplayActive,
  ]);

  useEffect(() => {
    if (!isSpellMenuOpen) return;
    const index = ALL_SPELLS.indexOf(currentSpell as SpellType);
    setMenuSpellIndex(index === -1 ? 0 : index);
  }, [currentSpell, isSpellMenuOpen]);

  const requestMobileFullscreen = (showHintOnFailure = true) => {
    return requestTouchFullscreenMode({
      onFullscreenStateChange: setIsDocumentFullscreen,
      onFullscreenHintChange: setIsFullscreenHintOpen,
    }, showHintOnFailure);
  };

  const startTouchGameplay = () => {
    if (!localPlayerName) {
      return false;
    }

    pointerLockRequestIdRef.current += 1;
    pauseMenuExplicitlyRequestedRef.current = false;
    pauseMenuRequestedRef.current = false;
    pointerLockResumeGraceUntilRef.current = 0;
    setHudMouseGameplayActive(false);
    if (!isTouchDevice) {
      setTouchControlsActive(false);
      releaseMobileGameplayInputs();
      return false;
    }

    requestMobileFullscreen(false);
    lastGameplayInputModeRef.current = "touch";
    setPauseOverlayOpen(false);
    setPauseMenuOpen(false);
    setTouchControlsActive(true);
    setControllerGameplayActive(false);
    setIsReturningToGame(false);
    setShowVideoMenu(false);
    setRemappingAction(null);
    setRemappingVoiceKey(false);
    setCanLock(true);
    return true;
  };

  const pauseTouchGameplay = () => {
    openPauseMenuFromGameplay("touch");
  };

  const startControllerGameplay = () => {
    if (!localPlayerName) {
      return false;
    }

    pointerLockRequestIdRef.current += 1;
    pauseMenuExplicitlyRequestedRef.current = false;
    pauseMenuRequestedRef.current = false;
    pointerLockResumeGraceUntilRef.current = 0;
    setHudMouseGameplayActive(false);
    setTouchControlsActive(false);
    releaseMobileGameplayInputs();
    lastGameplayInputModeRef.current = "controller";
    setPauseOverlayOpen(false);
    setPauseMenuOpen(false);
    setControllerGameplayActive(true);
    setIsReturningToGame(false);
    setShowVideoMenu(false);
    setRemappingAction(null);
    setRemappingVoiceKey(false);
    setCanLock(true);
    window.dispatchEvent(new Event("controller-gameplay-started"));
    return true;
  };

  useEffect(() => {
    if (!isTouchDevice || !isGameLaunched || !localPlayerName) return;

    let lastTouchTakeoverAt = 0;
    const shouldBlockTouchTakeover = () => {
      const state = useGameStore.getState();
      return (
        !state.isGameLaunched ||
        !state.localPlayerName ||
        state.health <= 0 ||
        state.isSpellMenuOpen ||
        state.isInventoryOpen ||
        state.isMapExpanded ||
        state.isScoreboardOpen ||
        Boolean(state.questNpcEditorTarget) ||
        Boolean(state.questDialogSession) ||
        isCommandConsoleOpen ||
        isDevFastTravelOpen ||
        isEngineMenuOpen ||
        isPauseMenuVisible ||
        isReturningToGame ||
        showVideoMenu ||
        remappingAction !== null ||
        remappingVoiceKey
      );
    };

    const handleTouchGameplayTakeover = (event: PointerEvent | TouchEvent) => {
      if ("pointerType" in event && event.pointerType !== "touch") return;
      if (isEditableTarget(event.target)) return;
      if (shouldBlockTouchTakeover()) return;

      const state = useGameStore.getState();
      if (state.isTouchControlsActive && lastGameplayInputModeRef.current === "touch") return;

      const now = window.performance.now();
      if (now - lastTouchTakeoverAt < 48) return;
      lastTouchTakeoverAt = now;
      startTouchGameplay();
    };

    window.addEventListener("pointerdown", handleTouchGameplayTakeover, { capture: true, passive: true });
    window.addEventListener("touchstart", handleTouchGameplayTakeover, { capture: true, passive: true });
    return () => {
      window.removeEventListener("pointerdown", handleTouchGameplayTakeover, { capture: true });
      window.removeEventListener("touchstart", handleTouchGameplayTakeover, { capture: true });
    };
  }, [
    isCommandConsoleOpen,
    isDevFastTravelOpen,
    isEngineMenuOpen,
    isGameLaunched,
    isPauseMenuVisible,
    isReturningToGame,
    isTouchDevice,
    localPlayerName,
    remappingAction,
    remappingVoiceKey,
    showVideoMenu,
    startTouchGameplay,
  ]);

  const pauseControllerGameplay = () => {
    openPauseMenuFromGameplay("controller");
  };

  const pauseGameplayFromController = () => {
    openPauseMenuFromGameplay(touchGameplayActive ? "touch" : "controller");
    exitPointerLockIfActive();
  };

  const previewEnginePlaceable = (placeable: EnginePlaceableSelection | string, options?: EnginePlaceableOptions) => {
    return previewHudEnginePlaceable(placeable, options, setEngineMenuSelectedId);
  };

  const requestEnginePlaceable = (placeable: EnginePlaceableSelection | string, options?: EnginePlaceableOptions) => {
    return requestHudEnginePlaceable(placeable, options, setEngineMenuSelectedId);
  };

  const clearEnginePlaceables = () => {
    clearHudEnginePlaceables();
  };

  const previewEnginePlacedObject = (object: EnginePlacedObjectSelection, options?: EnginePlaceableOptions) => {
    return previewHudEnginePlacedObject(object, options, setEngineMenuSelectedId);
  };

  const moveEnginePlacedObject = (object: EnginePlacedObjectSelection, options?: EnginePlaceableOptions) => {
    return moveHudEnginePlacedObject(object, options, setEngineMenuSelectedId);
  };

  const deleteEnginePlacedObject = (instanceId: string) => {
    return deleteHudEnginePlacedObject(instanceId);
  };

  const closeEngineMenu = (resumeGameplay = true) => {
    setEngineMenuOpen(false);
    dispatchEnginePlaceableSignal("wof-engine-placeable-preview-clear");
    if (!resumeGameplay) return;

    const inputMode = lastGameplayInputModeRef.current;
    window.setTimeout(() => {
      if (inputMode === "controller") {
        startControllerGameplay();
      } else if (inputMode === "touch") {
        startTouchGameplay();
      } else {
        setIsReturningToGame(true);
        requestGamePointerLock();
      }
    }, 0);
  };

  const openEngineMenu = (inputMode: GameplayInputMode) => {
    if (
      !isEngineMenuAllowed ||
      !isGameLaunched ||
      isEngineMenuOpen ||
      isInventoryOpen ||
      isSpellMenuOpen ||
      questDialogSession ||
      questNpcEditorTarget
    ) {
      return false;
    }

    pointerLockRequestIdRef.current += 1;
    pointerLockResumeGraceUntilRef.current = 0;
    lastGameplayInputModeRef.current = inputMode;
    pauseMenuExplicitlyRequestedRef.current = false;
    pauseMenuRequestedRef.current = false;
    setHudMouseGameplayActive(false);
    setMouseLookFallbackActive(false);
    setScoreboardSource("keyboard", false);
    setScoreboardSource("controller", false);
    setPauseOverlayOpen(false);
    setPauseMenuOpen(false);
    setShowVideoMenu(false);
    setRemappingAction(null);
    setRemappingVoiceKey(false);
    setTouchControlsActive(false);
    releaseMobileGameplayInputs();
    setControllerGameplayActive(false);
    if (isMapExpanded) {
      startTransition(toggleMap);
    }
    setIsReturningToGame(false);
    setIsLocked(false);
    setCanLock(true);
    setEngineMenuOpen(true);
    dispatchHudGameplayModalOpened();

    exitPointerLockIfActive();
    return true;
  };
  const setQuestDialogSessionForQa = (questDialogSession: QuestDialogSession | null) => {
    useGameStore.setState({ questDialogSession });
  };

  const hudStateQaOptions = {
    activeHand,
    controllerGameplayActive,
    isGameLaunched,
    isMapExpanded,
    qaHudState,
    qaMagicSpell,
    qaMapPage,
    qaSettingsPane,
    touchGameplayActive,
    lastGameplayInputModeRef,
    pauseMenuExplicitlyRequestedRef,
    pauseMenuRequestedRef,
    pointerLockRequestIdRef,
    pointerLockResumeGraceUntilRef,
    closeQuestNpcEditor,
    openEngineMenu,
    openQuestNpcEditor,
    releaseMobileGameplayInputs,
    setCanLock,
    setControllerGameplayActive,
    setDevFastTravelOpen,
    setEngineMenuOpen,
    setHandCharging,
    setInventoryOpen,
    setIsLocked,
    setIsReturningToGame,
    setLeftRunePower,
    setMagicArmed,
    setMenuBindingHand,
    setExpandedMapPage,
    setMouseLookFallbackActive,
    setPauseMenuIndex,
    setPauseMenuOpen,
    setPauseOverlayOpen,
    setQuestDialogSession: setQuestDialogSessionForQa,
    setQuestDevModeEnabled,
    setRemappingAction,
    setRemappingVoiceKey,
    setRightRunePower,
    setScoreboardSource,
    setSettingsPane,
    setShowVideoMenu,
    setSpell,
    setSpellMenuOpen,
    setStartMenuStage,
    setTouchControlsActive,
    toggleMap,
    videoAspectStartIndex,
  };

  const closeDevFastTravelMenu = (resumeGameplay = true) => {
    setDevFastTravelOpen(false);
    if (!resumeGameplay) return;

    const inputMode = lastGameplayInputModeRef.current;
    window.setTimeout(() => {
      if (inputMode === "controller") {
        startControllerGameplay();
      } else if (inputMode === "touch") {
        startTouchGameplay();
      } else {
        setIsReturningToGame(true);
        requestGamePointerLock();
      }
    }, 0);
  };

  const openDevFastTravelMenu = (inputMode: GameplayInputMode) => {
    if (
      !isDevFastTravelAllowed ||
      !isGameLaunched ||
      isCommandConsoleOpen ||
      isInventoryOpen ||
      isSpellMenuOpen ||
      questDialogSession ||
      questNpcEditorTarget
    ) {
      return false;
    }

    pointerLockRequestIdRef.current += 1;
    pointerLockResumeGraceUntilRef.current = 0;
    lastGameplayInputModeRef.current = inputMode;
    pauseMenuExplicitlyRequestedRef.current = false;
    pauseMenuRequestedRef.current = false;
    setHudMouseGameplayActive(false);
    setMouseLookFallbackActive(false);
    setScoreboardSource("keyboard", false);
    setScoreboardSource("controller", false);
    setPauseOverlayOpen(false);
    setPauseMenuOpen(false);
    setShowVideoMenu(false);
    setRemappingAction(null);
    setRemappingVoiceKey(false);
    setTouchControlsActive(false);
    releaseMobileGameplayInputs();
    setControllerGameplayActive(false);
    if (isMapExpanded) {
      startTransition(toggleMap);
    }
    setIsReturningToGame(false);
    setIsLocked(false);
    setCanLock(true);
    setDevFastTravelIndex(0);
    devFastTravelOpenedAtRef.current = getHudMenuNowMs();
    setDevFastTravelOpen(true);
    dispatchHudGameplayModalOpened();

    exitPointerLockIfActive();
    return true;
  };

  const runDevFastTravel = (location: DevFastTravelLocation) => {
    void loadDevFastTravelModule().then(({ runDevFastTravelLocation }) => {
      runDevFastTravelLocation(location);
      addLobbyMessage(`FAST TRAVEL: ${location.label} (${location.chunk.cx},${location.chunk.cz})`, "system");
      closeDevFastTravelMenu(true);
    }).catch(() => {
      addLobbyMessage("Fast travel runtime unavailable.", "system");
      closeDevFastTravelMenu(true);
    });
  };

  const requestGamePointerLock = () => {
    if (!localPlayerName) {
      setCanLock(true);
      return false;
    }

    if (isPointerLockActive()) {
      setHudMouseGameplayActive(true);
      finishMouseGameplayResume();
      return true;
    }

    const requestId = pointerLockRequestIdRef.current + 1;
    pointerLockRequestIdRef.current = requestId;
    pauseMenuExplicitlyRequestedRef.current = false;
    pauseMenuRequestedRef.current = false;
    pointerLockResumeGraceUntilRef.current = getHudPointerLockResumeGraceUntil();

    const handlePointerLockGranted = () => {
      if (pointerLockRequestIdRef.current !== requestId) return;
      if (!isPointerLockActive()) return;
      finishMouseGameplayResume();
    };

    const handlePointerLockDenied = (reason?: unknown) => {
      if (pointerLockRequestIdRef.current !== requestId) return;
      if (isPermanentPointerLockRejection(reason) || !canRequestPointerLockHere()) {
        pointerLockUnavailableRef.current = true;
      }
      finishMouseGameplayResume("fallback");
      setCanLock(true);
    };

    if (pointerLockUnavailableRef.current || !canRequestPointerLockHere()) {
      pointerLockUnavailableRef.current = true;
      handlePointerLockDenied();
      return false;
    }

    const lockTarget = getHudPointerLockTarget();

    try {
      setCanLock(false);
      setIsLocked(false);
      setPauseOverlayOpen(false);
      setPauseMenuOpen(false);
      setIsReturningToGame(true);
      const requestPointerLock = getHudPointerLockRequester(lockTarget);
      if (!requestPointerLock) {
        pointerLockUnavailableRef.current = true;
        handlePointerLockDenied();
        return false;
      }
      const request = requestPointerLock.call(lockTarget);
      if (request && typeof request.catch === "function") {
        request.then(handlePointerLockGranted).catch(handlePointerLockDenied);
      } else {
        window.setTimeout(() => {
          if (isPointerLockActive()) {
            handlePointerLockGranted();
          } else {
            handlePointerLockDenied();
          }
        }, 500);
      }
      return true;
    } catch (error) {
      handlePointerLockDenied(error);
      return false;
    }
  };

  useEffect(() => {
    if (
      !isGameLaunched ||
      !localPlayerName ||
      !shouldUseRemoteMouseLookFallback() ||
      isCommandConsoleOpen ||
      isSpellMenuOpen ||
      questNpcEditorTarget ||
      questDialogSession ||
      isInventoryOpen ||
      isMapExpanded ||
      isScoreboardOpen ||
      (isPauseOverlayOpen && pauseMenuExplicitlyRequestedRef.current) ||
      pauseMenuExplicitlyRequestedRef.current ||
      showVideoMenu ||
      touchGameplayActive ||
      controllerGameplayActive
    ) {
      return;
    }

    if (isPointerLockActive() || isHudMouseLookFallbackActive()) {
      return;
    }

    finishMouseGameplayResume("fallback");
  }, [
    controllerGameplayActive,
    finishMouseGameplayResume,
    isCommandConsoleOpen,
    isGameLaunched,
    isInventoryOpen,
    isMapExpanded,
    isPauseOverlayOpen,
    isScoreboardOpen,
    isSpellMenuOpen,
    localPlayerName,
    questDialogSession,
    questNpcEditorTarget,
    showVideoMenu,
    touchGameplayActive,
  ]);

  useEffect(() => {
    if (!isGameLaunched || !localPlayerName) return;

    const handleCanvasPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      const target = event.target instanceof Element ? event.target : null;
      if (!target?.closest("#game-canvas")) return;
      if (
        shouldShowMenuOverlay ||
        isReturningToGame ||
        isCommandConsoleOpen ||
        isSpellMenuOpen ||
        questNpcEditorTarget ||
        questDialogSession ||
        isInventoryOpen ||
        isMapExpanded ||
        isScoreboardOpen ||
        showVideoMenu
      ) {
        return;
      }

      getHudPointerLockTarget()?.focus({ preventScroll: true });

      if (
        isPointerLockActive() ||
        isHudMouseLookFallbackActive() ||
        touchGameplayActive ||
        controllerGameplayActive
      ) {
        return;
      }

      if (shouldUseRemoteMouseLookFallback() || pointerLockUnavailableRef.current || !canRequestPointerLockHere()) {
        finishMouseGameplayResume("fallback");
        return;
      }

      requestGamePointerLock();
    };

    document.addEventListener("pointerdown", handleCanvasPointerDown, true);
    return () => document.removeEventListener("pointerdown", handleCanvasPointerDown, true);
  }, [
    controllerGameplayActive,
    finishMouseGameplayResume,
    isCommandConsoleOpen,
    isGameLaunched,
    isInventoryOpen,
    isMapExpanded,
    isReturningToGame,
    isScoreboardOpen,
    isSpellMenuOpen,
    localPlayerName,
    questDialogSession,
    questNpcEditorTarget,
    requestGamePointerLock,
    shouldShowMenuOverlay,
    showVideoMenu,
    touchGameplayActive,
  ]);

  const closeCommandConsole = (resumeGameplay = true) => {
    closeHudCommandConsole({
      resumeGameplay,
      shouldRelockRef: commandConsoleShouldRelockRef,
      setCommandConsoleOpen,
      setCommandConsoleValue,
      setIsReturningToGame,
      requestGamePointerLock,
    });
  };

  const openCommandConsole = () => {
    openHudCommandConsole({
      isGameLaunched,
      isCommandConsoleOpen,
      isSpellMenuOpen,
      isInventoryOpen,
      isTouchDevice,
      hasQuestNpcEditorTarget: Boolean(questNpcEditorTarget),
      hasQuestDialogSession: Boolean(questDialogSession),
      shouldRelockRef: commandConsoleShouldRelockRef,
      setKeyboardScoreboardOpen: (open) => setScoreboardSource("keyboard", open),
      setControllerScoreboardOpen: (open) => setScoreboardSource("controller", open),
      setControllerGameplayActive,
      setShowVideoMenu,
      setCommandConsoleValue,
      setCommandConsoleOpen,
      setIsLocked,
    });
  };

  useEffect(() => {
    if (
      !controllerGameplayActive ||
      isLocked ||
      isTouchDevice ||
      isSpellMenuOpen ||
      isInventoryOpen ||
      showVideoMenu ||
      isCommandConsoleOpen ||
      questDialogSession ||
      isReturningToGame
    ) {
      return;
    }

    const handleMouseResume = (event: MouseEvent) => {
      if (event.button !== 0 || isEditableTarget(event.target)) return;
      requestGamePointerLock();
    };

    window.addEventListener("mousedown", handleMouseResume, true);
    return () => window.removeEventListener("mousedown", handleMouseResume, true);
  }, [controllerGameplayActive, isCommandConsoleOpen, isInventoryOpen, isLocked, isReturningToGame, isSpellMenuOpen, isTouchDevice, questDialogSession, requestGamePointerLock, showVideoMenu]);

  const submitCommandConsole = () => {
    void loadHudCommandConsoleModule().then(({ submitHudCommandConsoleCommand }) => {
      submitHudCommandConsoleCommand({
        commandValue: commandConsoleValue,
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
      });
    }).catch(() => {
      addLobbyMessage("Command runtime unavailable.", "system");
      closeCommandConsole();
    });
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isCommandConsoleOpen || isEngineMenuOpen || questNpcEditorTarget || questDialogSession || isInventoryOpen || remappingAction || remappingVoiceKey || isEditableTarget(e.target)) return;
      if (e.key !== "/" && e.code !== "Slash") return;
      e.preventDefault();
      e.stopPropagation();
      openCommandConsole();
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [isCommandConsoleOpen, isEngineMenuOpen, isInventoryOpen, openCommandConsole, questDialogSession, questNpcEditorTarget, remappingAction, remappingVoiceKey]);

  useEffect(() => {
    const handlePlaceableResult = (event: { detail: { ok?: boolean; label?: string; reason?: string } | undefined }) => {
      const message = formatHudEnginePlaceableResultMessage(event.detail);
      if (message) addLobbyMessage(message, "system");
    };

    return subscribeEnginePlaceableEvent("wof-engine-placeable-result", handlePlaceableResult);
  }, [addLobbyMessage]);

  const launchMode = (mode: GameMode) => {
    if (mode === "solo-survival" || mode === "multiplayer-survival") {
      saveSurvivalProgress({ lastMode: mode });
    }
    pauseMenuExplicitlyRequestedRef.current = false;
    pauseMenuRequestedRef.current = false;
    setGameMode(mode);
    setGameLaunched(true);
    setStartMenuStage("resume");
    setPauseOverlayOpen(false);
    setPauseMenuIndex(0);

    if (controllerResumeRequestedRef.current) {
      startControllerGameplay();
      return;
    }

    if (isTouchDevice) {
      startTouchGameplay();
      return;
    }

    pointerLockResumeGraceUntilRef.current = getHudPointerLockResumeGraceUntil();
    setIsLocked(false);
    setPauseMenuOpen(false);
    setIsReturningToGame(true);
    requestGamePointerLock();
  };

  useEffect(() => {
    const survivalMode = isHudSurvivalGameMode(gameMode) ? gameMode : null;
    if (!shouldRunHudSurvivalAutosave({
      isGameLaunched,
      hasSurvivalSave: Boolean(survivalSave),
      survivalMode,
    }) || !survivalMode) {
      return undefined;
    }

    return installHudSurvivalAutosaveLoop({
      intervalMs: HUD_SURVIVAL_AUTOSAVE_INTERVAL_MS,
      setTimer: (callback, delayMs) => window.setTimeout(callback, delayMs),
      clearTimer: (timerId) => window.clearTimeout(timerId),
      save: () => {
        saveSurvivalProgress({ lastMode: survivalMode });
      },
    });
  }, [gameMode, isGameLaunched, saveSurvivalProgress, survivalSave]);

  const cycleLobbyMap = (direction: 1 | -1) => {
    setLobbyRules(getNextHudLobbyMapRules(lobbyRules, direction));
  };

  const cycleLobbyDifficulty = (direction: 1 | -1) => {
    setLobbyRules(getNextHudLobbyDifficultyRules(lobbyRules, direction));
  };

  const cycleSurvivalDifficulty = (direction: 1 | -1) => {
    setSurvivalRules(getNextHudSurvivalDifficultyRules(survivalRules, direction));
  };

  const cycleLobbyManaRate = (direction: 1 | -1) => {
    setLobbyRules(getNextHudLobbyManaRateRules(lobbyRules, direction));
  };

  const cycleSurvivalManaRate = (direction: 1 | -1) => {
    setSurvivalRules(getNextHudSurvivalManaRateRules(survivalRules, direction));
  };

  const adjustLobbyMaxPlayers = (direction: 1 | -1) => {
    setLobbyRules(getNextHudLobbyMaxPlayersRules(lobbyRules, direction));
  };

  const adjustSurvivalMaxPlayers = (direction: 1 | -1) => {
    setSurvivalRules(getNextHudSurvivalMaxPlayersRules(survivalRules, direction));
  };

  const closePauseMenu = (preferredInput: GameplayInputMode | "last" = "last") => {
    if (showVideoMenu) {
      setShowVideoMenu(false);
      setSettingsPane("video");
      setRemappingAction(null);
      setRemappingVoiceKey(false);
      setPauseMenuIndex(3);
      return;
    }

    const inputMode = preferredInput === "last" ? lastGameplayInputModeRef.current : preferredInput;

    if (controllerResumeRequestedRef.current || inputMode === "controller") {
      startControllerGameplay();
      return;
    }

    if (inputMode === "touch" || isTouchDevice) {
      if (startTouchGameplay()) {
        return;
      }
    }

    if (canLock) {
      pauseMenuExplicitlyRequestedRef.current = false;
      pauseMenuRequestedRef.current = false;
      pointerLockResumeGraceUntilRef.current = getHudPointerLockResumeGraceUntil();
      setIsLocked(false);
      setPauseOverlayOpen(false);
      setPauseMenuOpen(false);
      setIsReturningToGame(true);
      requestGamePointerLock();
    }
  };

  const closeSpellMenuAndResume = () => {
    const inputMode = controllerGameplayActive
      ? "controller"
      : touchGameplayActive
        ? "touch"
        : lastGameplayInputModeRef.current;

    setSpellMenuOpen(false);

    if (inputMode === "controller") {
      startControllerGameplay();
      return;
    }

    if (isTouchDevice || inputMode === "touch") {
      if (startTouchGameplay()) {
        return;
      }
    }

    if (pointerLockUnavailableRef.current) {
      setIsReturningToGame(false);
      setCanLock(true);
      return;
    }

    setIsReturningToGame(true);

    const requestedImmediately = requestGamePointerLock();

    if (!requestedImmediately) {
      requestAnimationFrame(requestGamePointerLock);
    }

    requestAnimationFrame(() => {
      if (!isPointerLockActive()) {
        requestGamePointerLock();
      }
      window.setTimeout(() => {
        if (!isPointerLockActive()) {
          setCanLock(true);
        }
      }, 900);
    });
  };

  const closeInventoryAndResume = () => {
    const inputMode = controllerGameplayActive
      ? "controller"
      : touchGameplayActive
        ? "touch"
        : lastGameplayInputModeRef.current;

    setInventoryOpen(false);

    if (inputMode === "controller") {
      startControllerGameplay();
      return;
    }

    if (isTouchDevice || inputMode === "touch") {
      if (startTouchGameplay()) {
        return;
      }
    }

    if (pointerLockUnavailableRef.current) {
      setIsReturningToGame(false);
      setCanLock(true);
      return;
    }

    setIsReturningToGame(true);
    const requestedImmediately = requestGamePointerLock();
    if (!requestedImmediately) {
      requestAnimationFrame(requestGamePointerLock);
    }
  };

  const openInventoryFromGame = () => {
    if (
      isMapExpanded ||
      showVideoMenu ||
      isPauseMenuVisible ||
      isSpellMenuOpen ||
      questDialogSession ||
      !(isLocked || isPointerLockActive() || touchGameplayActive || controllerGameplayActive)
    ) {
      return;
    }
    lastGameplayInputModeRef.current = controllerGameplayActive
      ? "controller"
      : touchGameplayActive
        ? "touch"
        : "mouse";
    setScoreboardSource("keyboard", false);
    setScoreboardSource("controller", false);
    setInventoryOpen(true);
    setHudMouseGameplayActive(false);
    dispatchHudGameplayModalOpened();
    exitPointerLockIfActive();
  };

  const openSpellMenuFromGame = () => {
    if (
      isMapExpanded ||
      showVideoMenu ||
      isPauseMenuVisible ||
      isInventoryOpen ||
      !(isLocked || isPointerLockActive() || touchGameplayActive || controllerGameplayActive)
    ) {
      return;
    }
    lastGameplayInputModeRef.current = controllerGameplayActive
      ? "controller"
      : touchGameplayActive
        ? "touch"
        : "mouse";
    setScoreboardSource("keyboard", false);
    setScoreboardSource("controller", false);
    setMenuBindingHand(qHeldRef.current ? "right" : activeHand);
    setSpellMenuOpen(true);
    setHudMouseGameplayActive(false);
    exitPointerLockIfActive();
  };

  const toggleMagicArmedFromGame = () => {
    if (
      isMapExpanded ||
      showVideoMenu ||
      isPauseMenuVisible ||
      isInventoryOpen ||
      isSpellMenuOpen ||
      questDialogSession ||
      !(isLocked || isPointerLockActive() || touchGameplayActive || controllerGameplayActive)
    ) {
      return false;
    }

    const nextArmed = !useGameStore.getState().isMagicArmed;
    setMagicArmed(nextArmed);
    if (!shouldHideGameplayViewObstructionsForQa) {
      addLobbyMessage(nextArmed ? "Magic readied." : "Magic stowed.", "system");
    }
    return true;
  };

  const requestVillagerInteractionFromGame = (source: "keyboard" | "controller" | "cast") => {
    if (
      isMapExpanded ||
      showVideoMenu ||
      isPauseMenuVisible ||
      isInventoryOpen ||
      isSpellMenuOpen ||
      questDialogSession ||
      questNpcEditorTarget ||
      !(isLocked || isPointerLockActive() || touchGameplayActive || controllerGameplayActive)
    ) {
      return false;
    }

    const detail = { source, handled: false };
    window.dispatchEvent(new CustomEvent("quest-villager-interact", { detail }));
    return detail.handled;
  };

  const runStartMenuAction = (action: HudStartMenuAction) => {
    switch (action.type) {
      case "set-stage":
        setStartMenuStage(action.stage);
        setPauseMenuIndex(action.pauseMenuIndex);
        return;
      case "launch":
        launchMode(action.mode);
        return;
      case "cycle-lobby-map":
        cycleLobbyMap(1);
        return;
      case "adjust-lobby-max-players":
        adjustLobbyMaxPlayers(1);
        return;
      case "cycle-lobby-difficulty":
        cycleLobbyDifficulty(1);
        return;
      case "cycle-lobby-mana-rate":
        cycleLobbyManaRate(1);
        return;
      case "toggle-lobby-friendly-fire":
        setLobbyRules({ friendlyFire: !lobbyRules.friendlyFire });
        return;
      case "adjust-survival-max-players":
        adjustSurvivalMaxPlayers(1);
        return;
      case "cycle-survival-difficulty":
        cycleSurvivalDifficulty(1);
        return;
      case "cycle-survival-mana-rate":
        cycleSurvivalManaRate(1);
        return;
      case "toggle-survival-friendly-fire":
        setSurvivalRules({ friendlyFire: !survivalRules.friendlyFire });
        return;
      case "join-invite":
        joinInviteCode();
        return;
    }
  };

  const runPauseMenuAction = (index = pauseMenuIndex) => {
    if (showVideoMenu) {
      const selectedSettingsPane = getSettingsPaneForTabIndex(index);
      if (selectedSettingsPane) {
        setSettingsPane(selectedSettingsPane);
        return;
      }

      if (settingsPane === "video" && index >= videoAspectStartIndex && index < videoBackIndex) {
        const ratio = aspectRatioOptions[index - videoAspectStartIndex];
        if (aspectRatio !== ratio) {
          setAspectRatio(ratio);
        }
        return;
      }

      if (settingsPane === "keybinds") {
        if (index === keybindSensitivityStartIndex) {
          setMouseSensitivity(getPlatformDefaultLookSensitivity());
          return;
        }

        if (index === keybindSensitivityStartIndex + 1) {
          setControllerLookSensitivity(DEFAULT_CONTROLLER_LOOK_SENSITIVITY);
          return;
        }

        if (index === keybindArrowLookIndex) {
          setKeyboardArrowLookEnabled(!keyboardArrowLookEnabled);
          return;
        }

        if (index >= keybindControlStartIndex && index < keybindBackIndex) {
          beginControllerRemap(controllerActionRows[index - keybindControlStartIndex].action);
          return;
        }
      }

      if (settingsPane === "voice") {
        if (index === voiceEnabledIndex) {
          setVoiceChatEnabled(!voiceChatEnabled);
          return;
        }

        if (index === voiceInputModeIndex) {
          toggleVoiceInputMode();
          return;
        }

        if (index === voicePushToTalkKeyIndex) {
          beginVoiceKeyRemap();
          return;
        }

        if (index === voiceOutputVolumeIndex) {
          setVoiceOutputVolume(DEFAULT_VOICE_OUTPUT_VOLUME);
          return;
        }

        if (index === voiceProximityRangeIndex) {
          setVoiceProximityRange(DEFAULT_VOICE_PROXIMITY_RANGE);
          return;
        }
      }

      if (settingsPane === "character") {
        const nextCharacterUpdate = getCharacterCustomizationStep(characterCustomization, index, 1);
        if (nextCharacterUpdate) {
          setCharacterCustomization(nextCharacterUpdate);
          return;
        }
      }

      setShowVideoMenu(false);
      setSettingsPane("video");
      setRemappingAction(null);
      setRemappingVoiceKey(false);
      setPauseMenuIndex(3);
      return;
    }

    const startMenuAction = resolveHudStartMenuAction(startMenuStage, index);
    if (startMenuAction) {
      runStartMenuAction(startMenuAction);
      return;
    }

    if (index === 0) {
      closePauseMenu(controllerResumeRequestedRef.current ? "controller" : "last");
      return;
    }

    if (!isMultiplayerMode) {
      setShowVideoMenu(true);
      setSettingsPane("video");
      setPauseMenuIndex(0);
      return;
    }

    if (index === 1) {
      joinInviteCode();
      return;
    }

    if (index === 2) {
      copyInvite();
      return;
    }

    setShowVideoMenu(true);
    setSettingsPane("video");
    setPauseMenuIndex(0);
  };

  const movePauseMenuFocus = (direction: MenuDirection) => {
    const count = showVideoMenu ? settingsActionCount : mainMenuActionCount;
    const selector = showVideoMenu ? "[data-settings-index]" : "[data-menu-index]";
    const attribute = showVideoMenu ? "data-settings-index" : "data-menu-index";
    setPauseMenuIndex((prev) => {
      const nextIndex = findDirectionalMenuIndex(selector, attribute, prev, direction, count);
      const nextPane = showVideoMenu ? getSettingsPaneForTabIndex(nextIndex) : null;
      if (nextPane) {
        setSettingsPane(nextPane);
      }
      return nextIndex;
    });
  };

  useEffect(() => {
    const count = showVideoMenu ? settingsActionCount : mainMenuActionCount;
    setPauseMenuIndex(prev => clampMenuIndex(prev, count));
  }, [mainMenuActionCount, settingsActionCount, showVideoMenu]);

  useEffect(() => {
    if (!showVideoMenu) return;
    const panel = settingsScrollRef.current;
    const focusedItem =
      panel?.querySelector<HTMLElement>(`[data-settings-index="${pauseMenuIndex}"]`) ??
      document.querySelector<HTMLElement>(`[data-settings-index="${pauseMenuIndex}"]`);
    focusedItem?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [pauseMenuIndex, settingsPane, showVideoMenu]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isCommandConsoleOpen || questNpcEditorTarget || questDialogSession || isInventoryOpen || isEditableTarget(e.target)) return;
      if (remappingVoiceKey) {
        e.preventDefault();
        if (e.code === "Escape") {
          setRemappingVoiceKey(false);
          return;
        }

        setVoicePushToTalkKey(e.code || DEFAULT_VOICE_PUSH_TO_TALK_KEY);
        setRemappingVoiceKey(false);
        return;
      }

      if (isEngineMenuOpen) {
        if (e.code === "Escape" || e.code === "KeyL") {
          e.preventDefault();
          closeEngineMenu(true);
        }
        return;
      }

      if (isDevFastTravelOpen) {
        if (e.code === "Escape" || e.code === "F8") {
          e.preventDefault();
          closeDevFastTravelMenu(true);
          return;
        }

        if (e.code === "ArrowDown" || e.code === "ArrowRight") {
          e.preventDefault();
          if (devFastTravelLocationCount <= 0) return;
          setDevFastTravelIndex(prev => wrapIndex(prev + 1, devFastTravelLocationCount));
          return;
        }

        if (e.code === "ArrowUp" || e.code === "ArrowLeft") {
          e.preventDefault();
          if (devFastTravelLocationCount <= 0) return;
          setDevFastTravelIndex(prev => wrapIndex(prev - 1, devFastTravelLocationCount));
          return;
        }

        if (e.code === "Enter" || e.code === "Space") {
          e.preventDefault();
          const location = devFastTravelLocations[devFastTravelIndex];
          if (location) runDevFastTravel(location);
          return;
        }

        return;
      }

      if (e.code === "KeyL" && !e.repeat && isEngineMenuAllowed) {
        e.preventDefault();
        const inputMode: GameplayInputMode = controllerGameplayActive
          ? "controller"
          : touchGameplayActive
            ? "touch"
            : "mouse";
        openEngineMenu(inputMode);
        return;
      }

      if (e.code === "F8" && !e.repeat && isDevFastTravelAllowed) {
        e.preventDefault();
        const inputMode: GameplayInputMode = controllerGameplayActive
          ? "controller"
          : touchGameplayActive
            ? "touch"
            : "mouse";
        openDevFastTravelMenu(inputMode);
        return;
      }

      if (e.code === "Tab") {
        e.preventDefault();
        setScoreboardSource("keyboard", true);
        return;
      }

      if (!isPauseMenuVisible) return;

      if (e.code === "Escape") {
        e.preventDefault();
        closePauseMenu();
        return;
      }

      if (e.code === "ArrowDown" || e.code === "ArrowRight") {
        e.preventDefault();
        movePauseMenuFocus(e.code === "ArrowDown" ? "down" : "right");
        return;
      }

      if (e.code === "ArrowUp" || e.code === "ArrowLeft") {
        e.preventDefault();
        movePauseMenuFocus(e.code === "ArrowUp" ? "up" : "left");
        return;
      }

      if (e.code === "Space") {
        e.preventDefault();
        return;
      }

      if (e.code === "Enter") {
        e.preventDefault();
        runPauseMenuAction();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (isCommandConsoleOpen || questNpcEditorTarget || questDialogSession || isInventoryOpen || isEditableTarget(e.target)) return;
      if (e.code !== "Tab") return;
      e.preventDefault();
      setScoreboardSource("keyboard", false);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [closeDevFastTravelMenu, closeEngineMenu, closePauseMenu, controllerGameplayActive, devFastTravelIndex, devFastTravelLocationCount, devFastTravelLocations, isCommandConsoleOpen, isDevFastTravelAllowed, isDevFastTravelOpen, isEngineMenuAllowed, isEngineMenuOpen, isInventoryOpen, isPauseMenuVisible, movePauseMenuFocus, openDevFastTravelMenu, openEngineMenu, questDialogSession, questNpcEditorTarget, remappingVoiceKey, runDevFastTravel, runPauseMenuAction, setScoreboardSource, setVoicePushToTalkKey, touchGameplayActive]);

  useEffect(() => {
    const clearKeyboardMagicHold = () => {
      clearHudKeyboardMagicHoldState({
        keyboardMagicHoldStartedAtRef,
        keyboardMagicHoldTimeoutRef,
        keyboardMagicHoldConsumedRef,
        clearTimer: (timerId) => window.clearTimeout(timerId),
      });
    };

    if (!isGameLaunched) {
      clearKeyboardMagicHold();
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isCommandConsoleOpen || questNpcEditorTarget || questDialogSession || isEditableTarget(e.target)) return;
      const slotIndex = getNumberSlotFromCode(e.code);
      const hand: HandType = isSpellMenuOpen
        ? (qHeldRef.current ? "right" : menuBindingHand)
        : (qHeldRef.current ? "right" : "left");

      if (e.code === "KeyI" && !e.repeat) {
        e.preventDefault();
        if (isInventoryOpen) {
          closeInventoryAndResume();
        } else {
          openInventoryFromGame();
        }
        return;
      }

      if (isInventoryOpen) return;

      if (e.code === "KeyF" && !e.repeat) {
        e.preventDefault();
        requestVillagerInteractionFromGame("keyboard");
        return;
      }

      if (e.code === "KeyE") {
        e.preventDefault();
        if (isSpellMenuOpen) {
          if (!e.repeat) {
            closeSpellMenuAndResume();
          }
          return;
        }

        const started = startHudKeyboardMagicHold({
          keyboardMagicHoldStartedAtRef,
          keyboardMagicHoldTimeoutRef,
          keyboardMagicHoldConsumedRef,
          eventTimeStamp: e.timeStamp,
          repeat: e.repeat,
          onHold: toggleMagicArmedFromGame,
          setTimer: (callback, delayMs) => window.setTimeout(callback, delayMs),
          clearTimer: (timerId) => window.clearTimeout(timerId),
        });
        if (!started) {
          return;
        }

        return;
      }

      if (isSpellMenuOpen) {
        if (e.code === "Escape") {
          e.preventDefault();
          closeSpellMenuAndResume();
          return;
        }

        if (slotIndex !== -1) {
          e.preventDefault();
          const spell = ALL_SPELLS[menuSpellIndex];
          setHotbarSpell(slotIndex, spell, hand);
          selectHotbarSlot(slotIndex, hand);
          return;
        }

        if (e.code === "Enter") {
          e.preventDefault();
          dispatchSpellMenuControllerSelect();
          return;
        }

        if (e.code === "ArrowRight") {
          e.preventDefault();
          dispatchSpellMenuControllerNavigate("right");
          return;
        }

        if (e.code === "ArrowLeft") {
          e.preventDefault();
          dispatchSpellMenuControllerNavigate("left");
          return;
        }

        if (e.code === "ArrowDown") {
          e.preventDefault();
          dispatchSpellMenuControllerNavigate("down");
          return;
        }

        if (e.code === "ArrowUp") {
          e.preventDefault();
          dispatchSpellMenuControllerNavigate("up");
        }
        return;
      }

      if (slotIndex !== -1 && slotIndex < HOTBAR_SIZE && (isLocked || isPointerLockActive() || touchGameplayActive || controllerGameplayActive)) {
        e.preventDefault();
        selectHotbarSlot(slotIndex, hand);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code !== "KeyE") return;
      const release = resolveHudKeyboardMagicHoldRelease({
        holdStartedAt: keyboardMagicHoldStartedAtRef.current,
        consumed: keyboardMagicHoldConsumedRef.current,
        eventTimeStamp: e.timeStamp,
      });
      if (!release.handled) return;

      e.preventDefault();
      clearKeyboardMagicHold();

      if (release.openSpellMenu) {
        openSpellMenuFromGame();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [
    isGameLaunched,
    isLocked,
    isCommandConsoleOpen,
    controllerGameplayActive,
    closeInventoryAndResume,
    isSpellMenuOpen,
    isInventoryOpen,
    questDialogSession,
    questNpcEditorTarget,
    touchGameplayActive,
    leftSelectedHotbarIndex,
    menuBindingHand,
    menuSpellIndex,
    openInventoryFromGame,
    openSpellMenuFromGame,
    rightSelectedHotbarIndex,
    requestVillagerInteractionFromGame,
    selectHotbarSlot,
    setHotbarSpell,
    toggleMagicArmedFromGame,
  ]);

  useEffect(() => () => {
    clearHudKeyboardMagicHoldState({
      keyboardMagicHoldStartedAtRef,
      keyboardMagicHoldTimeoutRef,
      keyboardMagicHoldConsumedRef,
      clearTimer: (timerId) => window.clearTimeout(timerId),
    });
  }, []);

  useEffect(() => {
    const consumePress = (key: string, pressed: boolean) => {
      return consumeHudControllerPress(controllerButtonsRef, key, pressed);
    };

    const consumeRepeat = (key: string, pressed: boolean, now: number, firstDelay = 260, repeatDelay = 170) => {
      return consumeHudControllerRepeat(controllerButtonsRef, controllerRepeatRef, key, pressed, now, firstDelay, repeatDelay);
    };

    let controllerPollScheduler: ReturnType<typeof createControllerPollScheduler>;
    const pollController = (now: number) => {
      if (questNpcEditorTarget || questDialogSession) {
        resetHudControllerTransientState({
          controllerButtonsRef,
          controllerRepeatRef,
          controllerInventoryHoldStartedAtRef,
          controllerInventoryTapEligibleRef,
          controllerInventoryIgnoreUntilReleaseRef,
          controllerMagicHoldStartedAtRef,
          controllerMagicHoldConsumedRef,
        });
        setScoreboardSource("controller", false);
        controllerPollScheduler.schedule(GAMEPAD_NO_DEVICE_POLL_INTERVAL_MS);
        return;
      }

      const gamepad = getPrimaryGamepad();

      if (!gamepad) {
        if (controllerGameplayActive) {
          if (controllerLastSeenAtRef.current === 0) {
            controllerLastSeenAtRef.current = now;
          } else if (now - controllerLastSeenAtRef.current > 1200) {
            pauseControllerGameplay();
            controllerLastSeenAtRef.current = 0;
          }
        } else {
          controllerLastSeenAtRef.current = 0;
        }
        resetHudControllerTransientState({
          controllerButtonsRef,
          controllerRepeatRef,
          controllerInventoryHoldStartedAtRef,
          controllerInventoryTapEligibleRef,
          controllerInventoryIgnoreUntilReleaseRef,
          controllerMagicHoldStartedAtRef,
          controllerMagicHoldConsumedRef,
        });
        setScoreboardSource("controller", false);
        controllerPollScheduler.schedule(GAMEPAD_NO_DEVICE_POLL_INTERVAL_MS);
        return;
      }
      controllerLastSeenAtRef.current = now;

      if (isGameLaunched && localPlayerName && hasGamepadInput(gamepad, 0.26)) {
        const inputState = useGameStore.getState();
        if (
          inputState.isTouchControlsActive ||
          !inputState.isControllerGameplayActive ||
          lastGameplayInputModeRef.current !== "controller"
        ) {
          setHudMouseGameplayActive(false);
          setMouseLookFallbackActive(false);
          if (inputState.isTouchControlsActive) {
            setTouchControlsActive(false);
            releaseMobileGameplayInputs();
          }
          lastGameplayInputModeRef.current = "controller";
          if (!inputState.isControllerGameplayActive) {
            setControllerGameplayActive(true);
            window.dispatchEvent(new Event("controller-gameplay-started"));
          }
        }
      }

      if (remappingAction) {
        if (now >= remapReadyAtRef.current) {
          const backPressedForRemap = isGamepadButtonPressed(gamepad, controllerBindings.menuBack as GamepadButtonName);
          if (backPressedForRemap) {
            setRemappingAction(null);
            controllerPollScheduler.schedule(0);
            return;
          }

          let capturedButton: GamepadButtonName | null = null;
          for (let index = 0; index < controllerButtonOptions.length; index += 1) {
            const button = controllerButtonOptions[index];
            if (!isGamepadButtonPressed(gamepad, button as GamepadButtonName)) continue;
            capturedButton = button;
            break;
          }
          if (capturedButton) {
            setControllerBinding(remappingAction, capturedButton);
            setRemappingAction(null);
          }
        }
        controllerPollScheduler.schedule(0);
        return;
      }

      const {
        leftBumperHeld,
        rightBumperHeld,
        hotbarModifierHeld,
        leftBumperPressed,
        rightBumperPressed,
        aPressed,
        bPressed,
        inventoryHeld,
        spellMenuPressed,
        interactHeld,
        yPressed,
        backHeld,
        startPressed,
        dpadLeft,
        dpadRight,
        dpadUp,
        dpadDown,
        movementAxisX,
        movementAxisY,
        menuAxisX,
        menuAxisY,
        scrollAxisY,
      } = readHudControllerInputSnapshotInto(gamepad, controllerBindings, consumePress, controllerInputSnapshot);

      if (isInventoryOpen) {
        resetHudControllerMagicHoldState({
          controllerMagicHoldStartedAtRef,
          controllerMagicHoldConsumedRef,
        });
        setScoreboardSource("controller", false);
        const inventoryNextPressed = consumeRepeat(
          "controllerInventoryNext",
          dpadDown || menuAxisY > 0.6,
          now,
        );
        const inventoryPrevPressed = consumeRepeat(
          "controllerInventoryPrev",
          dpadUp || menuAxisY < -0.6,
          now,
        );
        if (inventoryNextPressed || inventoryPrevPressed) {
          dispatchInventoryControllerMove(inventoryNextPressed ? 1 : -1);
        }
        if (aPressed) {
          dispatchInventoryControllerSelect();
        }
        if (bPressed || startPressed) {
          if (!dispatchInventoryControllerBack()) {
            if (inventoryHeld) {
              controllerInventoryIgnoreUntilReleaseRef.current = true;
              controllerInventoryHoldStartedAtRef.current = null;
              controllerInventoryTapEligibleRef.current = false;
            }
            closeInventoryAndResume();
          }
        }
        controllerPollScheduler.schedule(0);
        return;
      }

      const pauseMenuOpen = isPauseMenuVisible;
      const pointerLockActive = isPointerLockActive();
      const gameplayInputActive = hasHudControllerGameplaySignal({
        isLocked,
        pointerLockActive,
        touchGameplayActive,
        controllerGameplayActive,
      });
      const inventoryInputActive = hasHudControllerGameplaySignal({
        isLocked,
        pointerLockActive,
        controllerGameplayActive,
      });

      if (isDevFastTravelOpen) {
        setScoreboardSource("controller", false);
        const canNavigateFastTravel = now - devFastTravelOpenedAtRef.current > 220;
        const fastTravelNextPressed = canNavigateFastTravel && consumeRepeat("controllerDevFastTravelNext", dpadDown || menuAxisY > 0.6, now);
        const fastTravelPrevPressed = canNavigateFastTravel && consumeRepeat("controllerDevFastTravelPrev", dpadUp || menuAxisY < -0.6, now);

        if (fastTravelNextPressed || fastTravelPrevPressed) {
          if (devFastTravelLocationCount <= 0) {
            controllerPollScheduler.schedule(0);
            return;
          }
          setDevFastTravelIndex(prev => wrapIndex(prev + (fastTravelNextPressed ? 1 : -1), devFastTravelLocationCount));
        }

        if (bPressed || startPressed) {
          closeDevFastTravelMenu(true);
          controllerPollScheduler.schedule(0);
          return;
        }

        if (aPressed) {
          const location = devFastTravelLocations[devFastTravelIndex];
          if (location) runDevFastTravel(location);
          controllerPollScheduler.schedule(0);
          return;
        }

        controllerPollScheduler.schedule(0);
        return;
      }

      setScoreboardSource("controller", !isSpellMenuOpen && backHeld);
      if (pauseMenuOpen && showVideoMenu && Math.abs(scrollAxisY) > 0.05) {
        scrollSettingsPanel(scrollAxisY * 18);
      }
      if (isSpellMenuOpen && Math.abs(scrollAxisY) > 0.05) {
        dispatchSpellMenuControllerScroll(scrollAxisY * 18);
      }

      const spellMenuRightPressed = consumeRepeat("controllerSpellMenuRight", isSpellMenuOpen && (dpadRight || menuAxisX > 0.6), now);
      const spellMenuLeftPressed = consumeRepeat("controllerSpellMenuLeft", isSpellMenuOpen && (dpadLeft || menuAxisX < -0.6), now);
      const spellMenuDownPressed = consumeRepeat("controllerSpellMenuDown", isSpellMenuOpen && (dpadDown || menuAxisY > 0.6), now);
      const spellMenuUpPressed = consumeRepeat("controllerSpellMenuUp", isSpellMenuOpen && (dpadUp || menuAxisY < -0.6), now);
      const pauseNextPressed = consumeRepeat("controllerPauseNext", pauseMenuOpen && (dpadDown || menuAxisY > 0.6), now);
      const pausePrevPressed = consumeRepeat("controllerPausePrev", pauseMenuOpen && (dpadUp || menuAxisY < -0.6), now);
      const pauseRightPressed = consumeRepeat("controllerPauseRight", pauseMenuOpen && (dpadRight || menuAxisX > 0.6), now);
      const pauseLeftPressed = consumeRepeat("controllerPauseLeft", pauseMenuOpen && (dpadLeft || menuAxisX < -0.6), now);
      if (isSpellMenuOpen) {
        if (rightBumperHeld || rightBumperPressed) {
          setMenuBindingHand("right");
        } else if (leftBumperHeld || leftBumperPressed) {
          setMenuBindingHand("left");
        }

        if (bPressed || startPressed) {
          closeSpellMenuAndResume();
          controllerPollScheduler.schedule(0);
          return;
        }

        if (spellMenuUpPressed) {
          dispatchSpellMenuControllerNavigate("up");
        } else if (spellMenuDownPressed) {
          dispatchSpellMenuControllerNavigate("down");
        } else if (spellMenuLeftPressed) {
          dispatchSpellMenuControllerNavigate("left");
        } else if (spellMenuRightPressed) {
          dispatchSpellMenuControllerNavigate("right");
        }

        if (aPressed) {
          dispatchSpellMenuControllerSelect();
        }

        controllerPollScheduler.schedule(0);
        return;
      }

      if (pauseMenuOpen) {
        const pauseVerticalMoved = pauseNextPressed || pausePrevPressed;
        if (pauseNextPressed) {
          movePauseMenuFocus("down");
        } else if (pausePrevPressed) {
          movePauseMenuFocus("up");
        }

        if (!pauseVerticalMoved && pauseRightPressed) {
          if (!adjustFocusedSetting(1)) {
            if (showVideoMenu && pauseMenuIndex < settingsTabCount) {
              const nextTabIndex = wrapIndex(pauseMenuIndex + 1, settingsTabCount);
              const nextPane = getSettingsPaneForTabIndex(nextTabIndex);
              if (nextPane) setSettingsPane(nextPane);
              setPauseMenuIndex(nextTabIndex);
            } else {
              movePauseMenuFocus("right");
            }
          }
        } else if (!pauseVerticalMoved && pauseLeftPressed) {
          if (!adjustFocusedSetting(-1)) {
            if (showVideoMenu && pauseMenuIndex < settingsTabCount) {
              const nextTabIndex = wrapIndex(pauseMenuIndex - 1, settingsTabCount);
              const nextPane = getSettingsPaneForTabIndex(nextTabIndex);
              if (nextPane) setSettingsPane(nextPane);
              setPauseMenuIndex(nextTabIndex);
            } else {
              movePauseMenuFocus("left");
            }
          }
        }

        if (bPressed) {
          controllerResumeRequestedRef.current = true;
          closePauseMenu("controller");
          controllerResumeRequestedRef.current = false;
          controllerPollScheduler.schedule(0);
          return;
        }

        if (aPressed) {
          controllerResumeRequestedRef.current = true;
          runPauseMenuAction();
          controllerResumeRequestedRef.current = false;
          controllerPollScheduler.schedule(0);
          return;
        }

        if (startPressed) {
          startControllerGameplay();
          controllerPollScheduler.schedule(0);
          return;
        }

        controllerPollScheduler.schedule(0);
        return;
      }

      const canOpenDevFastTravelMenu = canOpenControllerDevFastTravelMenu({
        isDevFastTravelAllowed,
        isGameLaunched,
        startMenuStage,
        showVideoMenu,
        isMapExpanded,
        isScoreboardOpen,
        isSpellMenuOpen,
        isInventoryOpen,
        isCommandConsoleOpen,
        hotbarModifierHeld,
        gameplayInputActive,
      });
      const fastTravelOpenPressed = consumePress("controllerDevFastTravelOpen", dpadDown && !hotbarModifierHeld);
      if (fastTravelOpenPressed && canOpenDevFastTravelMenu) {
        openDevFastTravelMenu("controller");
        controllerPollScheduler.schedule(0);
        return;
      }

      if (startPressed) {
        const controllerCanPauseActiveGameplay = hasHudControllerGameplaySignal({
          isLocked,
          pointerLockActive,
          touchGameplayActive,
          controllerGameplayActive,
          mouseLookFallbackActive: isHudMouseLookFallbackActive(),
        });

        if (touchGameplayActive) {
          pauseGameplayFromController();
        } else if (controllerCanPauseActiveGameplay) {
          pauseGameplayFromController();
        } else {
          startControllerGameplay();
        }
        controllerPollScheduler.schedule(0);
        return;
      }

      if ((aPressed || startPressed) && !isLocked && !controllerGameplayActive && !isReturningToGame) {
        startControllerGameplay();
      }

      const isStandingStillForInventory = isStandingStillForControllerInventory({
        controllerGameplayActive,
        playerMoving: playerState.isMoving,
        playerSprinting: playerState.isSprinting,
        playerSliding: playerState.isSliding,
        playerCrouching: playerState.isCrouching,
        movementAxisX,
        movementAxisY,
      });
      const canUseControllerInventoryShortcut = canUseControllerInventory({
        inventoryInputActive,
        isMapExpanded,
        isScoreboardOpen,
        isSpellMenuOpen,
        hotbarModifierHeld,
      });

      if (controllerInventoryIgnoreUntilReleaseRef.current) {
        controllerInventoryHoldStartedAtRef.current = null;
        controllerInventoryTapEligibleRef.current = false;
        if (!inventoryHeld) {
          controllerInventoryIgnoreUntilReleaseRef.current = false;
        }
      } else if (inventoryHeld) {
        if (isStandingStillForInventory && canUseControllerInventoryShortcut) {
          if (controllerInventoryHoldStartedAtRef.current === null) {
            controllerInventoryHoldStartedAtRef.current = now;
            controllerInventoryTapEligibleRef.current = true;
          } else if (now - controllerInventoryHoldStartedAtRef.current >= CONTROLLER_INVENTORY_HOLD_MS) {
            controllerInventoryTapEligibleRef.current = false;
          }
        } else {
          controllerInventoryTapEligibleRef.current = false;
        }
      } else if (controllerInventoryHoldStartedAtRef.current !== null) {
        const holdDuration = now - controllerInventoryHoldStartedAtRef.current;
        const shouldOpenInventory =
          controllerInventoryTapEligibleRef.current &&
          holdDuration < CONTROLLER_INVENTORY_HOLD_MS &&
          isStandingStillForInventory &&
          canUseControllerInventoryShortcut;
        resetHudControllerInventoryHoldState({
          controllerInventoryHoldStartedAtRef,
          controllerInventoryTapEligibleRef,
          controllerInventoryIgnoreUntilReleaseRef,
        });

        if (shouldOpenInventory) {
          openInventoryFromGame();
          controllerPollScheduler.schedule(0);
          return;
        }
      }

      const canUseControllerMagic = canUseControllerMagicShortcut({
        gameplayInputActive,
        isMapExpanded,
        isScoreboardOpen,
      });
      const canUseControllerMap = canUseControllerMapShortcut({
        gameplayInputActive,
        isMapExpanded,
        isScoreboardOpen,
        isSpellMenuOpen,
        isInventoryOpen,
        hotbarModifierHeld,
      });

      if (interactHeld) {
        if (canUseControllerMagic) {
          if (controllerMagicHoldStartedAtRef.current === null) {
            controllerMagicHoldStartedAtRef.current = now;
            controllerMagicHoldConsumedRef.current = false;
          } else if (!controllerMagicHoldConsumedRef.current && now - controllerMagicHoldStartedAtRef.current >= MAGIC_UNARM_HOLD_MS) {
            controllerMagicHoldConsumedRef.current = toggleMagicArmedFromGame();
          }
        } else {
          resetHudControllerMagicHoldState({
            controllerMagicHoldStartedAtRef,
            controllerMagicHoldConsumedRef,
          });
        }
      } else if (controllerMagicHoldStartedAtRef.current !== null) {
        const holdDuration = now - controllerMagicHoldStartedAtRef.current;
        const shouldInteract =
          !controllerMagicHoldConsumedRef.current &&
          holdDuration < MAGIC_UNARM_HOLD_MS &&
          canUseControllerMagic;
        resetHudControllerMagicHoldState({
          controllerMagicHoldStartedAtRef,
          controllerMagicHoldConsumedRef,
        });

        if (shouldInteract) {
          requestVillagerInteractionFromGame("controller");
        }
      }

      if (spellMenuPressed && canUseControllerMagic) {
        openSpellMenuFromGame();
      }

      if (yPressed && canUseControllerMap) {
        requestMapToggle(now);
      }

      controllerPollScheduler.schedule(0);
    };

    controllerPollScheduler = createControllerPollScheduler(pollController);
    controllerPollScheduler.schedule(0);
    return () => controllerPollScheduler.cancel();
  }, [
    activeBindingHand,
    adjustFocusedSetting,
    canLock,
    closeDevFastTravelMenu,
    closePauseMenu,
    closeSpellMenuAndResume,
    controllerInputSnapshot,
    controllerGameplayActive,
    controllerBindings,
    devFastTravelIndex,
    devFastTravelLocationCount,
    devFastTravelLocations,
    isLocked,
    isCommandConsoleOpen,
    isDevFastTravelAllowed,
    isDevFastTravelOpen,
    isGameLaunched,
    isInventoryOpen,
    isMapExpanded,
    isPauseMenuVisible,
    questDialogSession,
    questNpcEditorTarget,
    isReturningToGame,
    isScoreboardOpen,
    isSpellMenuOpen,
    isTouchDevice,
    leftSelectedHotbarIndex,
    localPlayerName,
    menuSpellIndex,
    movePauseMenuFocus,
    openSpellMenuFromGame,
    openInventoryFromGame,
    openDevFastTravelMenu,
    pauseControllerGameplay,
    pauseGameplayFromController,
    playerState.isCrouching,
    playerState.isMoving,
    playerState.isSliding,
    playerState.isSprinting,
    requestGamePointerLock,
    remappingAction,
    requestVillagerInteractionFromGame,
    rightSelectedHotbarIndex,
    runDevFastTravel,
    runPauseMenuAction,
    scrollSettingsPanel,
    selectHotbarSlot,
    startControllerGameplay,
    setActiveHand,
    setControllerBinding,
    setControllerGameplayActive,
    setHotbarSpell,
    setScoreboardSource,
    setTouchControlsActive,
    showVideoMenu,
    startMenuStage,
    touchGameplayActive,
    toggleMap,
    toggleMagicArmedFromGame,
  ]);

  useEffect(() => {
    if (!isSpellMenuOpen) return undefined;

    const handleWheel = (e: WheelEvent) => {
      setMenuSpellIndex(prev => (prev + (e.deltaY > 0 ? 1 : -1) + ALL_SPELLS.length) % ALL_SPELLS.length);
    };

    window.addEventListener("wheel", handleWheel, { passive: false });
    return () => window.removeEventListener("wheel", handleWheel);
  }, [isSpellMenuOpen]);

  const survivalPlayerEstimate = gameMode === "multiplayer-survival"
    ? Math.max(1, countOwnRecordEntries(players) + 1)
    : 1;
  const survivalDifficulty = getSurvivalDifficultyMultiplier(survivalPlayerEstimate, survivalRules.enemyDifficulty);

  const requestResumeFromOverlay = (target: EventTarget | null) => {
    if (questDialogSession || isInventoryOpen) return;
    if (showVideoMenu || startMenuStage !== "resume" || !canLock) return;
    if (isEditableTarget(target)) return;
    const element = target instanceof HTMLElement ? target : null;
    if (element?.closest("button,form,input,select,textarea,[data-no-resume-click]")) return;

    if (isTouchDevice) {
      startTouchGameplay();
      return;
    }

    closePauseMenu("mouse");
  };

  const shouldShowMagicHands = shouldRenderGameplayHud
    && !shouldHideGameplayViewObstructionsForQa
    && !isSpellMenuOpen
    && !isInventoryOpen
    && !isMapExpanded
    && !isScoreboardOpen
    && !isEngineMenuOpen
    && !isDevFastTravelOpen
    && !questNpcEditorTarget
    && !questDialogSession;
  const shouldExpectMagicHands = shouldShowMagicHands && isMagicArmed && !playerState.isMeditating;
  const shouldShowTouchControls = touchGameplayActive && !shouldHideGameplayHudForQa && !isSpellMenuOpen && !isInventoryOpen && !isMapExpanded && !isScoreboardOpen && !isEngineMenuOpen && !questNpcEditorTarget && !questDialogSession;
  const shouldShowGameplayOverlay = shouldRenderGameplayHud && !shouldHideGameplayHudForQa && !isSpellMenuOpen && !isInventoryOpen && !isMapExpanded && !isScoreboardOpen && !isEngineMenuOpen && !questNpcEditorTarget && !questDialogSession;
  const shouldSuppressMapForHudToolOverlay = isEngineMenuOpen || isDevFastTravelOpen || Boolean(questNpcEditorTarget) || Boolean(questDialogSession);

  useEffect(() => {
    setHudMapSuppressedByToolOverlay(shouldSuppressMapForHudToolOverlay);
    return () => setHudMapSuppressedByToolOverlay(false);
  }, [shouldSuppressMapForHudToolOverlay]);

  const hudLayoutQaOptions = {
    gameplayHudVisible: shouldShowGameplayOverlay,
    magicHandsVisible: shouldExpectMagicHands,
    touchControlsVisible: shouldShowTouchControls,
    compactMapVisible: isGameLaunched && !isMapExpanded && !isSpellMenuOpen && !isPauseMenuVisible && !isScoreboardOpen && !isEngineMenuOpen && !isDevFastTravelOpen && !isInventoryOpen && !questNpcEditorTarget && !questDialogSession,
    expandedMapVisible: isGameLaunched && isMapExpanded && !isSpellMenuOpen && !isPauseMenuVisible && !isScoreboardOpen && !isEngineMenuOpen && !isDevFastTravelOpen && !isInventoryOpen && !questNpcEditorTarget && !questDialogSession,
    spellMenuVisible: isSpellMenuOpen,
    settingsPanelVisible: showVideoMenu && shouldShowMenuOverlay,
    engineMenuVisible: isEngineMenuOpen && isEngineMenuAllowed,
    inventoryVisible: isInventoryOpen && !isSpellMenuOpen,
    questNpcEditorVisible: Boolean(questNpcEditorTarget),
    questDialogVisible: Boolean(questDialogSession),
    scoreboardVisible: isScoreboardOpen && !isSpellMenuOpen && !isInventoryOpen,
  };

  return (
    <div data-wof-hud-qa="hud-root" className="pointer-events-none absolute inset-0 text-white font-mono uppercase" style={hudRootStyle}>
      {shouldMountHudStateQaRuntimeProbe && (
        <Suspense fallback={null}>
          <LazyHudStateQaRuntimeProbe options={hudStateQaOptions} />
        </Suspense>
      )}

      {shouldMountHudLayoutQaMetricsProbe && (
        <Suspense fallback={null}>
          <LazyHudLayoutQaMetricsProbe options={hudLayoutQaOptions} />
        </Suspense>
      )}

      {/* Flashbang Overlay */}
      {flashbangOpacity > 0 && (
        <div 
          className="absolute inset-0 bg-white pointer-events-none z-[200]" 
          style={{ opacity: flashbangOpacity, transition: 'opacity 0.1s linear' }}
        />
      )}

      {!shouldHideGameplayViewObstructionsForQa && lobbyMessages.length > 0 && (
        <Suspense fallback={null}>
          <LazyLobbyChatBox messages={lobbyMessages} />
        </Suspense>
      )}

      {isQuestDevModeEnabled && !questNpcEditorTarget && !questDialogSession && !isInventoryOpen && (
        <div className="pointer-events-none absolute left-3 top-3 z-[92] border border-yellow-200/55 bg-black/65 px-2 py-1 text-[9px] tracking-[0.22em] text-yellow-100 shadow-[0_0_14px_rgba(250,204,21,0.25)]">
          QUEST DEV
        </div>
      )}

      {isCommandConsoleOpen && (
        <Suspense fallback={null}>
          <LazyCommandConsole
            value={commandConsoleValue}
            isVClipEnabled={isVClipEnabled}
            onChange={setCommandConsoleValue}
            onClose={() => closeCommandConsole()}
            onSubmit={submitCommandConsole}
          />
        </Suspense>
      )}

      {questNpcEditorTarget && (
        <Suspense fallback={null}>
          <LazyQuestNpcEditor />
        </Suspense>
      )}
      {questDialogSession && (
        <Suspense fallback={null}>
          <LazyQuestDialogPanel />
        </Suspense>
      )}
      {isInventoryOpen && (
        <Suspense fallback={null}>
          <LazyInventoryPanel playerState={playerState} />
        </Suspense>
      )}

      {!localPlayerName && startMenuStage !== "press-start" && (
        <Suspense fallback={null}>
          <LazyPlayerNamePrompt
            value={playerNameInput}
            onChange={setPlayerNameInput}
            onSubmit={submitPlayerName}
          />
        </Suspense>
      )}

      {/* Reticle */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none text-white text-xl">
         +
      </div>

      {health <= 0 && (
        <div className="absolute inset-0 z-[260] bg-red-950/80 flex flex-col items-center justify-center pointer-events-auto">
          <h1 className="text-6xl text-red-500 font-bold tracking-widest drop-shadow-[0_4px_0_theme(colors.black)]">YOU DIED</h1>
          <p className="mt-8 text-xl text-red-200 drop-shadow-[0_2px_0_theme(colors.black)]">CLICK ANYWHERE TO RESPAWN</p>
        </div>
      )}

      {/* Start Game prompt */}
      {createPortal(
      <div 
        id="play-button-overlay" 
        style={menuOverlayStyle} 
        className="fixed inset-0 flex-col items-center justify-center bg-[#050207] z-[100] pointer-events-auto"
        onMouseDown={(e) => {
          if (e.button !== 0) return;
          requestResumeFromOverlay(e.target);
        }}
      >
        <div 
          className="absolute inset-0 flex-col items-center justify-center overflow-hidden px-4 py-4 pointer-events-none"
          style={{ display: "flex" }}
        >
        {!showVideoMenu ? (
          <PauseStartMenuContent
            startMenuStage={startMenuStage}
            setStartMenuStage={setStartMenuStage}
            pauseMenuIndex={pauseMenuIndex}
            setPauseMenuIndex={setPauseMenuIndex}
            canLock={canLock}
            isTouchDevice={isTouchDevice}
            isMultiplayerMode={isMultiplayerMode}
            currentInviteRoomCode={currentInviteRoomCode}
            inviteCodeInput={inviteCodeInput}
            inviteCodeMessage={inviteCodeMessage}
            setInviteCodeInput={setInviteCodeInput}
            setInviteCodeMessage={setInviteCodeMessage}
            lobbyRules={lobbyRules}
            survivalRules={survivalRules}
            survivalDifficulty={survivalDifficulty}
            survivalPlayerEstimate={survivalPlayerEstimate}
            launchMode={launchMode}
            startTouchGameplay={startTouchGameplay}
            closeMousePauseMenu={() => closePauseMenu("mouse")}
            openSettings={() => {
              setShowVideoMenu(true);
              setSettingsPane("video");
              setPauseMenuIndex(0);
            }}
            copyInvite={copyInvite}
            joinInviteCode={joinInviteCode}
            cycleLobbyMap={cycleLobbyMap}
            adjustLobbyMaxPlayers={adjustLobbyMaxPlayers}
            cycleLobbyDifficulty={cycleLobbyDifficulty}
            cycleLobbyManaRate={cycleLobbyManaRate}
            adjustSurvivalMaxPlayers={adjustSurvivalMaxPlayers}
            cycleSurvivalDifficulty={cycleSurvivalDifficulty}
            cycleSurvivalManaRate={cycleSurvivalManaRate}
            setLobbyRules={setLobbyRules}
            setSurvivalRules={setSurvivalRules}
          />
        ) : (
          <Suspense fallback={null}>
            <LazyHudSettingsPanel
              settingsPane={settingsPane}
              setSettingsPane={setSettingsPane}
              pauseMenuIndex={pauseMenuIndex}
              setPauseMenuIndex={setPauseMenuIndex}
              settingsScrollRef={settingsScrollRef}
              aspectRatio={aspectRatio}
              setAspectRatio={setAspectRatio}
              mouseSensitivity={mouseSensitivity}
              setMouseSensitivity={setMouseSensitivity}
              controllerLookSensitivity={controllerLookSensitivity}
              setControllerLookSensitivity={setControllerLookSensitivity}
              keyboardArrowLookEnabled={keyboardArrowLookEnabled}
              setKeyboardArrowLookEnabled={setKeyboardArrowLookEnabled}
              controllerBindings={controllerBindings}
              remappingAction={remappingAction}
              beginControllerRemap={beginControllerRemap}
              voiceNeedsSecureOrigin={voiceNeedsSecureOrigin}
              voiceChatEnabled={voiceChatEnabled}
              setVoiceChatEnabled={setVoiceChatEnabled}
              voiceInputMode={voiceInputMode}
              toggleVoiceInputMode={toggleVoiceInputMode}
              voicePushToTalkKey={voicePushToTalkKey}
              beginVoiceKeyRemap={beginVoiceKeyRemap}
              remappingVoiceKey={remappingVoiceKey}
              voiceOutputVolume={voiceOutputVolume}
              setVoiceOutputVolume={setVoiceOutputVolume}
              voiceProximityRange={voiceProximityRange}
              setVoiceProximityRange={setVoiceProximityRange}
              isVoiceSpeaking={isVoiceSpeaking}
              voiceStatus={voiceStatus}
              voiceError={voiceError}
              characterCustomization={characterCustomization}
              setCharacterCustomization={setCharacterCustomization}
              onBack={() => {
                setShowVideoMenu(false);
                setSettingsPane("video");
                setRemappingAction(null);
                setRemappingVoiceKey(false);
                setPauseMenuIndex(3);
              }}
            />
          </Suspense>
        )}
        </div>
      </div>,
      document.body
      )}

      {isFullscreenHintOpen && (
        <Suspense fallback={null}>
          <LazyFullscreenHelpModal
            onTryAgain={() => requestMobileFullscreen(true)}
            onClose={() => setIsFullscreenHintOpen(false)}
          />
        </Suspense>
      )}

      {isDevFastTravelOpen && isDevFastTravelAllowed && (
        <Suspense fallback={null}>
          <LazyDevFastTravelMenu
            locations={devFastTravelLocations}
            selectedIndex={devFastTravelIndex}
            onSelectIndex={setDevFastTravelIndex}
            onTravel={runDevFastTravel}
            onClose={() => closeDevFastTravelMenu(true)}
          />
        </Suspense>
      )}

      {isEngineMenuOpen && isEngineMenuAllowed && (
        <Suspense fallback={null}>
          <LazyEngineMenu
            open
            selectedId={engineMenuSelectedId}
            onPreviewPlaceable={previewEnginePlaceable}
            onSelectPlaceable={requestEnginePlaceable}
            onPreviewPlacedObject={previewEnginePlacedObject}
            onMovePlacedObject={moveEnginePlacedObject}
            onDeletePlacedObject={deleteEnginePlacedObject}
            onClearPlaceables={clearEnginePlaceables}
            onClose={() => closeEngineMenu(true)}
          />
        </Suspense>
      )}
       
      {isSpellMenuOpen && (
        <Suspense fallback={null}>
          <LazySpellMenu
            menuSpellIndex={menuSpellIndex}
            setMenuSpellIndex={setMenuSpellIndex}
            setMenuBindingHand={setMenuBindingHand}
            onClose={closeSpellMenuAndResume}
            bindingHand={activeBindingHand}
          />
        </Suspense>
      )}

      {isScoreboardOpen && !isSpellMenuOpen && !isInventoryOpen && (
        <Suspense fallback={null}>
          <LazyPlayerScoreMenu
            localPlayerName={localPlayerName}
            isSurvivalMode={isSurvivalMode}
            survivalLevel={survivalLevel}
            health={health}
            armor={armor}
            sleepUntil={sleepUntil}
            slowUntil={slowUntil}
            poisonUntil={poisonUntil}
            acidUntil={acidUntil}
            players={players}
          />
        </Suspense>
      )}

      {isReturningToGame && !isLocked && !controllerGameplayActive && !isSpellMenuOpen && !isInventoryOpen && (
        <button
          aria-label="Return to game"
          className="absolute inset-0 z-[105] cursor-crosshair bg-transparent pointer-events-auto"
          onMouseDown={(e) => {
            e.preventDefault();
            requestGamePointerLock();
          }}
        />
      )}

      {/* Player Hands (DOOM Style) */}
      {shouldExpectMagicHands && (
        <div
          className={isFillAspect
            ? "absolute left-1/2 top-1/2 max-h-full max-w-full -translate-x-1/2 -translate-y-1/2 pointer-events-none"
            : "absolute inset-0 pointer-events-none"
          }
          style={fillSafeFrameStyle}
        >
          <Suspense fallback={null}>
            <LazyMagicHands playerState={playerState} leftSpell={leftCurrentSpell} rightSpell={rightCurrentSpell} />
          </Suspense>
        </div>
      )}
      
      {/* HUD WRAPPER TO FORBID OVERLAP AND MAINTAIN RATIO */}
      {shouldShowTouchControls && (
        <Suspense fallback={null}>
          <LazyMobileTouchControls
            openSpellMenu={openSpellMenuFromGame}
            pauseTouchGameplay={pauseTouchGameplay}
            openEngineMenu={() => openEngineMenu("touch")}
            showEngineMenuButton={isEngineMenuAllowed}
          />
        </Suspense>
      )}

      {shouldShowGameplayOverlay && (
        <GameplayHudOverlay
          activeHand={activeHand}
          isMagicArmed={isMagicArmed}
          leftCurrentSpell={leftCurrentSpell}
          rightCurrentSpell={rightCurrentSpell}
          leftHotbarSpells={leftHotbarSpells}
          rightHotbarSpells={rightHotbarSpells}
          leftSelectedHotbarIndex={leftSelectedHotbarIndex}
          rightSelectedHotbarIndex={rightSelectedHotbarIndex}
          leftRunePower={leftRunePower}
          rightRunePower={rightRunePower}
          health={health}
          armor={armor}
          thrusterFuel={thrusterFuel}
          speedBoostUntil={speedBoostUntil}
          jumpBoostUntil={jumpBoostUntil}
          slowUntil={slowUntil}
          sleepUntil={sleepUntil}
          poisonUntil={poisonUntil}
          acidUntil={acidUntil}
          magicGlassOrbUntil={magicGlassOrbUntil}
        />
      )}
    </div>
  );
}
