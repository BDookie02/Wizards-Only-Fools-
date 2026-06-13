import { startTransition, useEffect, useRef, type MutableRefObject } from "react";
import type { QuestDialogSession, QuestNpcEditorTarget, SpellType } from "../../../store/gameStore";
import {
  createHudStateQaQuestDialogSession,
  createHudStateQaQuestNpcEditorTarget,
  getHudStateQaRunKey,
  isHudStateQaMagicHandsState,
  isHudStateQaQuestDialogState,
  isHudStateQaQuestNpcEditorState,
  resolveHudStateQaInputMode,
  resolveHudStateQaMagicSpell,
  resolveHudStateQaMapPage,
  resolveHudStateQaSettingsPane,
  shouldForceHudStateQaMagicHandsCharging,
  type HudStateQaHand,
  type HudStateQaInputMode,
  type HudStateQaMapPage,
  type HudStateQaSettingsPane,
} from "./hudStateQaRules";

export type {
  HudStateQaHand,
  HudStateQaInputMode,
  HudStateQaMapPage,
  HudStateQaSettingsPane,
} from "./hudStateQaRules";

export type HudStateQaOptions = {
  activeHand: HudStateQaHand;
  controllerGameplayActive: boolean;
  isGameLaunched: boolean;
  isMapExpanded: boolean;
  qaHudState: string;
  qaMagicSpell: string;
  qaMapPage: string;
  qaSettingsPane: string;
  touchGameplayActive: boolean;
  lastGameplayInputModeRef: MutableRefObject<HudStateQaInputMode>;
  pauseMenuExplicitlyRequestedRef: MutableRefObject<boolean>;
  pauseMenuRequestedRef: MutableRefObject<boolean>;
  pointerLockRequestIdRef: MutableRefObject<number>;
  pointerLockResumeGraceUntilRef: MutableRefObject<number>;
  closeQuestNpcEditor: () => void;
  openEngineMenu: (inputMode: HudStateQaInputMode) => boolean;
  openQuestNpcEditor: (target: QuestNpcEditorTarget) => void;
  releaseMobileGameplayInputs: () => void;
  setCanLock: (value: boolean) => void;
  setControllerGameplayActive: (value: boolean) => void;
  setDevFastTravelOpen: (value: boolean) => void;
  setEngineMenuOpen: (value: boolean) => void;
  setInventoryOpen: (value: boolean) => void;
  setIsLocked: (value: boolean) => void;
  setIsReturningToGame: (value: boolean) => void;
  setHandCharging: (hand: HudStateQaHand, charging: boolean) => void;
  setLeftRunePower: (value: number) => void;
  setMagicArmed: (armed: boolean) => void;
  setMenuBindingHand: (hand: HudStateQaHand) => void;
  setExpandedMapPage: (page: HudStateQaMapPage) => void;
  setMouseLookFallbackActive: (value: boolean) => void;
  setPauseMenuIndex: (index: number) => void;
  setPauseMenuOpen: (value: boolean) => void;
  setPauseOverlayOpen: (value: boolean) => void;
  setQuestDialogSession: (session: QuestDialogSession | null) => void;
  setQuestDevModeEnabled: (enabled: boolean) => void;
  setRemappingAction: (value: null) => void;
  setRemappingVoiceKey: (value: boolean) => void;
  setRightRunePower: (value: number) => void;
  setScoreboardSource: (source: "keyboard" | "controller", open: boolean) => void;
  setSettingsPane: (pane: HudStateQaSettingsPane) => void;
  setShowVideoMenu: (value: boolean) => void;
  setSpell: (spell: SpellType, hand?: HudStateQaHand) => void;
  setSpellMenuOpen: (value: boolean) => void;
  setStartMenuStage: (stage: "resume") => void;
  setTouchControlsActive: (value: boolean) => void;
  toggleMap: () => void;
  videoAspectStartIndex: number;
};

export function useHudStateQaRuntime(options: HudStateQaOptions) {
  const stateAppliedRef = useRef("");

  useEffect(() => {
    if (!import.meta.env.DEV || !options.isGameLaunched || !options.qaHudState) return;

    const runKey = getHudStateQaRunKey(options);
    if (stateAppliedRef.current === runKey) return;
    stateAppliedRef.current = runKey;

    const closeGameplayOverlaysForQa = () => {
      options.pointerLockRequestIdRef.current += 1;
      options.pointerLockResumeGraceUntilRef.current = 0;
      if (typeof document !== "undefined") {
        document.documentElement.classList.remove("wizards-mouse-gameplay-active");
        if (document.pointerLockElement) {
          document.exitPointerLock();
        }
      }
      options.setMouseLookFallbackActive(false);
      options.setScoreboardSource("keyboard", false);
      options.setScoreboardSource("controller", false);
      options.setInventoryOpen(false);
      options.setDevFastTravelOpen(false);
      options.setEngineMenuOpen(false);
      options.setSpellMenuOpen(false);
      options.closeQuestNpcEditor();
      options.setQuestDialogSession(null);
      options.setHandCharging("left", false);
      options.setHandCharging("right", false);
      options.setRemappingAction(null);
      options.setRemappingVoiceKey(false);
      options.setIsReturningToGame(false);
      options.setIsLocked(false);
      options.setCanLock(true);
    };

    const closeExpandedMapForQa = () => {
      if (options.isMapExpanded) {
        startTransition(options.toggleMap);
      }
    };

    if (options.qaHudState === "spell") {
      closeGameplayOverlaysForQa();
      closeExpandedMapForQa();
      options.pauseMenuExplicitlyRequestedRef.current = false;
      options.pauseMenuRequestedRef.current = false;
      options.setPauseOverlayOpen(false);
      options.setPauseMenuOpen(false);
      options.setShowVideoMenu(false);
      options.setTouchControlsActive(false);
      options.releaseMobileGameplayInputs();
      options.setControllerGameplayActive(false);
      options.setMenuBindingHand(options.activeHand);
      options.setSpellMenuOpen(true);
      return;
    }

    if (options.qaHudState === "settings") {
      closeGameplayOverlaysForQa();
      closeExpandedMapForQa();
      const nextPane = resolveHudStateQaSettingsPane(options.qaSettingsPane);
      options.pauseMenuExplicitlyRequestedRef.current = true;
      options.pauseMenuRequestedRef.current = true;
      options.lastGameplayInputModeRef.current = resolveHudStateQaInputMode(options);
      options.setStartMenuStage("resume");
      options.setPauseOverlayOpen(true);
      options.setPauseMenuOpen(true);
      options.setShowVideoMenu(true);
      options.setSettingsPane(nextPane);
      options.setPauseMenuIndex(nextPane === "video" ? options.videoAspectStartIndex : 0);
      options.setTouchControlsActive(false);
      options.releaseMobileGameplayInputs();
      options.setControllerGameplayActive(false);
      return;
    }

    if (options.qaHudState === "engine") {
      closeExpandedMapForQa();
      options.openEngineMenu(resolveHudStateQaInputMode(options));
      return;
    }

    if (options.qaHudState === "map") {
      closeGameplayOverlaysForQa();
      options.pauseMenuExplicitlyRequestedRef.current = false;
      options.pauseMenuRequestedRef.current = false;
      options.setPauseOverlayOpen(false);
      options.setPauseMenuOpen(false);
      options.setShowVideoMenu(false);
      if (!options.isMapExpanded) {
        startTransition(options.toggleMap);
      }
      const nextMapPage = resolveHudStateQaMapPage(options.qaMapPage);
      options.setExpandedMapPage(nextMapPage);
      return;
    }

    if (options.qaHudState === "inventory") {
      closeGameplayOverlaysForQa();
      closeExpandedMapForQa();
      options.pauseMenuExplicitlyRequestedRef.current = false;
      options.pauseMenuRequestedRef.current = false;
      options.setPauseOverlayOpen(false);
      options.setPauseMenuOpen(false);
      options.setShowVideoMenu(false);
      options.setTouchControlsActive(false);
      options.releaseMobileGameplayInputs();
      options.setControllerGameplayActive(false);
      options.setInventoryOpen(true);
      return;
    }

    if (isHudStateQaQuestNpcEditorState(options.qaHudState)) {
      closeGameplayOverlaysForQa();
      closeExpandedMapForQa();
      options.pauseMenuExplicitlyRequestedRef.current = false;
      options.pauseMenuRequestedRef.current = false;
      options.setPauseOverlayOpen(false);
      options.setPauseMenuOpen(false);
      options.setShowVideoMenu(false);
      options.setTouchControlsActive(false);
      options.releaseMobileGameplayInputs();
      options.setControllerGameplayActive(false);
      options.setQuestDevModeEnabled(true);
      options.openQuestNpcEditor(createHudStateQaQuestNpcEditorTarget());
      return;
    }

    if (isHudStateQaQuestDialogState(options.qaHudState)) {
      closeGameplayOverlaysForQa();
      closeExpandedMapForQa();
      options.pauseMenuExplicitlyRequestedRef.current = false;
      options.pauseMenuRequestedRef.current = false;
      options.setPauseOverlayOpen(false);
      options.setPauseMenuOpen(false);
      options.setShowVideoMenu(false);
      options.setTouchControlsActive(false);
      options.releaseMobileGameplayInputs();
      options.setControllerGameplayActive(false);
      options.setQuestDialogSession(createHudStateQaQuestDialogSession());
      return;
    }

    if (isHudStateQaMagicHandsState(options.qaHudState)) {
      closeGameplayOverlaysForQa();
      closeExpandedMapForQa();
      const nextSpell = resolveHudStateQaMagicSpell(options.qaMagicSpell);
      options.pauseMenuExplicitlyRequestedRef.current = false;
      options.pauseMenuRequestedRef.current = false;
      options.setPauseOverlayOpen(false);
      options.setPauseMenuOpen(false);
      options.setShowVideoMenu(false);
      options.setTouchControlsActive(false);
      options.releaseMobileGameplayInputs();
      options.setControllerGameplayActive(false);
      options.setMagicArmed(true);
      options.setSpell(nextSpell, "left");
      options.setSpell(nextSpell, "right");
      options.setLeftRunePower(60);
      options.setRightRunePower(60);
      const shouldForceCharging = shouldForceHudStateQaMagicHandsCharging(nextSpell);
      options.setHandCharging("left", shouldForceCharging);
      options.setHandCharging("right", shouldForceCharging);
      return;
    }

    if (options.qaHudState === "scoreboard") {
      closeGameplayOverlaysForQa();
      closeExpandedMapForQa();
      options.pauseMenuExplicitlyRequestedRef.current = false;
      options.pauseMenuRequestedRef.current = false;
      options.setPauseOverlayOpen(false);
      options.setPauseMenuOpen(false);
      options.setShowVideoMenu(false);
      options.setTouchControlsActive(false);
      options.releaseMobileGameplayInputs();
      options.setControllerGameplayActive(false);
      options.setScoreboardSource("keyboard", true);
    }
  }, [options]);
}

export function HudStateQaRuntimeProbe({ options }: { options: HudStateQaOptions }) {
  useHudStateQaRuntime(options);
  return null;
}
