import type { Dispatch, SetStateAction } from "react";
import { Copy } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { GameMode, LobbyRules, SurvivalRules } from "../../../store/gameStore";
import { formatCharacterOption } from "./hudSettingsUtils";
import { PAUSE_FOCUSED_MENU_CLASS, PauseMenuButton } from "./PauseMenuButton";

export type StartMenuStage = "press-start" | "mode-select" | "multiplayer-select" | "custom-lobby" | "survival-options" | "resume";

type StepHandler = (direction: 1 | -1) => void;

type PauseStartMenuContentProps = {
  startMenuStage: StartMenuStage;
  setStartMenuStage: Dispatch<SetStateAction<StartMenuStage>>;
  pauseMenuIndex: number;
  setPauseMenuIndex: Dispatch<SetStateAction<number>>;
  canLock: boolean;
  isTouchDevice: boolean;
  isMultiplayerMode: boolean;
  currentInviteRoomCode: string;
  inviteCodeInput: string;
  inviteCodeMessage: string;
  setInviteCodeInput: Dispatch<SetStateAction<string>>;
  setInviteCodeMessage: Dispatch<SetStateAction<string>>;
  lobbyRules: LobbyRules;
  survivalRules: SurvivalRules;
  survivalDifficulty: number;
  survivalPlayerEstimate: number;
  launchMode: (mode: GameMode) => void;
  startTouchGameplay: () => boolean;
  closeMousePauseMenu: () => void;
  openSettings: () => void;
  copyInvite: () => void;
  joinInviteCode: () => void;
  cycleLobbyMap: StepHandler;
  adjustLobbyMaxPlayers: StepHandler;
  cycleLobbyDifficulty: StepHandler;
  cycleLobbyManaRate: StepHandler;
  adjustSurvivalMaxPlayers: StepHandler;
  cycleSurvivalDifficulty: StepHandler;
  cycleSurvivalManaRate: StepHandler;
  setLobbyRules: (updates: Partial<LobbyRules>) => void;
  setSurvivalRules: (updates: Partial<SurvivalRules>) => void;
};

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function PauseStartMenuContent({
  startMenuStage,
  setStartMenuStage,
  pauseMenuIndex,
  setPauseMenuIndex,
  canLock,
  isTouchDevice,
  isMultiplayerMode,
  currentInviteRoomCode,
  inviteCodeInput,
  inviteCodeMessage,
  setInviteCodeInput,
  setInviteCodeMessage,
  lobbyRules,
  survivalRules,
  survivalDifficulty,
  survivalPlayerEstimate,
  launchMode,
  startTouchGameplay,
  closeMousePauseMenu,
  openSettings,
  copyInvite,
  joinInviteCode,
  cycleLobbyMap,
  adjustLobbyMaxPlayers,
  cycleLobbyDifficulty,
  cycleLobbyManaRate,
  adjustSurvivalMaxPlayers,
  cycleSurvivalDifficulty,
  cycleSurvivalManaRate,
  setLobbyRules,
  setSurvivalRules,
}: PauseStartMenuContentProps) {
  const mainMenuFocus = (index: number) => pauseMenuIndex === index;

  const renderMenuButton = (index: number, label: string, hint: string, onClick: () => void) => (
    <PauseMenuButton
      key={`${startMenuStage}-${index}-${label}`}
      index={index}
      label={label}
      hint={hint}
      focused={mainMenuFocus(index)}
      onFocus={() => setPauseMenuIndex(index)}
      onSelect={onClick}
    />
  );

  const renderRuleButton = (
    index: number,
    label: string,
    value: string,
    hint: string,
    onStep: StepHandler
  ) => (
    <button
      key={`${startMenuStage}-rule-${index}-${label}`}
      type="button"
      data-menu-index={index}
      onClick={(e) => {
        e.stopPropagation();
        onStep(1);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onStep(-1);
      }}
      onMouseEnter={() => setPauseMenuIndex(index)}
      className={cn(
        "pause-rule-button grid w-full grid-cols-[minmax(100px,0.75fr)_minmax(110px,1fr)] items-center gap-3 border-2 bg-black/45 px-3 py-2 text-left transition-all hover:border-yellow-200",
        mainMenuFocus(index) ? "border-yellow-200 shadow-[0_0_18px_rgba(250,204,21,0.35)]" : "border-cyan-100/30"
      )}
    >
      <span className="pause-rule-label text-cyan-100/70">{label}</span>
      <span className="pause-rule-value font-bold text-white">{value}</span>
      <span className="pause-rule-hint col-span-2 normal-case text-cyan-100/45">{hint}</span>
    </button>
  );

  const renderInviteCodeForm = (focusIndex: number, className = "pause-invite-form flex w-full flex-col gap-1 border-2 bg-black/45 p-2 text-cyan-50") => (
    <form
      data-testid="invite-code-form"
      data-menu-index={focusIndex}
      className={cn(
        className,
        mainMenuFocus(focusIndex) ? "border-yellow-200 shadow-[0_0_18px_rgba(250,204,21,0.35)]" : "border-cyan-100/35"
      )}
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        joinInviteCode();
      }}
      onMouseEnter={() => setPauseMenuIndex(focusIndex)}
    >
      <div className="pause-invite-header flex items-center justify-between gap-2 tracking-widest text-cyan-100/80">
        <span>ROOM</span>
        <span className="normal-case text-yellow-200">{currentInviteRoomCode}</span>
      </div>
      <div className="flex flex-wrap items-stretch gap-2">
        <input
          data-testid="invite-code-input"
          aria-label="Invite code"
          value={inviteCodeInput}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="enter invite code"
          className="pause-invite-input normal-case min-w-[180px] flex-1 border-2 border-[#888] border-b-[#222] border-r-[#222] bg-[#120c16] px-3 py-2 text-white outline-none focus:border-yellow-200"
          onChange={(e) => {
            setInviteCodeInput(e.target.value);
            setInviteCodeMessage("");
          }}
          onFocus={() => setPauseMenuIndex(focusIndex)}
          onKeyDown={(e) => e.stopPropagation()}
        />
        <button
          data-testid="invite-code-submit"
          type="submit"
          className="pause-invite-submit border-2 border-[#888] border-b-[#222] border-r-[#222] bg-[#555] px-4 py-2 text-white hover:bg-[#666]"
        >
          JOIN
        </button>
      </div>
      <div className="pause-invite-message min-h-[1rem] tracking-widest text-cyan-100/60">
        {inviteCodeMessage || "TYPE THE SAME ROOM CODE ON EACH DEVICE"}
      </div>
    </form>
  );

  if (startMenuStage === "press-start") {
    return (
      <button
        type="button"
        data-menu-index={0}
        className="pointer-events-auto flex h-full w-full cursor-pointer flex-col items-center justify-center bg-[radial-gradient(circle_at_center,rgba(88,28,135,0.35),rgba(5,2,7,0.96)_62%)] text-center"
        onClick={(e) => {
          e.stopPropagation();
          setStartMenuStage("mode-select");
          setPauseMenuIndex(0);
        }}
      >
        <span className="pause-splash-title font-mono font-bold uppercase leading-[0.85] tracking-[0.1em] text-[#ffb347] drop-shadow-[4px_4px_0_theme(colors.purple.900)]">
          Wizards<br />Only<br />Fools!
        </span>
        <span className="pause-splash-prompt mt-8 animate-pulse font-mono font-bold uppercase tracking-[0.18em] text-cyan-100">
          Press Anywhere To Play
        </span>
      </button>
    );
  }

  if (startMenuStage === "mode-select") {
    return (
      <div className="pointer-events-auto flex w-[min(92cqw,620px)] flex-col items-center gap-3">
        <h1 className="pause-menu-heading text-center font-mono font-bold uppercase tracking-[0.18em] text-[#ffb347]">Choose Your Spellstorm</h1>
        {renderMenuButton(0, "Solo Survival", "Procedural world, villages every 3-4 blocks, difficulty tuned for one wizard.", () => launchMode("solo-survival"))}
        {renderMenuButton(1, "Multiplayer", "Create a custom lobby or fight survival waves with friends.", () => {
          setStartMenuStage("multiplayer-select");
          setPauseMenuIndex(0);
        })}
      </div>
    );
  }

  if (startMenuStage === "multiplayer-select") {
    return (
      <div className="pointer-events-auto flex w-[min(92cqw,640px)] flex-col items-center gap-3">
        <h1 className="pause-menu-heading text-center font-mono font-bold uppercase tracking-[0.18em] text-[#ffb347]">Multiplayer</h1>
        {renderMenuButton(0, "Custom Lobby", "Pick rules, choose a map, then share a room code.", () => {
          setStartMenuStage("custom-lobby");
          setPauseMenuIndex(0);
        })}
        {renderMenuButton(1, "Survival Multiplayer", "Procedural survival with enemy scaling based on player count.", () => {
          setStartMenuStage("survival-options");
          setPauseMenuIndex(0);
        })}
        {renderMenuButton(2, "Back", "Return to solo or multiplayer selection.", () => {
          setStartMenuStage("mode-select");
          setPauseMenuIndex(1);
        })}
      </div>
    );
  }

  if (startMenuStage === "custom-lobby") {
    return (
      <div className="pointer-events-auto flex w-[min(94cqw,760px)] flex-col items-center gap-3">
        <h1 className="pause-menu-heading text-center font-mono font-bold uppercase tracking-[0.18em] text-[#ffb347]">Custom Lobby Rules</h1>
        <div className="grid w-full gap-2 sm:grid-cols-2">
          {renderRuleButton(0, "Map", formatCharacterOption(lobbyRules.mapPreset), "Click cycles maps. Controller left/right changes selection.", cycleLobbyMap)}
          {renderRuleButton(1, "Players", `${lobbyRules.maxPlayers}`, "Maximum players allowed in this room.", adjustLobbyMaxPlayers)}
          {renderRuleButton(2, "Enemy Rules", formatCharacterOption(lobbyRules.enemyDifficulty), "Base challenge for NPC threats once combat waves are added.", cycleLobbyDifficulty)}
          {renderRuleButton(3, "Mana", formatCharacterOption(lobbyRules.manaSpawnRate), "Mana pickup pacing for the lobby.", cycleLobbyManaRate)}
          {renderMenuButton(4, `Friendly Fire: ${lobbyRules.friendlyFire ? "On" : "Off"}`, "Toggle whether wizards can hurt teammates.", () => setLobbyRules({ friendlyFire: !lobbyRules.friendlyFire }))}
          {renderInviteCodeForm(5)}
        </div>
        <div className="grid w-full gap-3 sm:grid-cols-2">
          {renderMenuButton(6, "Create Custom Lobby", "Start with these rules and this exact room code.", () => launchMode("custom-lobby"))}
          {renderMenuButton(7, "Back", "Return to multiplayer options.", () => {
            setStartMenuStage("multiplayer-select");
            setPauseMenuIndex(0);
          })}
        </div>
      </div>
    );
  }

  if (startMenuStage === "survival-options") {
    return (
      <div className="pointer-events-auto flex w-[min(94cqw,760px)] flex-col items-center gap-3">
        <h1 className="pause-menu-heading text-center font-mono font-bold uppercase tracking-[0.18em] text-[#ffb347]">Survival Multiplayer</h1>
        <p className="pause-menu-copy normal-case text-center tracking-wider text-cyan-100/65">
          Survival is procedural, so map selection is locked. Current enemy scaling preview: {survivalDifficulty}x at {survivalPlayerEstimate} player{survivalPlayerEstimate === 1 ? "" : "s"}.
        </p>
        <div className="grid w-full gap-2 sm:grid-cols-2">
          {renderRuleButton(0, "Players", `${survivalRules.maxPlayers}`, "Enemy waves scale from the active player count.", adjustSurvivalMaxPlayers)}
          {renderRuleButton(1, "Enemy Rules", formatCharacterOption(survivalRules.enemyDifficulty), "Base survival challenge before player-count scaling.", cycleSurvivalDifficulty)}
          {renderRuleButton(2, "Mana", formatCharacterOption(survivalRules.manaSpawnRate), "Mana pickup pacing for survival.", cycleSurvivalManaRate)}
          {renderMenuButton(3, `Friendly Fire: ${survivalRules.friendlyFire ? "On" : "Off"}`, "Toggle friendly fire for the survival group.", () => setSurvivalRules({ friendlyFire: !survivalRules.friendlyFire }))}
          {renderInviteCodeForm(4)}
        </div>
        <div className="grid w-full gap-3 sm:grid-cols-2">
          {renderMenuButton(5, "Create Survival Lobby", "Launch procedural survival in this room.", () => launchMode("multiplayer-survival"))}
          {renderMenuButton(6, "Back", "Return to multiplayer options.", () => {
            setStartMenuStage("multiplayer-select");
            setPauseMenuIndex(1);
          })}
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        className="pause-resume-title font-bold tracking-[0.1em] text-[#ffb347] drop-shadow-[4px_4px_0_theme(colors.purple.900)] font-mono text-center"
        style={{
          lineHeight: 0.84,
          marginBottom: "clamp(0.75rem, 4vmin, 3rem)",
        }}
      >
        WIZARDS<br />ONLY<br />FOOLS!
      </div>
      <div className="pause-action-column flex flex-col items-center pointer-events-auto">
        <div className={canLock ? "" : "cursor-not-allowed opacity-50"}>
          <div
            id="play-button"
            data-menu-index={0}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              if (!canLock) return;
              if (isTouchDevice) {
                startTouchGameplay();
                return;
              }
              closeMousePauseMenu();
            }}
            onMouseEnter={() => setPauseMenuIndex(0)}
            className={cn(
              "pause-primary-button font-bold uppercase tracking-wider shadow-[6px_6px_0_theme(colors.black)] font-mono text-center wizard-panel text-white transition-all",
              canLock ? "cursor-pointer hover:brightness-125" : "",
              mainMenuFocus(0) ? PAUSE_FOCUSED_MENU_CLASS : ""
            )}
            style={{
              pointerEvents: canLock ? "auto" : "none",
              lineHeight: 1.1,
            }}
          >
            {canLock ? (isTouchDevice ? "TAP TO PLAY" : "CLICK TO PLAY / START TO RESUME") : "PLEASE WAIT..."}
          </div>
        </div>

        {isMultiplayerMode && renderInviteCodeForm(1, "pause-invite-form flex w-[min(92vw,520px)] flex-col gap-1 border-2 bg-black/45 p-2 text-cyan-50")}

        <div className="pause-utility-row flex flex-wrap items-center justify-center gap-3">
          {isMultiplayerMode && (
            <button
              data-menu-index={2}
              onClick={(e) => {
                e.stopPropagation();
                copyInvite();
              }}
              onMouseEnter={() => setPauseMenuIndex(2)}
              className={cn(
                "pause-utility-button flex items-center gap-2 bg-[#555] border-2 border-[#888] border-b-[#222] border-r-[#222] hover:bg-[#666] text-white shadow-lg cursor-pointer transition-all",
                mainMenuFocus(2) ? PAUSE_FOCUSED_MENU_CLASS : ""
              )}
            >
              <Copy size={14} />
              <span>COPY INVITE</span>
            </button>
          )}
          <button
            data-menu-index={isMultiplayerMode ? 3 : 1}
            onClick={(e) => {
              e.stopPropagation();
              openSettings();
            }}
            onMouseEnter={() => setPauseMenuIndex(isMultiplayerMode ? 3 : 1)}
            className={cn(
              "pause-utility-button flex items-center gap-2 bg-[#555] border-2 border-[#888] border-b-[#222] border-r-[#222] hover:bg-[#666] text-white shadow-lg cursor-pointer transition-all uppercase tracking-widest font-bold",
              mainMenuFocus(isMultiplayerMode ? 3 : 1) ? PAUSE_FOCUSED_MENU_CLASS : ""
            )}
          >
            Settings
          </button>
        </div>
      </div>
    </>
  );
}
