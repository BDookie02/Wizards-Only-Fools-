import { startTransition, useEffect, useRef, type MutableRefObject } from "react";
import type { QuestDialogSession, QuestNpcEditorTarget, SpellType } from "../../../store/gameStore";

export type HudStateQaInputMode = "mouse" | "touch" | "controller";
export type HudStateQaSettingsPane = "video" | "keybinds" | "voice" | "character";
export type HudStateQaHand = "left" | "right";
export type HudStateQaMapPage = "live" | "world";

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

const HUD_STATE_QA_SETTINGS_PANES: HudStateQaSettingsPane[] = ["video", "keybinds", "voice", "character"];
const HUD_STATE_QA_MAP_PAGES: HudStateQaMapPage[] = ["live", "world"];
const HUD_STATE_QA_MAGIC_HAND_SPELLS: SpellType[] = [
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
const HUD_STATE_QA_NON_CHARGING_EFFECT_SPELLS: SpellType[] = ["iceshard", "grab"];

export function useHudStateQaRuntime(options: HudStateQaOptions) {
  const stateAppliedRef = useRef("");

  useEffect(() => {
    if (!import.meta.env.DEV || !options.isGameLaunched || !options.qaHudState) return;

    const runKey = `${options.qaHudState}:${options.qaSettingsPane}:${options.qaMapPage}:${options.qaMagicSpell}`;
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
      const nextPane = HUD_STATE_QA_SETTINGS_PANES.includes(options.qaSettingsPane as HudStateQaSettingsPane)
        ? options.qaSettingsPane as HudStateQaSettingsPane
        : "video";
      options.pauseMenuExplicitlyRequestedRef.current = true;
      options.pauseMenuRequestedRef.current = true;
      options.lastGameplayInputModeRef.current = options.touchGameplayActive
        ? "touch"
        : options.controllerGameplayActive
          ? "controller"
          : "mouse";
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
      options.openEngineMenu(
        options.touchGameplayActive ? "touch" : options.controllerGameplayActive ? "controller" : "mouse",
      );
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
      const nextMapPage = HUD_STATE_QA_MAP_PAGES.includes(options.qaMapPage as HudStateQaMapPage)
        ? options.qaMapPage as HudStateQaMapPage
        : "live";
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

    if (options.qaHudState === "questnpc" || options.qaHudState === "quest-npc") {
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
      options.openQuestNpcEditor({
        npcId: "qa-runtime-npc",
        townId: "qa-town",
        hutId: "qa-hut",
        defaultName: "QA Quest NPC",
        theme: "qa",
        position: [0, 0, 0],
      });
      return;
    }

    if (options.qaHudState === "questdialog" || options.qaHudState === "quest-dialog") {
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
      options.setQuestDialogSession({
        npcId: "qa-dialog-npc",
        townId: "qa-town",
        displayName: "QA Quest NPC",
        line: "QA dialog route for controller, keyboard, and aspect-ratio checks. This session is synthetic and safe to close.",
        choices: [
          { id: "darrel-close", label: "Close QA dialog" },
          { id: "qa-dialog-hold", label: "Keep dialog open" },
        ],
      });
      return;
    }

    if (options.qaHudState === "magichands" || options.qaHudState === "magic-hands") {
      closeGameplayOverlaysForQa();
      closeExpandedMapForQa();
      const nextSpell = HUD_STATE_QA_MAGIC_HAND_SPELLS.includes(options.qaMagicSpell as SpellType)
        ? options.qaMagicSpell as SpellType
        : "fireball";
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
      const shouldForceCharging = !HUD_STATE_QA_NON_CHARGING_EFFECT_SPELLS.includes(nextSpell);
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
