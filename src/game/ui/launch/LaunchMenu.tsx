import { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  CharacterCustomization,
  GameMode,
  SurvivalGameMode,
  getSurvivalLevelXpTarget,
  sanitizePlayerName,
  useGameStore,
} from "../../../store/gameStore";
import {
  createControllerPollScheduler,
  GAMEPAD_NO_DEVICE_POLL_INTERVAL_MS,
  getPrimaryGamepad,
  isGamepadButtonPressed,
  readGamepadStickAxesInto,
  type GamepadButtonName,
  type GamepadStickAxes,
} from "../../systems/input/controllerInput";
import {
  applyInviteRoomCode,
  extractInviteRoomCode,
  getCurrentInviteRoomCode,
  getMobileInviteUrl,
  type LanInfoResponse,
} from "../../network/inviteRoom";
import { getRandomBase36Suffix } from "../../systems/random/runtimeRandom";
import {
  clampLaunchMenuIndex,
  cycleLaunchOption,
  findDirectionalMenuIndex,
  formatLaunchOption,
  getLaunchMenuOptionCount,
  launchColorPresets,
  launchHairStyles,
  launchHatStyles,
  type LaunchInputSource,
  type LaunchMenuStage,
  type MenuDirection,
} from "./launchMenuConfig";
import {
  consumeLaunchControllerPress,
  resetLaunchControllerTracking,
  resolveLaunchControllerMoveDirection,
} from "./launchMenuControllerRuntime";

const LazyLaunchCharacterPreview = lazy(() => import("./LaunchCharacterPreview").then((module) => ({ default: module.LaunchCharacterPreview })));
const launchMenuStickScratch: GamepadStickAxes = { x: 0, y: 0 };

function getCurrentRoomCode() {
  return getCurrentInviteRoomCode("");
}

function applyRoomCode(value: string) {
  return applyInviteRoomCode(value);
}

function makeDefaultWizardName() {
  return `Wizard ${getRandomBase36Suffix(4).toUpperCase()}`;
}

function makeDefaultRoomCode() {
  return `wof-${getRandomBase36Suffix(5)}`;
}

export function LaunchMenu() {
  const localPlayerName = useGameStore(s => s.localPlayerName);
  const setLocalPlayerName = useGameStore(s => s.setLocalPlayerName);
  const characterCustomization = useGameStore(s => s.characterCustomization);
  const setCharacterCustomization = useGameStore(s => s.setCharacterCustomization);
  const survivalSave = useGameStore(s => s.survivalSave);
  const survivalLevel = useGameStore(s => s.survivalLevel);
  const survivalXp = useGameStore(s => s.survivalXp);
  const createNewSurvivalSave = useGameStore(s => s.createNewSurvivalSave);
  const continueSurvivalSave = useGameStore(s => s.continueSurvivalSave);
  const saveSurvivalProgress = useGameStore(s => s.saveSurvivalProgress);
  const setGameMode = useGameStore(s => s.setGameMode);
  const setGameLaunched = useGameStore(s => s.setGameLaunched);
  const setTouchControlsActive = useGameStore(s => s.setTouchControlsActive);
  const setControllerGameplayActive = useGameStore(s => s.setControllerGameplayActive);
  const controllerBindings = useGameStore(s => s.controllerBindings);
  const [stage, setStage] = useState<LaunchMenuStage>("press");
  const [playerNameInput, setPlayerNameInput] = useState(() => localPlayerName || survivalSave?.playerName || makeDefaultWizardName());
  const [inviteCodeInput, setInviteCodeInput] = useState(() => getCurrentRoomCode() || makeDefaultRoomCode());
  const [mobileInviteUrl, setMobileInviteUrl] = useState(() => getMobileInviteUrl(getCurrentRoomCode()));
  const [mobileInviteMessage, setMobileInviteMessage] = useState("");
  const [controllerMenuIndex, setControllerMenuIndex] = useState(0);
  const controllerButtonsRef = useRef<Partial<Record<string, boolean>>>({});
  const controllerRepeatRef = useRef<Partial<Record<string, number>>>({});
  const cleanedName = sanitizePlayerName(playerNameInput);
  const canSubmitName = cleanedName.length >= 2;
  const inviteRoomCode = extractInviteRoomCode(inviteCodeInput);
  const canSubmitInviteCode = inviteRoomCode.length > 0;
  const survivalXpTarget = getSurvivalLevelXpTarget(survivalLevel);

  const updateOutfitColor = (direction: 1 | -1 = 1) => {
    const nextColor = cycleLaunchOption(launchColorPresets, characterCustomization.topColor, direction);
    setCharacterCustomization({ topColor: nextColor, hatColor: nextColor });
  };

  const updateSkinColor = (direction: 1 | -1 = 1) => {
    setCharacterCustomization({
      skinColor: cycleLaunchOption(launchColorPresets, characterCustomization.skinColor, direction),
    });
  };

  const updateHairColor = (direction: 1 | -1 = 1) => {
    const nextColor = cycleLaunchOption(launchColorPresets, characterCustomization.hairColor, direction);
    setCharacterCustomization({ hairColor: nextColor, facialHairColor: nextColor });
  };

  const updateHatStyle = (direction: 1 | -1 = 1) => {
    setCharacterCustomization({
      hatStyle: cycleLaunchOption(launchHatStyles, characterCustomization.hatStyle, direction),
    });
  };

  const updateHairStyle = (direction: 1 | -1 = 1) => {
    setCharacterCustomization({
      hairStyle: cycleLaunchOption(launchHairStyles, characterCustomization.hairStyle, direction),
    });
  };

  const createSurvivalProfile = (mode: SurvivalGameMode) => {
    if (!canSubmitName) return null;
    return createNewSurvivalSave({
      playerName: cleanedName,
      characterCustomization: characterCustomization as CharacterCustomization,
      mode,
    });
  };

  const enterInviteFlow = (inputSource: LaunchInputSource = "mouse") => {
    const room = getCurrentRoomCode();
    if (!room) {
      setStage("save");
      return;
    }

    setInviteCodeInput(room);
    setControllerMenuIndex(0);
    if (!survivalSave) {
      setStage("new");
      setControllerMenuIndex(6);
      return;
    }

    continueSurvivalSave("multiplayer-survival");
    setStage("survival");
    setControllerGameplayActive(inputSource === "controller");
  };

  const beginNewSurvival = (mode: SurvivalGameMode, inputSource: LaunchInputSource = "mouse") => {
    const profile = createSurvivalProfile(mode);
    if (!profile) return;

    if (mode === "multiplayer-survival") {
      setStage("survival");
      setControllerMenuIndex(0);
      return;
    }

    launchMode("solo-survival", false, inputSource);
  };

  const continueSavedSurvival = (inputSource: LaunchInputSource = "mouse") => {
    if (!survivalSave) return;
    const mode = survivalSave.lastMode;
    if (!continueSurvivalSave(mode)) return;

    if (mode === "multiplayer-survival") {
      setStage("survival");
      setControllerMenuIndex(0);
      return;
    }

    launchMode("solo-survival", false, inputSource);
  };

  const launchMode = (mode: GameMode, useInviteCode = false, inputSource: LaunchInputSource = "mouse") => {
    const isSurvivalMode = mode === "solo-survival" || mode === "multiplayer-survival";
    if (isSurvivalMode) {
      if (survivalSave) {
        saveSurvivalProgress({ lastMode: mode });
      } else if (!createSurvivalProfile(mode)) {
        setStage("new");
        return;
      }
    } else if (!localPlayerName && canSubmitName) {
      setLocalPlayerName(cleanedName);
    }
    if (useInviteCode) {
      if (!canSubmitInviteCode) return;
      const appliedRoomCode = applyRoomCode(inviteCodeInput);
      if (!appliedRoomCode) return;
      setInviteCodeInput(appliedRoomCode);
    }
    setTouchControlsActive(false);
    setControllerGameplayActive(inputSource === "controller");
    setGameMode(mode);
    setGameLaunched(true);
    if (inputSource === "controller") {
      window.setTimeout(() => window.dispatchEvent(new Event("controller-gameplay-started")), 0);
    }
  };

  const goBack = () => {
    if (stage === "press") return;
    if (stage === "save") {
      setStage("press");
      return;
    }
    if (stage === "new") {
      setStage("save");
      return;
    }
    if (stage === "multiplayer") {
      setStage("save");
      return;
    }
    setStage("multiplayer");
  };

  const runControllerMenuAction = (index: number) => {
    if (stage === "press") {
      enterInviteFlow("controller");
      return;
    }

    if (stage === "save") {
      if (index === 0) {
        setStage("new");
        return;
      }
      if (index === 1) {
        continueSavedSurvival("controller");
        return;
      }
      setStage("multiplayer");
      return;
    }

    if (stage === "new") {
      if (index === 0) updateOutfitColor();
      else if (index === 1) updateSkinColor();
      else if (index === 2) updateHairColor();
      else if (index === 3) updateHatStyle();
      else if (index === 4) updateHairStyle();
      else if (index === 5) beginNewSurvival("solo-survival", "controller");
      else if (index === 6) beginNewSurvival("multiplayer-survival", "controller");
      else setStage("save");
      return;
    }

    if (stage === "multiplayer") {
      if (index === 0) setStage("custom");
      else if (index === 1) {
        if (!survivalSave) {
          setStage("new");
          setControllerMenuIndex(6);
          return;
        }
        continueSurvivalSave("multiplayer-survival");
        setStage("survival");
      }
      else setStage("save");
      return;
    }

    if (stage === "custom" || stage === "survival") {
      if (index === 0) {
        launchMode(stage === "custom" ? "custom-lobby" : "multiplayer-survival", true, "controller");
      } else if (index === 1) {
        copyMobileInvite();
      } else {
        setStage("multiplayer");
      }
    }
  };

  useEffect(() => {
    setControllerMenuIndex((index) => clampLaunchMenuIndex(index, getLaunchMenuOptionCount(stage)));
    controllerRepeatRef.current = {};
  }, [stage]);

  useEffect(() => {
    if (stage !== "custom" && stage !== "survival") {
      setMobileInviteMessage("");
      return;
    }

    const room = extractInviteRoomCode(inviteCodeInput);
    setMobileInviteMessage("");
    if (!room) {
      setMobileInviteUrl("");
      return;
    }

    let cancelled = false;
    setMobileInviteUrl(getMobileInviteUrl(room));

    void fetch("/api/lan-info", { cache: "no-store" })
      .then((response) => response.ok ? response.json() as Promise<LanInfoResponse> : null)
      .then((info) => {
        if (cancelled || !info) return;
        setMobileInviteUrl(getMobileInviteUrl(room, info));
      })
      .catch(() => {
        // Localhost still works for same-device testing when LAN discovery is unavailable.
      });

    return () => {
      cancelled = true;
    };
  }, [inviteCodeInput, stage]);

  const copyMobileInvite = () => {
    if (!mobileInviteUrl) return;
    void navigator.clipboard?.writeText(mobileInviteUrl).then(
      () => setMobileInviteMessage("MOBILE LINK COPIED"),
      () => setMobileInviteMessage("COPY FAILED")
    );
  };

  const moveLaunchMenuFocus = (direction: MenuDirection) => {
    setControllerMenuIndex((index) => findDirectionalMenuIndex(
      "[data-launch-index]",
      "data-launch-index",
      index,
      direction,
      getLaunchMenuOptionCount(stage)
    ));
  };

  useEffect(() => {
    let controllerPollScheduler: ReturnType<typeof createControllerPollScheduler>;
    const pollController = (now: number) => {
      const gamepad = getPrimaryGamepad();
      if (!gamepad) {
        resetLaunchControllerTracking(controllerButtonsRef.current, controllerRepeatRef.current);
        controllerPollScheduler.schedule(GAMEPAD_NO_DEVICE_POLL_INTERVAL_MS);
        return;
      }

      const selectPressed = consumeLaunchControllerPress(controllerButtonsRef.current, "launchSelect", isGamepadButtonPressed(gamepad, controllerBindings.menuSelect as GamepadButtonName));
      const backPressed = consumeLaunchControllerPress(controllerButtonsRef.current, "launchBack", isGamepadButtonPressed(gamepad, controllerBindings.menuBack as GamepadButtonName));
      const startPressed = consumeLaunchControllerPress(controllerButtonsRef.current, "launchStart", isGamepadButtonPressed(gamepad, controllerBindings.pause as GamepadButtonName));
      const dpadUp = isGamepadButtonPressed(gamepad, "dpadUp");
      const dpadDown = isGamepadButtonPressed(gamepad, "dpadDown");
      const dpadLeft = isGamepadButtonPressed(gamepad, "dpadLeft");
      const dpadRight = isGamepadButtonPressed(gamepad, "dpadRight");
      readGamepadStickAxesInto(gamepad, "left", launchMenuStickScratch, 0.55);
      const moveDirection = resolveLaunchControllerMoveDirection({
        buttonState: controllerButtonsRef.current,
        repeatState: controllerRepeatRef.current,
        now,
        dpadUp,
        dpadDown,
        dpadLeft,
        dpadRight,
        stickX: launchMenuStickScratch.x,
        stickY: launchMenuStickScratch.y,
      });

      if (moveDirection) {
        moveLaunchMenuFocus(moveDirection);
      }

      if (backPressed) {
        goBack();
        controllerPollScheduler.schedule(0);
        return;
      }

      if (selectPressed || startPressed) {
        runControllerMenuAction(controllerMenuIndex);
      }

      controllerPollScheduler.schedule(0);
    };

    controllerPollScheduler = createControllerPollScheduler(pollController);
    controllerPollScheduler.schedule(0);
    return () => controllerPollScheduler.cancel();
  }, [
    characterCustomization,
    controllerBindings,
    controllerMenuIndex,
    localPlayerName,
    stage,
    survivalSave,
    canSubmitInviteCode,
    canSubmitName,
    cleanedName,
    inviteCodeInput,
    mobileInviteUrl,
  ]);

  const panelClass = "pointer-events-auto w-[min(92vw,720px)] border-2 border-purple-300/45 bg-[#100718]/90 p-4 shadow-[0_0_42px_rgba(88,28,135,0.42)]";
  const buttonClass = "w-full border-2 border-[#888] border-b-[#222] border-r-[#222] bg-[#2b1738] px-4 py-3 text-left font-mono uppercase tracking-[0.14em] text-cyan-50 transition hover:bg-[#3f2450]";
  const controllerFocusClass = "border-yellow-200 bg-yellow-300/15 text-yellow-100 shadow-[0_0_22px_rgba(250,204,21,0.28)]";
  const getLaunchButtonClass = (index: number, extra = "") => `${buttonClass} ${controllerMenuIndex === index ? controllerFocusClass : ""} ${extra}`;
  const setupButtonClass = (index: number) => `border-2 bg-black/45 px-3 py-2 text-left tracking-[0.12em] transition hover:border-yellow-200 ${controllerMenuIndex === index ? controllerFocusClass : "border-cyan-100/30"}`;
  const renderSetupButton = (index: number, label: string, value: string, onClick: () => void) => (
    <button
      type="button"
      data-launch-index={index}
      className={setupButtonClass(index)}
      onMouseEnter={() => setControllerMenuIndex(index)}
      onClick={onClick}
    >
      <span className="block text-[0.58rem] text-cyan-100/65">{label}</span>
      <span className="mt-1 block text-[0.86rem] font-bold text-white">{value}</span>
    </button>
  );

  if (stage === "press") {
    return (
      <button
        type="button"
        className="pointer-events-auto fixed inset-0 z-[220] flex cursor-pointer flex-col items-center justify-center bg-[radial-gradient(circle_at_center,rgba(88,28,135,0.35),rgba(5,2,7,0.96)_62%)] px-4 text-center font-mono uppercase text-white"
        style={{ width: "var(--app-vw, 100dvw)", height: "var(--app-vh, 100dvh)" }}
        onClick={() => enterInviteFlow()}
      >
        <span className="text-[clamp(2rem,8vmin,5.5rem)] font-bold leading-[0.85] tracking-[0.1em] text-[#ffb347] drop-shadow-[4px_4px_0_theme(colors.purple.900)]">
          Wizards<br />Only<br />Fools!
        </span>
        <span className="mt-8 animate-pulse text-[clamp(0.95rem,3vmin,1.65rem)] font-bold tracking-[0.18em] text-cyan-100">
          Press Anywhere To Play
        </span>
        <span className="mt-3 text-[clamp(0.65rem,1.8vmin,0.9rem)] tracking-[0.2em] text-cyan-100/60">
          Controller: A / Start
        </span>
      </button>
    );
  }

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-[220] flex items-center justify-center bg-[#050207]/95 px-4 font-mono uppercase text-white"
      style={{ width: "var(--app-vw, 100dvw)", height: "var(--app-vh, 100dvh)" }}
    >
      {stage === "save" && (
        <div className={`${panelClass} flex flex-col gap-3`}>
          <h1 className="text-center text-[clamp(1.1rem,4vmin,2.1rem)] font-bold tracking-[0.18em] text-[#ffb347]">Survival Save</h1>
          <button data-launch-index={0} className={getLaunchButtonClass(0)} onClick={() => setStage("new")}>New</button>
          <button
            data-launch-index={1}
            className={getLaunchButtonClass(1, survivalSave ? "" : "cursor-not-allowed opacity-45")}
            disabled={!survivalSave}
            onClick={() => continueSavedSurvival()}
          >
            {survivalSave ? `Continue LVL ${survivalSave.survivalLevel} - ${survivalSave.playerName}` : "Continue"}
          </button>
          <button data-launch-index={2} className={getLaunchButtonClass(2)} onClick={() => setStage("multiplayer")}>Multiplayer</button>
        </div>
      )}

      {stage === "new" && (
        <div className="pointer-events-auto max-h-[calc(100dvh-24px)] w-[min(94vw,900px)] overflow-y-auto border-2 border-purple-300/45 bg-[#100718]/92 p-4 shadow-[0_0_42px_rgba(88,28,135,0.42)]">
          <h1 className="text-center text-[clamp(1rem,3.4vmin,1.75rem)] font-bold tracking-[0.18em] text-[#ffb347]">New Wizard</h1>
          <div className="mt-4 grid gap-4 md:grid-cols-[220px_1fr]">
            <Suspense fallback={<div className="aspect-square w-full border border-yellow-200/35 bg-black" />}>
              <LazyLaunchCharacterPreview character={characterCustomization} />
            </Suspense>
            <div className="flex flex-col gap-3">
              <input
                autoFocus
                aria-label="Player name"
                value={playerNameInput}
                maxLength={18}
                autoCapitalize="words"
                autoCorrect="off"
                spellCheck={false}
                placeholder="enter wizard name"
                className="normal-case w-full border-2 border-[#888] border-b-[#222] border-r-[#222] bg-black px-3 py-3 text-center text-[clamp(0.9rem,3vmin,1.3rem)] text-white outline-none focus:border-yellow-200"
                onChange={(event) => setPlayerNameInput(sanitizePlayerName(event.currentTarget.value))}
              />
              <div className="grid gap-2 sm:grid-cols-2">
                {renderSetupButton(0, "Outfit", characterCustomization.topColor, () => updateOutfitColor())}
                {renderSetupButton(1, "Skin", characterCustomization.skinColor, () => updateSkinColor())}
                {renderSetupButton(2, "Hair Color", characterCustomization.hairColor, () => updateHairColor())}
                {renderSetupButton(3, "Hat", formatLaunchOption(characterCustomization.hatStyle), () => updateHatStyle())}
                {renderSetupButton(4, "Hair", formatLaunchOption(characterCustomization.hairStyle), () => updateHairStyle())}
                <div className="border-2 border-cyan-100/25 bg-black/35 px-3 py-2 text-[0.62rem] tracking-[0.14em] text-cyan-100/70">
                  <span className="block text-yellow-100">LVL {survivalLevel}</span>
                  <span className="mt-1 block normal-case">{survivalXp} / {survivalXpTarget} XP</span>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <button
              data-launch-index={5}
              className={getLaunchButtonClass(5, canSubmitName ? "" : "cursor-not-allowed opacity-45")}
              disabled={!canSubmitName}
              onMouseEnter={() => setControllerMenuIndex(5)}
              onClick={() => beginNewSurvival("solo-survival")}
            >
              Start Solo Survival
            </button>
            <button
              data-launch-index={6}
              className={getLaunchButtonClass(6, canSubmitName ? "" : "cursor-not-allowed opacity-45")}
              disabled={!canSubmitName}
              onMouseEnter={() => setControllerMenuIndex(6)}
              onClick={() => beginNewSurvival("multiplayer-survival")}
            >
              Survival Multiplayer
            </button>
            <button
              data-launch-index={7}
              className={getLaunchButtonClass(7)}
              onMouseEnter={() => setControllerMenuIndex(7)}
              onClick={() => setStage("save")}
            >
              Back
            </button>
          </div>
        </div>
      )}

      {stage === "multiplayer" && (
        <div className={`${panelClass} flex flex-col gap-3`}>
          <h1 className="text-center text-[clamp(1.1rem,4vmin,2.1rem)] font-bold tracking-[0.18em] text-[#ffb347]">Multiplayer</h1>
          <button data-launch-index={0} className={getLaunchButtonClass(0)} onClick={() => setStage("custom")}>Custom Lobby</button>
          <button data-launch-index={1} className={getLaunchButtonClass(1)} onClick={() => {
            if (!survivalSave) {
              setStage("new");
              setControllerMenuIndex(6);
              return;
            }
            continueSurvivalSave("multiplayer-survival");
            setStage("survival");
          }}>
            Survival Multiplayer
          </button>
          <button data-launch-index={2} className={getLaunchButtonClass(2)} onClick={() => setStage("save")}>Back</button>
        </div>
      )}

      {(stage === "custom" || stage === "survival") && (
        <div className={`${panelClass} flex flex-col gap-3`}>
          <h1 className="text-center text-[clamp(1rem,3.5vmin,1.8rem)] font-bold tracking-[0.18em] text-[#ffb347]">
            {stage === "custom" ? "Custom Lobby" : "Survival Multiplayer"}
          </h1>
          <input
            aria-label="Invite code"
            value={inviteCodeInput}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="enter invite code"
            className="normal-case w-full border-2 border-[#888] border-b-[#222] border-r-[#222] bg-black px-3 py-3 text-center text-[clamp(0.8rem,2.4vmin,1.1rem)] text-white outline-none focus:border-yellow-200"
            onChange={(event) => setInviteCodeInput(event.currentTarget.value)}
          />
          <div className="border-2 border-cyan-100/25 bg-black/40 p-2 text-[0.58rem] tracking-[0.14em] text-cyan-100/60">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span>Mobile Crossplay Link</span>
              <span className="text-yellow-100">{inviteRoomCode || "NO ROOM"}</span>
            </div>
            <input
              aria-label="Mobile crossplay invite link"
              readOnly
              value={mobileInviteUrl}
              className="normal-case w-full border border-cyan-100/20 bg-[#050207] px-2 py-1 text-[0.56rem] text-cyan-50 outline-none"
              onFocus={(event) => event.currentTarget.select()}
            />
          </div>
          <button
            data-launch-index={0}
            className={getLaunchButtonClass(0, canSubmitInviteCode ? "" : "cursor-not-allowed opacity-45")}
            disabled={!canSubmitInviteCode}
            onClick={() => launchMode(stage === "custom" ? "custom-lobby" : "multiplayer-survival", true)}
          >
            {stage === "custom" ? "Create Custom Lobby" : "Create Survival Lobby"}
          </button>
          <button
            data-launch-index={1}
            className={getLaunchButtonClass(1, mobileInviteUrl ? "" : "cursor-not-allowed opacity-45")}
            disabled={!mobileInviteUrl}
            onClick={copyMobileInvite}
          >
            {mobileInviteMessage || "Copy Mobile Link"}
          </button>
          <button data-launch-index={2} className={getLaunchButtonClass(2)} onClick={() => setStage("multiplayer")}>Back</button>
          <div className="text-center text-[0.62rem] tracking-[0.18em] text-cyan-100/50">
            Controller: D-pad/stick moves, A selects, B backs out.
          </div>
        </div>
      )}
    </div>
  );
}
