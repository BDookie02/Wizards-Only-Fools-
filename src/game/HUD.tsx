import { lazy, memo, startTransition, Suspense, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import {
  ACID_DURATION_MS,
  ALL_SPELLS,
  ARMOR_MAX,
  ASPECT_RATIO_OPTIONS,
  HOTBAR_SIZE,
  POISON_DURATION_MS,
  RUNE_POWER_MAX,
  SLEEP_DURATION_MS,
  TUNGSTON_SLOW_DURATION_MS,
  DEFAULT_CONTROLLER_LOOK_SENSITIVITY,
  DEFAULT_MOBILE_LOOK_SENSITIVITY,
  DEFAULT_MOUSE_SENSITIVITY,
  DEFAULT_VOICE_OUTPUT_VOLUME,
  DEFAULT_VOICE_PROXIMITY_RANGE,
  DEFAULT_VOICE_PUSH_TO_TALK_KEY,
  ENEMY_DIFFICULTY_SETTINGS,
  FORCED_DAY_ELAPSED_SECONDS,
  FORCED_NIGHT_ELAPSED_SECONDS,
  LOBBY_MAP_PRESETS,
  MANA_SPAWN_RATE_SETTINGS,
  hasRunePower,
  getSurvivalDifficultyMultiplier,
  useGameStore,
  SpellType,
  HandType,
  GameMode,
  PlayerState,
  ControllerAction,
  ControllerButtonName,
  CharacterCustomization,
  DEFAULT_CHARACTER_CUSTOMIZATION,
  LobbyMessage,
  sanitizePlayerName
} from "../store/gameStore";
import { Copy } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { getSpriteUrl } from "./SpriteManifest";
import { getGamepadAxis, getPrimaryGamepad, isGamepadButtonPressed, type GamepadButtonName } from "./controllerInput";
import {
  clearNavigationRecordings,
  exportNavigationRecording,
  getNavigationRecorderStatus,
  startNavigationRecording,
  stopNavigationRecording,
} from "./navigationRecorder";
import { socket } from "../lib/socket";
import { drawPixelAvatarFrame } from "./PixelAvatar";
import { isMobileLikeDevice } from "./performanceMode";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const LazyMagicHands = lazy(() => import("./MagicHands").then((module) => ({ default: module.MagicHands })));

function getPlatformDefaultLookSensitivity() {
  return isMobileLikeDevice() ? DEFAULT_MOBILE_LOOK_SENSITIVITY : DEFAULT_MOUSE_SENSITIVITY;
}

function isTouchGameplayDevice() {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;

  const userAgent = navigator.userAgent || "";
  const platform = navigator.platform || "";
  const maxTouchPoints = navigator.maxTouchPoints || 0;
  const iosLike = /iPad|iPhone|iPod/.test(userAgent) || (platform === "MacIntel" && maxTouchPoints > 1);
  const androidLike = /Android/i.test(userAgent);
  const mobileUserAgent = /Android|Mobile|Tablet|iPhone|iPad|iPod/i.test(userAgent);
  const desktopUserAgent = /Windows NT|Macintosh|X11|Linux x86_64/i.test(userAgent);
  const coarsePointer = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  const noHover = window.matchMedia?.("(hover: none)").matches ?? false;

  if (iosLike || androidLike) return true;
  if (desktopUserAgent) return false;

  return mobileUserAgent && coarsePointer && noHover;
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  return tagName === "input" || tagName === "textarea" || tagName === "select" || target.isContentEditable;
}

const spellColors: Record<SpellType, string> = {
  fireball: "text-orange-500",
  iceshard: "text-cyan-400",
  arcanebeam: "text-fuchsia-500",
  healspell: "text-emerald-400",
  icespell: "text-blue-300",
  ringsofpower: "text-purple-400",
  lightning: "text-blue-200",
  smokebomb: "text-gray-400",
  portal: "text-indigo-400",
  blink: "text-teal-300",
  grab: "text-pink-300",
  tornado: "text-gray-300",
  meteorshower: "text-orange-300",
  flamethrower: "text-red-500",
  discshield: "text-purple-500",
  orbshield: "text-pink-500",
  kunai: "text-gray-200",
  healingcrystals: "text-green-300",
  magicarmor: "text-sky-300",
  jumpboost: "text-lime-300",
  speedboost: "text-yellow-300",
  tungstonballsack: "text-slate-300",
  sleep: "text-sky-200",
  poison: "text-purple-300",
  acid: "text-green-300",
  magicglassorb: "text-cyan-100"
};

const spellNames: Record<SpellType, string> = {
  fireball: "Fireball",
  iceshard: "Biden Blast",
  arcanebeam: "Hands",
  healspell: "Heal",
  icespell: "Plasma Flash",
  ringsofpower: "Rings of Power",
  lightning: "Chidori",
  smokebomb: "Smoke Bomb",
  portal: "Portal",
  blink: "Blink",
  grab: "Grab",
  tornado: "Tornado",
  meteorshower: "Meteor Shower",
  flamethrower: "Flamethrower",
  discshield: "Disc Shield",
  orbshield: "Orb Shield",
  kunai: "Kunai",
  healingcrystals: "Healing Crystals",
  magicarmor: "Magic Armor",
  jumpboost: "Up and Over!",
  speedboost: "Speed Boost",
  tungstonballsack: "Tungston Ballsack",
  sleep: "Sleep",
  poison: "Poison",
  acid: "Acid",
  magicglassorb: "Magic Glass Orb"
};

const spellThumbnails: Partial<Record<SpellType, string>> = {
  fireball: "/sprites/fireball/fireball_1.png",
  iceshard: "/sprites/iceshard/spells_1.png",
  arcanebeam: "/sprites/misc/idle_1.png",
  healspell: "/sprites/healspell/healspell_1.png",
  icespell: "/sprites/icespell/icespell_1.png",
  ringsofpower: "/sprites/ringsofpower/ringsofpower_1.png",
  lightning: "/sprites/lightning/lightning_1.png",
  smokebomb: "/sprites/misc/smoke_bomb.gif",
  portal: "/sprites/misc/portal.gif",
  blink: "/sprites/misc/blink.gif",
  flamethrower: "/sprites/fireball/castfireball_1.png",
  discshield: "/sprites/shields/disc_shield.png",
  orbshield: "/sprites/shields/orb_shield.png",
  kunai: "/sprites/misc/kunai.gif",
  healingcrystals: "/sprites/misc/healing_gems.gif",
};

const hotkeyLabels = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
const aspectRatioOptions = ASPECT_RATIO_OPTIONS;
const pauseMenuItemCount = 4;
const settingsTabCount = 4;
const videoAspectStartIndex = settingsTabCount;
const videoBackIndex = videoAspectStartIndex + aspectRatioOptions.length;
const settingsVideoActionCount = videoBackIndex + 1;

type SettingsPane = "video" | "keybinds" | "voice" | "character";
type StartMenuStage = "press-start" | "mode-select" | "multiplayer-select" | "custom-lobby" | "survival-options" | "resume";
type GameplayInputMode = "mouse" | "touch" | "controller";
const settingsPaneOrder: SettingsPane[] = ["video", "keybinds", "voice", "character"];

type ScoreboardRow = {
  id: string;
  label: string;
  status: string;
  health: number;
  armor: number;
  score: number;
  isLocal?: boolean;
};

function LobbyChatBox({ messages }: { messages: LobbyMessage[] }) {
  const visibleMessages = messages.slice(-5);
  if (visibleMessages.length === 0) return null;

  return (
    <div
      data-testid="lobby-chat-box"
      className="lobby-notification-feed pointer-events-none absolute z-[90] flex w-[min(330px,calc(100cqw-24px))] flex-col gap-1 font-mono"
    >
      {visibleMessages.map((message) => (
        <div
          key={message.id}
          className={cn(
            "normal-case text-[10px] leading-4 tracking-wider drop-shadow-[2px_2px_0_rgba(0,0,0,0.95)]",
            message.tone === "join" && "text-emerald-100",
            message.tone === "death" && "text-red-100",
            message.tone === "system" && "text-cyan-50"
          )}
        >
          {message.text}
        </div>
      ))}
    </div>
  );
}

function CommandConsole({
  value,
  isVClipEnabled,
  onChange,
  onClose,
  onSubmit,
}: {
  value: string;
  isVClipEnabled: boolean;
  onChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const input = inputRef.current;
    input?.focus();
    input?.setSelectionRange(input.value.length, input.value.length);
  }, []);

  return createPortal(
    <div
      data-testid="command-console"
      className="fixed left-1/2 top-4 z-[235] w-[min(680px,calc(100dvw-24px))] -translate-x-1/2 border-2 border-cyan-200/70 bg-[#050711]/92 p-2 font-mono text-cyan-50 shadow-[0_0_30px_rgba(34,211,238,0.32)] pointer-events-auto"
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      <div className="mb-1 flex items-center justify-between gap-3 text-[9px] uppercase tracking-[0.22em] text-cyan-100/70">
        <span>Chat Console</span>
        <span className={isVClipEnabled ? "text-emerald-200" : "text-slate-400"}>
          VCLIP {isVClipEnabled ? "ON" : "OFF"}
        </span>
      </div>
      <input
        ref={inputRef}
        aria-label="Chat command console"
        autoCapitalize="off"
        autoCorrect="off"
        autoFocus
        spellCheck={false}
        maxLength={90}
        value={value}
        className="normal-case w-full border border-cyan-300/55 bg-black/80 px-3 py-2 text-[13px] tracking-wide text-cyan-50 outline-none placeholder:text-cyan-100/35 focus:border-yellow-200"
        placeholder="/navrecord start"
        onChange={(e) => onChange(e.currentTarget.value)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") {
            e.preventDefault();
            onSubmit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            onClose();
          }
        }}
      />
      <div className="mt-1 text-[8px] uppercase tracking-[0.18em] text-cyan-100/45">
        Try /day, /night, /night off, /vclip on, or /navrecord start
      </div>
    </div>,
    document.body
  );
}

function PlayerNamePrompt({
  value,
  onChange,
  onSubmit,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
}) {
  const cleaned = sanitizePlayerName(value);
  const canSubmit = cleaned.length >= 2;

  return createPortal(
    <div
      data-testid="player-name-prompt"
      className="fixed inset-0 z-[240] flex items-center justify-center bg-[#050207]/92 px-4 font-mono text-white pointer-events-auto"
      style={{ width: "var(--app-vw, 100dvw)", height: "var(--app-vh, 100dvh)" }}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      <form
        className="w-[min(520px,calc(100vw-28px))] border-2 border-purple-300/70 bg-[#100718]/95 p-4 shadow-[0_0_40px_rgba(168,85,247,0.35)]"
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (canSubmit) onSubmit();
        }}
      >
        <div className="text-center text-[clamp(1rem,4vmin,1.65rem)] tracking-[0.18em] text-yellow-200">
          Name Your Wizard
        </div>
        <div className="mt-3 text-center text-[10px] leading-5 tracking-widest text-purple-100/75">
          This is what other players will see when you join the lobby and when you get defeated.
        </div>
        <input
          autoFocus
          aria-label="Player name"
          value={value}
          maxLength={18}
          autoCapitalize="words"
          autoCorrect="off"
          spellCheck={false}
          placeholder="enter wizard name"
          className="normal-case mt-4 w-full border-2 border-[#888] border-b-[#222] border-r-[#222] bg-black px-3 py-3 text-center text-[clamp(0.9rem,3vmin,1.3rem)] text-white outline-none focus:border-yellow-200"
          onChange={(e) => onChange(sanitizePlayerName(e.target.value))}
          onKeyDown={(e) => e.stopPropagation()}
        />
        <div className="mt-2 min-h-[1rem] text-center text-[9px] tracking-widest text-cyan-100/55">
          Letters, numbers, spaces, underscores, and hyphens. 2-18 characters.
        </div>
        <button
          type="submit"
          disabled={!canSubmit}
          className={cn(
            "mt-4 w-full border-2 px-4 py-3 text-[clamp(0.78rem,2.3vmin,1rem)] tracking-widest transition-all",
            canSubmit
              ? "border-yellow-200 bg-yellow-300/15 text-yellow-100 hover:bg-yellow-300/25"
              : "cursor-not-allowed border-gray-600 bg-gray-900 text-gray-500"
          )}
        >
          Join Lobby
        </button>
      </form>
    </div>,
    document.body
  );
}

function sanitizeInviteRoomCode(value: string) {
  return value
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, 64);
}

function extractInviteRoomCode(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";

  try {
    const url = new URL(trimmed, window.location.origin);
    const room = url.searchParams.get("room");
    if (room) return sanitizeInviteRoomCode(room);
  } catch {
    // Treat non-URL input as a raw room code below.
  }

  const roomParamMatch = trimmed.match(/[?&]room=([^&\s]+)/i);
  if (roomParamMatch?.[1]) {
    return sanitizeInviteRoomCode(decodeURIComponent(roomParamMatch[1]));
  }

  return sanitizeInviteRoomCode(trimmed);
}

function getCurrentInviteRoomCode() {
  if (typeof window === "undefined") return "lobby";
  return sanitizeInviteRoomCode(new URL(window.location.href).searchParams.get("room") || "lobby");
}

type LanInfoResponse = {
  lanAddresses?: string[];
  httpPort?: number;
  httpsPort?: number | null;
  secure?: boolean;
};

const controllerButtonLabels: Record<ControllerButtonName, string> = {
  a: "A",
  b: "B",
  x: "X",
  y: "Y",
  leftBumper: "LB",
  rightBumper: "RB",
  leftTrigger: "LT",
  rightTrigger: "RT",
  back: "Select",
  start: "Start",
  leftStick: "Left Stick",
  rightStick: "Right Stick",
  dpadUp: "D-Pad Up",
  dpadDown: "D-Pad Down",
  dpadLeft: "D-Pad Left",
  dpadRight: "D-Pad Right",
};

const controllerButtonOptions = Object.keys(controllerButtonLabels) as ControllerButtonName[];

const controllerActionRows: { action: ControllerAction; label: string; hint: string }[] = [
  { action: "leftCast", label: "Left Cast", hint: "fires left hand" },
  { action: "rightCast", label: "Right Cast", hint: "fires right hand" },
  { action: "jump", label: "Jump / Thruster", hint: "jump and air boost" },
  { action: "slide", label: "Slide", hint: "hold to slide" },
  { action: "sprint", label: "Sprint Toggle", hint: "click once while moving" },
  { action: "spellMenu", label: "Spell Book", hint: "open spell menu" },
  { action: "map", label: "Map", hint: "toggle minimap" },
  { action: "scoreboard", label: "Player List", hint: "hold to view score" },
  { action: "pause", label: "Pause / Resume", hint: "pause menu" },
  { action: "menuSelect", label: "Menu Select", hint: "confirm highlighted option" },
  { action: "menuBack", label: "Menu Back", hint: "exit/back from menus" },
  { action: "leftHotbar", label: "Left Hotbar", hint: "tap next, D-pad changes direction" },
  { action: "rightHotbar", label: "Right Hotbar", hint: "tap next, D-pad changes direction" },
  { action: "voicePushToTalk", label: "Voice Push-To-Talk", hint: "hold to talk when voice is press-to-talk" },
];

const keybindSensitivityStartIndex = settingsTabCount;
const keybindArrowLookIndex = keybindSensitivityStartIndex + 2;
const keybindControlStartIndex = keybindSensitivityStartIndex + 3;
const keybindBackIndex = keybindControlStartIndex + controllerActionRows.length;
const settingsKeybindActionCount = keybindBackIndex + 1;

const voiceSettingsStartIndex = settingsTabCount;
const voiceEnabledIndex = voiceSettingsStartIndex;
const voiceInputModeIndex = voiceSettingsStartIndex + 1;
const voicePushToTalkKeyIndex = voiceSettingsStartIndex + 2;
const voiceOutputVolumeIndex = voiceSettingsStartIndex + 3;
const voiceProximityRangeIndex = voiceSettingsStartIndex + 4;
const voiceBackIndex = voiceSettingsStartIndex + 5;
const settingsVoiceActionCount = voiceBackIndex + 1;

const characterColorRows: { key: keyof CharacterCustomization; label: string; hint: string }[] = [
  { key: "skinColor", label: "Skin", hint: "base body color" },
  { key: "topColor", label: "Top", hint: "shirt / robe color" },
  { key: "pantsColor", label: "Pants", hint: "legs color" },
  { key: "shoesColor", label: "Shoes", hint: "feet color" },
  { key: "hatColor", label: "Hat", hint: "hat color" },
  { key: "hairColor", label: "Hair", hint: "head hair color" },
  { key: "facialHairColor", label: "Facial Hair", hint: "beard / mustache color" },
];

const characterStyleRows: {
  key: keyof CharacterCustomization;
  label: string;
  options: string[];
}[] = [
  { key: "topStyle", label: "Top Style", options: ["simple", "robe", "vest", "tunic"] },
  { key: "pantsStyle", label: "Pants Style", options: ["pants", "shorts", "skirt", "robe"] },
  { key: "shoesStyle", label: "Shoes", options: ["boots", "shoes", "sandals", "barefoot"] },
  { key: "hatStyle", label: "Hat", options: ["none", "wizard", "floppy-wizard", "cap", "hood", "pharaoh"] },
  { key: "hairStyle", label: "Hair", options: ["none", "short", "bob", "spikes", "long"] },
  { key: "facialHairStyle", label: "Facial Hair", options: ["none", "mustache", "goatee", "beard"] },
  { key: "eyeStyle", label: "Eyes", options: ["calm", "angry", "content", "dull", "sus", "sus-shadow", "terrified", "sad", "hard-shut", "done", "happy", "nervous", "nervous-teary"] },
];

const characterMouthRows: {
  key: keyof CharacterCustomization;
  label: string;
  options: string[];
}[] = [
  { key: "mouthStyle", label: "Mouth Shape", options: ["neutral", "smile", "frown", "open"] },
];

const characterColorPresets = [
  "#d6cf91",
  "#8d5524",
  "#c68642",
  "#f1c27d",
  "#ffdbac",
  "#f472b6",
  "#60a5fa",
  "#22c55e",
  "#facc15",
  "#f8fafc",
];
const characterColorStartIndex = settingsTabCount;
const characterStyleStartIndex = characterColorStartIndex + characterColorRows.length;
const characterMouthStartIndex = characterStyleStartIndex + characterStyleRows.length;
const characterBackIndex = characterMouthStartIndex + characterMouthRows.length;
const settingsCharacterActionCount = characterBackIndex + 1;

const keyboardKeybindRows = [
  {
    title: "Keyboard",
    rows: [
      ["Move", "W A S D"],
      ["Look", "Mouse / optional arrow keys"],
      ["Left Cast", "Mouse 1"],
      ["Right Cast", "Mouse 2 or hold Q + Mouse 1"],
      ["Spell Book", "E"],
      ["Map", "M"],
      ["Player List", "Tab"],
      ["Hotbar", "1-0, hold Q for right hand"],
      ["Voice Push-To-Talk", "V by default"],
      ["Jump / Thruster", "Space"],
      ["Sprint", "Shift"],
      ["Slide", "C"],
    ],
  }
];

function getNumberSlot(code: string) {
  if (code === "Digit0") return 9;
  const match = code.match(/^Digit([1-9])$/);
  return match ? Number(match[1]) - 1 : -1;
}

function canRequestPointerLockHere() {
  try {
    if (window.self === window.top) return true;

    const frame = window.frameElement as HTMLIFrameElement | null;
    const allow = frame?.allow ?? "";
    return /\bpointer-lock\b/i.test(allow);
  } catch {
    return false;
  }
}

function getFullscreenElement() {
  const webkitDocument = document as Document & { webkitFullscreenElement?: Element | null };
  return document.fullscreenElement ?? webkitDocument.webkitFullscreenElement ?? null;
}

function isStandaloneDisplayMode() {
  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
  return (
    navigatorWithStandalone.standalone === true ||
    window.matchMedia?.("(display-mode: fullscreen)").matches ||
    window.matchMedia?.("(display-mode: standalone)").matches
  );
}

function isPointerLockSecurityError(reason: unknown) {
  if (!reason) return false;

  const message = typeof reason === "string"
    ? reason
    : reason instanceof Error
      ? `${reason.name}: ${reason.message}`
      : String(reason);

  return /pointer lock|pointerlock/i.test(message);
}

function wrapIndex(index: number, count: number) {
  if (count <= 0) return 0;
  return ((index % count) + count) % count;
}

function getRemotePlayerStatus(player: PlayerState, now: number) {
  if (player.health <= 0) return "DOWN";
  const statuses = [
    player.sleepUntil && player.sleepUntil > now ? "SLEEP" : "",
    player.slowUntil && player.slowUntil > now ? "SLOWED" : "",
    player.poisonUntil && player.poisonUntil > now ? "POISON" : "",
    player.acidUntil && player.acidUntil > now ? "ACID" : "",
  ].filter(Boolean);
  return statuses.length > 0 ? statuses.join(" / ") : "READY";
}

function normalizeHexInput(value: string) {
  const trimmed = value.trim();
  return trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
}

function isValidHexColor(value: string) {
  return /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim());
}

function cycleOption(options: string[], current: string, direction: 1 | -1) {
  const index = Math.max(0, options.indexOf(current));
  return options[wrapIndex(index + direction, options.length)];
}

function formatCharacterOption(value: string) {
  return value
    .split(/(?=[A-Z])|[-_\s]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function formatKeyboardCode(code: string) {
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  if (code === "Space") return "Space";
  if (code === "Escape") return "Escape";
  return code
    .replace(/(Left|Right)$/, " $1")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim();
}

function CharacterPreview({ character }: { character: CharacterCustomization }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [frame, setFrame] = useState(0);
  const [isBlinking, setIsBlinking] = useState(false);

  useEffect(() => {
    const interval = window.setInterval(() => setFrame((current) => (current + 1) % 24), 160);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let blinkStartTimeout: number | null = null;
    let blinkEndTimeout: number | null = null;
    const scheduleBlink = () => {
      blinkStartTimeout = window.setTimeout(() => {
        if (cancelled) return;
        setIsBlinking(true);
        blinkEndTimeout = window.setTimeout(() => {
          if (cancelled) return;
          setIsBlinking(false);
          scheduleBlink();
        }, 95 + Math.random() * 70);
      }, 2400 + Math.random() * 5200);
    };

    scheduleBlink();
    return () => {
      cancelled = true;
      if (blinkStartTimeout !== null) window.clearTimeout(blinkStartTimeout);
      if (blinkEndTimeout !== null) window.clearTimeout(blinkEndTimeout);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const previewWidth = 360;
    const previewHeight = 360;
    const previewResolutionScale = 2;
    canvas.width = previewWidth * previewResolutionScale;
    canvas.height = previewHeight * previewResolutionScale;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(previewResolutionScale, 0, 0, previewResolutionScale, 0, 0);
    ctx.clearRect(0, 0, previewWidth, previewHeight);
    ctx.fillStyle = "rgba(12, 7, 18, 0.92)";
    ctx.fillRect(0, 0, previewWidth, previewHeight);

    ctx.fillStyle = "rgba(34, 211, 238, 0.06)";
    for (let x = 0; x < previewWidth; x += 18) {
      ctx.fillRect(x, 0, 1, previewHeight);
    }
    for (let y = 0; y < previewHeight; y += 18) {
      ctx.fillRect(0, y, previewWidth, 1);
    }

    const glow = ctx.createRadialGradient(180, 188, 18, 180, 188, 150);
    glow.addColorStop(0, "rgba(250, 204, 21, 0.22)");
    glow.addColorStop(0.42, "rgba(236, 72, 153, 0.12)");
    glow.addColorStop(1, "rgba(12, 7, 18, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, previewWidth, previewHeight);

    ctx.strokeStyle = "rgba(250, 204, 21, 0.28)";
    ctx.lineWidth = 3;
    ctx.strokeRect(39, 34, 282, 292);
    ctx.strokeStyle = "rgba(34, 211, 238, 0.18)";
    ctx.lineWidth = 1;
    ctx.strokeRect(51, 46, 258, 268);

    ctx.fillStyle = "rgba(250, 204, 21, 0.9)";
    ctx.font = "13px monospace";
    ctx.fillText("LIVE CHARACTER VIEW", 84, 24);

    const animation = frame % 12 < 6 ? "holding" : "walk";
    drawPixelAvatarFrame(ctx, {
      character,
      direction: 0,
      animation,
      frame,
      x: 52,
      y: 62,
      scale: 2,
      detailScale: 2,
      isBlinking,
    });

    ctx.fillStyle = "rgba(240, 249, 255, 0.78)";
    ctx.font = "10px monospace";
    ctx.fillText("FRONT PREVIEW UPDATES LIVE", 90, 342);
  }, [character, frame, isBlinking]);

  return (
    <canvas
      ref={canvasRef}
      className="character-preview-canvas h-auto w-full border border-yellow-200/30 bg-black shadow-[0_0_18px_rgba(250,204,21,0.16)]"
      style={{ imageRendering: "pixelated" }}
    />
  );
}

function PlayerScoreMenu({ rows }: { rows: ScoreboardRow[] }) {
  return (
    <div className="player-score-menu absolute inset-0 z-[160] flex items-start justify-center px-4 pt-[8dvh] pointer-events-none">
      <div
        className="player-score-panel border border-cyan-200/60 bg-[#090510]/78 p-3 text-cyan-50 shadow-[0_0_35px_rgba(34,211,238,0.38)] backdrop-blur-sm"
        style={{ width: 'min(760px, calc(var(--app-vw, 100dvw) - 28px))' }}
      >
        <div className="player-score-header mb-3 flex items-center justify-between border-b border-cyan-200/30 pb-2">
          <div>
            <div className="text-[9px] tracking-[0.35em] text-cyan-200/70">ARENA ROSTER</div>
            <div className="text-xl tracking-[0.16em] text-white">PLAYER LIST / SCORE</div>
          </div>
          <div className="text-right text-[8px] tracking-widest text-cyan-100/55">
            HOLD TAB / SELECT
          </div>
        </div>

        <div className="player-score-row player-score-headings grid grid-cols-[1.35fr_1fr_0.55fr_0.65fr_0.6fr] gap-2 border-b border-cyan-200/25 pb-1 text-[8px] tracking-[0.18em] text-cyan-100/55">
          <span>PLAYER</span>
          <span>STATE</span>
          <span className="text-right">HP</span>
          <span className="text-right">ARMOR</span>
          <span className="text-right">SCORE</span>
        </div>

        <div className="mt-1 flex flex-col gap-1">
          {rows.map((row) => (
            <div
              key={row.id}
              className={cn(
                "player-score-row grid grid-cols-[1.35fr_1fr_0.55fr_0.65fr_0.6fr] gap-2 border px-2 py-1.5 text-[10px] tracking-widest",
                row.isLocal
                  ? "border-yellow-200/55 bg-yellow-200/10 text-yellow-50 shadow-[0_0_14px_rgba(250,204,21,0.18)]"
                  : "border-cyan-200/20 bg-cyan-400/5 text-cyan-100/85"
              )}
            >
              <span className="truncate">{row.label}</span>
              <span className="truncate">{row.status}</span>
              <span className="text-right">{Math.round(row.health)}</span>
              <span className="text-right">{Math.round(row.armor)}</span>
              <span className="text-right">{row.score}</span>
            </div>
          ))}
        </div>

        <div className="mt-3 border-t border-cyan-200/20 pt-2 text-[8px] tracking-widest text-cyan-100/45">
          SCORE IS CURRENT BATTLE POWER UNTIL KILL TRACKING IS ADDED
        </div>
      </div>
    </div>
  );
}

function getSpellThumbnail(spell: SpellType) {
  const thumbnail = spellThumbnails[spell] ?? "/sprites/fireball/fireball_1.png";
  return getSpriteUrl(thumbnail) || thumbnail;
}

function isAnimatedThumbnailSource(src: string) {
  return /\.gif(?:[?#]|$)/i.test(src);
}

const SpellThumbnail = memo(function SpellThumbnail({
  spell,
  animate = false,
  deferRank = 0,
}: {
  spell: SpellType;
  animate?: boolean;
  deferRank?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [src, setSrc] = useState(() => getSpellThumbnail(spell));
  const [imageFrameVersion, setImageFrameVersion] = useState(0);

  useEffect(() => {
    setSrc(getSpellThumbnail(spell));
  }, [spell]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const outputSize = 64;
    const sampleSize = 36;
    const sampleCanvas = document.createElement("canvas");
    const sampleCtx = sampleCanvas.getContext("2d", { willReadFrequently: true });
    if (!sampleCtx) return;

    canvas.width = outputSize;
    canvas.height = outputSize;
    sampleCanvas.width = sampleSize;
    sampleCanvas.height = sampleSize;
    ctx.imageSmoothingEnabled = false;
    sampleCtx.imageSmoothingEnabled = false;

    const drawPixelBlocks = (blocks: Array<[number, number, number, number, string, number?]>) => {
      blocks.forEach(([x, y, width, height, color, rotation = 0]) => {
        ctx.save();
        ctx.fillStyle = color;
        if (rotation) {
          ctx.translate(x + width / 2, y + height / 2);
          ctx.rotate((rotation * Math.PI) / 180);
          ctx.fillRect(-width / 2, -height / 2, width, height);
        } else {
          ctx.fillRect(x, y, width, height);
        }
        ctx.restore();
      });
    };

    const drawOrbShieldHex = () => {
      ctx.clearRect(0, 0, outputSize, outputSize);
      ctx.fillStyle = "rgba(217, 70, 239, 0.18)";
      ctx.beginPath();
      ctx.arc(outputSize / 2, outputSize / 2, 25, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(253, 244, 255, 0.82)";
      ctx.lineWidth = 2;

      const radius = 7;
      const height = Math.sqrt(3) * radius;
      for (let y = 9; y < outputSize - 5; y += height * 0.75) {
        const rowOffset = Math.round(y / (height * 0.75)) % 2 === 0 ? 0 : radius * 1.5;
        for (let x = 7 + rowOffset; x < outputSize - 5; x += radius * 3) {
          const dx = x - outputSize / 2;
          const dy = y - outputSize / 2;
          if (Math.sqrt(dx * dx + dy * dy) > 27) continue;

          ctx.beginPath();
          for (let i = 0; i < 6; i++) {
            const angle = Math.PI / 6 + (Math.PI / 3) * i;
            const px = x + Math.cos(angle) * radius;
            const py = y + Math.sin(angle) * radius;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.stroke();
        }
      }

      ctx.strokeStyle = "rgba(244, 114, 182, 0.95)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(outputSize / 2, outputSize / 2, 27, 0, Math.PI * 2);
      ctx.stroke();
    };

    const drawGrabThumbnail = () => {
      ctx.clearRect(0, 0, outputSize, outputSize);
      const glow = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
      glow.addColorStop(0, "rgba(255, 244, 255, 0.95)");
      glow.addColorStop(0.35, "rgba(244, 114, 182, 0.72)");
      glow.addColorStop(1, "rgba(126, 34, 206, 0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, outputSize, outputSize);

      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "rgba(244, 114, 182, 0.5)";
      ctx.lineWidth = 15;
      ctx.beginPath();
      ctx.moveTo(8, 44);
      ctx.bezierCurveTo(18, 35, 24, 28, 36, 24);
      ctx.stroke();

      ctx.strokeStyle = "rgba(255, 214, 251, 0.95)";
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(8, 44);
      ctx.bezierCurveTo(20, 36, 25, 29, 38, 24);
      ctx.stroke();

      ctx.fillStyle = "rgba(244, 114, 182, 0.72)";
      ctx.beginPath();
      ctx.ellipse(42, 24, 10, 12, -0.4, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "rgba(255, 214, 251, 0.9)";
      ctx.lineWidth = 5;
      [[45, 12, 56, 7], [51, 20, 62, 18], [50, 28, 60, 32], [43, 34, 49, 45], [35, 19, 29, 8]].forEach(([x1, y1, x2, y2]) => {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      });

      ctx.strokeStyle = "rgba(244, 114, 182, 0.5)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(34, 31, 25, 0.2, Math.PI * 1.6);
      ctx.stroke();
    };

    const drawTornadoThumbnail = () => {
      ctx.clearRect(0, 0, outputSize, outputSize);
      drawPixelBlocks([
        [12, 6, 40, 4, "rgba(209, 213, 219, 0.18)"],
        [7, 18, 52, 8, "rgba(156, 163, 175, 0.14)"],
        [10, 31, 46, 8, "rgba(75, 85, 99, 0.2)"],
        [16, 46, 32, 6, "rgba(248, 250, 252, 0.14)"],
        [20, 7, 22, 4, "#f8fafc"],
        [10, 11, 46, 4, "#9ca3af"],
        [16, 15, 24, 4, "#e5e7eb"],
        [42, 15, 12, 4, "#4b5563"],
        [8, 22, 18, 5, "#4b5563"],
        [26, 22, 30, 5, "#d1d5db"],
        [15, 28, 38, 5, "#f3f4f6"],
        [11, 34, 18, 5, "#9ca3af"],
        [31, 34, 20, 5, "#374151"],
        [15, 40, 38, 5, "#6b7280"],
        [22, 46, 26, 5, "#d1d5db"],
        [26, 52, 18, 5, "#9ca3af"],
        [30, 58, 10, 4, "#f8fafc"],
        [4, 16, 4, 4, "rgba(229, 231, 235, 0.75)"],
        [56, 25, 4, 4, "rgba(156, 163, 175, 0.75)"],
        [7, 52, 4, 4, "rgba(107, 114, 128, 0.62)"],
        [52, 54, 5, 5, "rgba(161, 98, 7, 0.55)"],
        [3, 24, 13, 3, "rgba(248, 250, 252, 0.72)", -14],
        [45, 27, 15, 3, "rgba(209, 213, 219, 0.68)", 16],
        [5, 40, 15, 3, "rgba(156, 163, 175, 0.64)", 18],
        [43, 43, 13, 3, "rgba(229, 231, 235, 0.62)", -16],
        [12, 55, 10, 3, "rgba(75, 85, 99, 0.58)", -12],
        [55, 8, 3, 3, "rgba(248, 250, 252, 0.8)"],
        [2, 36, 3, 3, "rgba(156, 163, 175, 0.72)"],
        [57, 50, 3, 3, "rgba(107, 114, 128, 0.7)"],
      ]);
    };

    const drawMeteorThumbnail = () => {
      ctx.clearRect(0, 0, outputSize, outputSize);
      drawPixelBlocks([
        [22, 9, 20, 5, "rgba(254, 215, 170, 0.22)"],
        [17, 16, 30, 8, "rgba(251, 146, 60, 0.22)"],
        [12, 25, 40, 12, "rgba(239, 68, 68, 0.2)"],
        [17, 39, 30, 10, "rgba(250, 204, 21, 0.16)"],
        [22, 10, 20, 5, "#fed7aa"],
        [17, 15, 30, 7, "#fb923c"],
        [13, 22, 38, 10, "#ef4444"],
        [11, 32, 42, 13, "#f97316"],
        [16, 45, 32, 10, "#b91c1c"],
        [23, 55, 18, 5, "#fb923c"],
        [23, 17, 18, 6, "#fff7ed"],
        [18, 25, 28, 10, "#fde68a"],
        [22, 35, 20, 10, "#facc15"],
        [28, 45, 10, 7, "#fffbeb"],
        [28, 28, 10, 7, "#7c2d12"],
        [40, 31, 9, 7, "#9a3412"],
        [18, 36, 9, 8, "#c2410c"],
        [35, 41, 11, 8, "#ea580c"],
        [7, 20, 3, 3, "rgba(255, 247, 237, 0.74)"],
        [54, 24, 4, 4, "rgba(254, 215, 170, 0.66)"],
        [8, 50, 3, 3, "rgba(249, 115, 22, 0.68)"],
        [54, 51, 3, 3, "rgba(254, 243, 199, 0.68)"],
      ]);
    };

    const drawMagicArmorThumbnail = () => {
      ctx.clearRect(0, 0, outputSize, outputSize);
      const glow = ctx.createRadialGradient(32, 32, 4, 32, 32, 31);
      glow.addColorStop(0, "rgba(224, 242, 254, 0.85)");
      glow.addColorStop(0.45, "rgba(56, 189, 248, 0.36)");
      glow.addColorStop(1, "rgba(14, 116, 144, 0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, outputSize, outputSize);
      drawPixelBlocks([
        [25, 7, 14, 5, "#e0f2fe"],
        [18, 12, 28, 6, "#7dd3fc"],
        [14, 18, 36, 10, "#38bdf8"],
        [14, 28, 36, 9, "#0284c7"],
        [18, 37, 28, 8, "#0369a1"],
        [22, 45, 20, 7, "#0c4a6e"],
        [27, 52, 10, 5, "#bae6fd"],
        [22, 20, 20, 4, "rgba(255,255,255,0.8)"],
        [27, 28, 10, 18, "rgba(224,242,254,0.45)"],
        [10, 11, 4, 4, "rgba(125,211,252,0.8)"],
        [50, 20, 4, 4, "rgba(186,230,253,0.72)"],
        [9, 47, 5, 5, "rgba(56,189,248,0.6)"],
      ]);
    };

    const drawJumpBoostThumbnail = () => {
      ctx.clearRect(0, 0, outputSize, outputSize);
      drawPixelBlocks([
        [29, 7, 6, 40, "rgba(190, 242, 100, 0.26)"],
        [21, 14, 22, 7, "#bef264"],
        [16, 21, 32, 7, "#84cc16"],
        [24, 28, 16, 19, "#22c55e"],
        [20, 47, 24, 6, "#14532d"],
        [14, 53, 12, 5, "#a3e635"],
        [38, 53, 12, 5, "#a3e635"],
        [8, 35, 7, 7, "rgba(34,197,94,0.78)"],
        [49, 32, 7, 7, "rgba(190,242,100,0.78)"],
        [27, 3, 10, 5, "#f7fee7"],
      ]);
    };

    const drawSpeedBoostThumbnail = () => {
      ctx.clearRect(0, 0, outputSize, outputSize);
      drawPixelBlocks([
        [7, 14, 34, 5, "#fef08a", -8],
        [19, 22, 38, 6, "#facc15", -8],
        [11, 32, 44, 7, "#22d3ee", -8],
        [25, 42, 28, 5, "#fde047", -8],
        [6, 49, 24, 4, "rgba(14,165,233,0.82)", -8],
        [45, 10, 7, 7, "#fefce8"],
        [51, 27, 5, 5, "#fef08a"],
        [54, 39, 4, 4, "#67e8f9"],
        [11, 24, 5, 5, "rgba(253,224,71,0.78)"],
      ]);
    };

    const drawStatusBoltThumbnail = (variant: "tungston" | "sleep" | "poison" | "acid") => {
      ctx.clearRect(0, 0, outputSize, outputSize);
      const palette = {
        tungston: ["#e2e8f0", "#94a3b8", "#475569", "rgba(148,163,184,0.26)"],
        sleep: ["#e0f2fe", "#60a5fa", "#1d4ed8", "rgba(125,211,252,0.26)"],
        poison: ["#f0abfc", "#a855f7", "#581c87", "rgba(168,85,247,0.26)"],
        acid: ["#bbf7d0", "#22c55e", "#166534", "rgba(34,197,94,0.26)"],
      }[variant];
      const glow = ctx.createRadialGradient(32, 32, 3, 32, 32, 31);
      glow.addColorStop(0, palette[0]);
      glow.addColorStop(0.42, palette[3]);
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, outputSize, outputSize);

      if (variant === "tungston") {
        drawPixelBlocks([
          [12, 12, 5, 4, "#e2e8f0", -28],
          [18, 16, 5, 4, "#64748b", -28],
          [24, 20, 5, 4, "#cbd5e1", -28],
          [30, 24, 5, 4, "#475569", -28],
          [36, 28, 5, 4, "#94a3b8", -28],
          [35, 29, 18, 4, "#cbd5e1"],
          [31, 33, 26, 6, "#94a3b8"],
          [27, 39, 34, 12, "#64748b"],
          [31, 51, 26, 6, "#334155"],
          [37, 57, 16, 3, "#1f2937"],
          [33, 34, 9, 3, "#f8fafc"],
          [51, 43, 6, 6, "#0f172a"],
        ]);
        return;
      }

      if (variant === "sleep") {
        drawPixelBlocks([
          [9, 26, 46, 6, "#dbeafe"],
          [5, 32, 54, 15, "#60a5fa"],
          [9, 47, 46, 6, "#1d4ed8"],
          [4, 36, 7, 8, "#93c5fd"],
          [53, 36, 7, 8, "#1e3a8a"],
          [12, 34, 22, 10, "rgba(191,219,254,0.75)"],
          [36, 34, 18, 10, "rgba(37,99,235,0.85)"],
          [32, 31, 2, 23, "rgba(224,242,254,0.82)"],
          [15, 35, 10, 3, "#ffffff"],
        ]);
        ctx.fillStyle = "#e0f2fe";
        ctx.font = "bold 15px monospace";
        ctx.fillText("ZZZ", 18, 22);
        ctx.fillStyle = "rgba(37,99,235,0.55)";
        ctx.fillText("ZZZ", 20, 22);
        return;
      }

      const isAcid = variant === "acid";
      const liquid = isAcid ? "#22c55e" : "#a855f7";
      const liquidDark = isAcid ? "#166534" : "#581c87";
      const liquidLight = isAcid ? "#bbf7d0" : "#f0abfc";
      const glass = isAcid ? "#dcfce7" : "#fae8ff";
      const rim = isAcid ? "#86efac" : "#e879f9";

      ctx.save();
      ctx.translate(32, 34);
      ctx.rotate((-7 * Math.PI) / 180);
      ctx.translate(-32, -34);

      ctx.fillStyle = liquid;
      ctx.globalAlpha = 0.12;
      ctx.beginPath();
      ctx.moveTo(32, 16);
      ctx.lineTo(8, 60);
      ctx.lineTo(56, 60);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;

      ctx.fillStyle = glass;
      ctx.globalAlpha = 0.92;
      ctx.fillRect(26, 7, 12, 5);
      ctx.globalAlpha = 0.82;
      ctx.fillStyle = rim;
      ctx.fillRect(23, 12, 18, 4);
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = glass;
      ctx.fillRect(28, 16, 8, 8);
      ctx.globalAlpha = 1;

      ctx.beginPath();
      ctx.moveTo(32, 22);
      ctx.lineTo(11, 60);
      ctx.lineTo(53, 60);
      ctx.closePath();
      ctx.fillStyle = "rgba(255,255,255,0.13)";
      ctx.fill();
      ctx.strokeStyle = glass;
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(32, 32);
      ctx.lineTo(18, 57);
      ctx.lineTo(46, 57);
      ctx.closePath();
      ctx.fillStyle = liquidDark;
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(32, 36);
      ctx.lineTo(23, 54);
      ctx.lineTo(43, 54);
      ctx.closePath();
      ctx.fillStyle = liquid;
      ctx.fill();

      ctx.fillStyle = liquidLight;
      ctx.globalAlpha = 0.78;
      ctx.fillRect(24, 45, 5, 5);
      ctx.globalAlpha = 0.7;
      ctx.fillRect(36, 39, 4, 4);
      ctx.globalAlpha = 0.58;
      ctx.fillStyle = glass;
      ctx.fillRect(30, 51, 3, 3);
      ctx.globalAlpha = 0.72;
      ctx.fillStyle = liquidDark;
      ctx.fillRect(20, 58, 25, 2);
      ctx.globalAlpha = 0.76;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(28, 9, 6, 2);
      ctx.globalAlpha = 0.34;
      ctx.fillRect(18, 37, 3, 12);
      ctx.restore();
    };

    const drawGlassOrbThumbnail = () => {
      ctx.clearRect(0, 0, outputSize, outputSize);
      const glow = ctx.createRadialGradient(32, 32, 4, 32, 32, 31);
      glow.addColorStop(0, "rgba(240,249,255,0.95)");
      glow.addColorStop(0.45, "rgba(34,211,238,0.34)");
      glow.addColorStop(1, "rgba(8,47,73,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, outputSize, outputSize);
      drawPixelBlocks([
        [19, 13, 26, 5, "#e0f2fe"],
        [14, 18, 36, 8, "#67e8f9"],
        [11, 26, 42, 16, "rgba(34,211,238,0.72)"],
        [15, 42, 34, 8, "#0891b2"],
        [24, 50, 16, 5, "#cffafe"],
        [21, 21, 14, 5, "rgba(255,255,255,0.92)"],
        [31, 28, 7, 14, "rgba(255,255,255,0.42)"],
        [31, 29, 4, 18, "#fef08a"],
        [32, 19, 3, 8, "#fef08a"],
        [32, 49, 3, 8, "#fef08a"],
        [24, 37, 18, 4, "#facc15", -28],
      ]);
    };

    const scheduleDraw = (drawFn: () => void, allowAnimatedRefresh = false) => {
      const delay = animate || spell === "tornado" ? 0 : Math.min(420, deferRank * 16);
      let interval: number | null = null;
      const timeout = window.setTimeout(() => {
        drawFn();
        if (animate && allowAnimatedRefresh && isAnimatedThumbnailSource(src)) {
          interval = window.setInterval(drawFn, 180);
        }
      }, delay);

      return () => {
        window.clearTimeout(timeout);
        if (interval !== null) window.clearInterval(interval);
      };
    };

    if (spell === "orbshield") {
      return scheduleDraw(drawOrbShieldHex);
    }

    if (spell === "grab") {
      return scheduleDraw(drawGrabThumbnail);
    }

    if (spell === "tornado") {
      return scheduleDraw(drawTornadoThumbnail);
    }

    if (spell === "meteorshower") {
      return scheduleDraw(drawMeteorThumbnail);
    }

    if (spell === "magicarmor") {
      return scheduleDraw(drawMagicArmorThumbnail);
    }

    if (spell === "jumpboost") {
      return scheduleDraw(drawJumpBoostThumbnail);
    }

    if (spell === "speedboost") {
      return scheduleDraw(drawSpeedBoostThumbnail);
    }

    if (spell === "tungstonballsack") {
      return scheduleDraw(() => drawStatusBoltThumbnail("tungston"));
    }

    if (spell === "sleep") {
      return scheduleDraw(() => drawStatusBoltThumbnail("sleep"));
    }

    if (spell === "poison") {
      return scheduleDraw(() => drawStatusBoltThumbnail("poison"));
    }

    if (spell === "acid") {
      return scheduleDraw(() => drawStatusBoltThumbnail("acid"));
    }

    if (spell === "magicglassorb") {
      return scheduleDraw(drawGlassOrbThumbnail);
    }

    const draw = () => {
      const img = imgRef.current;
      if (!img || !img.complete || img.naturalWidth <= 0 || img.naturalHeight <= 0) return;

      sampleCtx.clearRect(0, 0, sampleSize, sampleSize);
      const scale = Math.min(sampleSize / img.naturalWidth, sampleSize / img.naturalHeight);
      const width = img.naturalWidth * scale;
      const height = img.naturalHeight * scale;
      const x = (sampleSize - width) / 2;
      const y = (sampleSize - height) / 2;
      sampleCtx.drawImage(img, x, y, width, height);

      try {
        const imageData = sampleCtx.getImageData(0, 0, sampleSize, sampleSize);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
          const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
          if (brightness < 18) {
            data[i + 3] = 0;
          } else if (brightness < 42) {
            data[i + 3] = Math.min(data[i + 3], Math.round(data[i + 3] * ((brightness - 18) / 24)));
          }
        }
        sampleCtx.putImageData(imageData, 0, 0);
      } catch {
        // If a browser marks a GIF frame as tainted, keep the thumbnail visible.
      }

      ctx.clearRect(0, 0, outputSize, outputSize);
      ctx.drawImage(sampleCanvas, 0, 0, outputSize, outputSize);
    };

    return scheduleDraw(draw, true);
  }, [spell, src, animate, deferRank, imageFrameVersion]);

  const portalMask = spell === "portal"
    ? {
        mixBlendMode: "screen" as const,
        filter: "brightness(1.45) contrast(1.25) saturate(1.35)",
        WebkitMaskImage: "radial-gradient(circle at center, transparent 0 28%, black 34%, black 51%, transparent 61%)",
        maskImage: "radial-gradient(circle at center, transparent 0 28%, black 34%, black 51%, transparent 61%)",
      }
    : {};

  return (
    <>
      <canvas
        ref={canvasRef}
        className="h-full w-full object-contain"
        style={{ imageRendering: "pixelated", ...portalMask }}
      />
      <img
        ref={imgRef}
        src={src}
        alt=""
        crossOrigin="anonymous"
        className="pointer-events-none absolute h-px w-px opacity-0"
        onLoad={() => setImageFrameVersion((version) => version + 1)}
        onError={() => {
          const fallback = getSpriteUrl("/sprites/fireball/fireball_1.png") || "/sprites/fireball/fireball_1.png";
          if (src !== fallback) setSrc(fallback);
        }}
      />
    </>
  );
});

function emitMobileControl(detail: Record<string, unknown>) {
  window.dispatchEvent(new CustomEvent("mobile-control", { detail }));
}

function emitMobileHotbar(hand: HandType, direction: 1 | -1) {
  window.dispatchEvent(new CustomEvent("mobile-hotbar", { detail: { hand, direction } }));
}

function releaseMobileGameplayInputs() {
  emitMobileControl({ type: "move", x: 0, y: 0 });
  (["jump", "slide", "sprint"] as const).forEach((button) => {
    emitMobileControl({ type: "button", button, pressed: false });
  });
  window.dispatchEvent(new CustomEvent("mobile-cast", { detail: { hand: "left", phase: "end" } }));
  window.dispatchEvent(new CustomEvent("mobile-cast", { detail: { hand: "right", phase: "end" } }));
}

function MobileHotbarWheel({ hand }: { hand: HandType }) {
  const startYRef = useRef<number | null>(null);
  const hasDraggedRef = useRef(false);

  const emitFromPoint = (clientY: number, target: HTMLDivElement) => {
    const rect = target.getBoundingClientRect();
    const direction: 1 | -1 = clientY < rect.top + rect.height / 2 ? -1 : 1;
    emitMobileHotbar(hand, direction);
  };

  const beginWheel = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    startYRef.current = e.clientY;
    hasDraggedRef.current = false;
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const moveWheel = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (startYRef.current === null) return;
    e.preventDefault();
    e.stopPropagation();
    const delta = e.clientY - startYRef.current;
    if (Math.abs(delta) < 18) return;
    hasDraggedRef.current = true;
    emitMobileHotbar(hand, delta > 0 ? 1 : -1);
    startYRef.current = e.clientY;
  };

  const endWheel = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (startYRef.current !== null && !hasDraggedRef.current) {
      emitFromPoint(e.clientY, e.currentTarget);
    }
    startYRef.current = null;
    hasDraggedRef.current = false;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  };

  const cancelWheel = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    startYRef.current = null;
    hasDraggedRef.current = false;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  };

  return (
    <div
      data-testid={`mobile-${hand}-hotbar-wheel`}
      aria-label={`${hand} spell scroll wheel`}
      role="button"
      tabIndex={0}
      className="mobile-scroll-wheel pointer-events-auto relative h-16 w-12 overflow-hidden rounded-full border-2 border-cyan-100/45 bg-black/55 text-cyan-50 active:scale-95"
      style={{ touchAction: "none" }}
      onPointerDown={beginWheel}
      onPointerMove={moveWheel}
      onPointerUp={endWheel}
      onPointerCancel={cancelWheel}
      onWheel={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.deltaY !== 0) emitMobileHotbar(hand, e.deltaY > 0 ? 1 : -1);
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowUp") {
          e.preventDefault();
          emitMobileHotbar(hand, -1);
        }
        if (e.key === "ArrowDown") {
          e.preventDefault();
          emitMobileHotbar(hand, 1);
        }
      }}
    >
      <div className="absolute inset-x-0 top-1 flex justify-center text-[10px] leading-none text-cyan-100/80">^</div>
      <div className="absolute inset-x-1 top-1/2 h-px -translate-y-1/2 bg-cyan-100/35" />
      <div className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-100/55 bg-cyan-200/15 shadow-[inset_0_0_10px_rgba(125,211,252,0.25)]">
        <div className="absolute left-1/2 top-1/2 h-6 w-px -translate-x-1/2 -translate-y-1/2 bg-cyan-100/30" />
        <div className="absolute left-1/2 top-1/2 h-px w-6 -translate-x-1/2 -translate-y-1/2 bg-cyan-100/30" />
      </div>
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[10px] font-bold tracking-widest text-cyan-50">
        {hand === "left" ? "L" : "R"}
      </div>
      <div className="absolute inset-x-0 bottom-1 flex justify-center text-[10px] leading-none text-cyan-100/80">v</div>
    </div>
  );
}

function MobileTouchControls({
  openSpellMenu,
  pauseTouchGameplay,
}: {
  openSpellMenu: () => void;
  pauseTouchGameplay: () => void;
}) {
  const joystickRef = useRef<HTMLDivElement>(null);
  const joystickKnobRef = useRef<HTMLDivElement>(null);
  const joystickPointerRef = useRef<number | null>(null);
  const lookPointerRef = useRef<number | null>(null);
  const lastLookRef = useRef({ x: 0, y: 0 });
  const pendingMoveRef = useRef<{ x: number; y: number } | null>(null);
  const moveRafRef = useRef<number | null>(null);
  const pendingLookRef = useRef({ dx: 0, dy: 0 });
  const lookRafRef = useRef<number | null>(null);

  const setStickVisual = (x: number, y: number) => {
    if (!joystickKnobRef.current) return;
    const rect = joystickRef.current?.getBoundingClientRect();
    const travel = rect ? Math.min(rect.width, rect.height) * 0.3 : 34;
    joystickKnobRef.current.style.transform = `translate(calc(-50% + ${x * travel}px), calc(-50% + ${y * travel}px))`;
  };

  const flushQueuedMove = () => {
    moveRafRef.current = null;
    const move = pendingMoveRef.current;
    pendingMoveRef.current = null;
    if (move) emitMobileControl({ type: "move", x: move.x, y: move.y });
  };

  const queueMove = (x: number, y: number) => {
    pendingMoveRef.current = { x, y };
    if (moveRafRef.current === null) {
      moveRafRef.current = window.requestAnimationFrame(flushQueuedMove);
    }
  };

  const flushQueuedLook = () => {
    lookRafRef.current = null;
    const { dx, dy } = pendingLookRef.current;
    pendingLookRef.current = { dx: 0, dy: 0 };
    if (dx !== 0 || dy !== 0) emitMobileControl({ type: "look", dx, dy });
  };

  const queueLook = (dx: number, dy: number) => {
    pendingLookRef.current.dx += dx;
    pendingLookRef.current.dy += dy;
    if (lookRafRef.current === null) {
      lookRafRef.current = window.requestAnimationFrame(flushQueuedLook);
    }
  };

  useEffect(() => () => {
    if (moveRafRef.current !== null) window.cancelAnimationFrame(moveRafRef.current);
    if (lookRafRef.current !== null) window.cancelAnimationFrame(lookRafRef.current);
  }, []);

  const resetMove = () => {
    joystickPointerRef.current = null;
    if (moveRafRef.current !== null) {
      window.cancelAnimationFrame(moveRafRef.current);
      moveRafRef.current = null;
    }
    pendingMoveRef.current = null;
    setStickVisual(0, 0);
    emitMobileControl({ type: "move", x: 0, y: 0 });
  };

  const updateMove = (clientX: number, clientY: number) => {
    const rect = joystickRef.current?.getBoundingClientRect();
    if (!rect) return;

    const radius = Math.max(1, Math.min(rect.width, rect.height) / 2);
    const rawX = (clientX - (rect.left + rect.width / 2)) / radius;
    const rawY = (clientY - (rect.top + rect.height / 2)) / radius;
    const length = Math.hypot(rawX, rawY);
    const scale = length > 1 ? 1 / length : 1;
    const x = rawX * scale;
    const y = rawY * scale;
    setStickVisual(x, y);
    queueMove(x, y);
  };

  const beginMove = (e: any) => {
    e.preventDefault();
    e.stopPropagation();
    joystickPointerRef.current = e.pointerId;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    updateMove(e.clientX, e.clientY);
  };

  const moveStick = (e: any) => {
    if (joystickPointerRef.current !== e.pointerId) return;
    e.preventDefault();
    updateMove(e.clientX, e.clientY);
  };

  const beginLook = (e: any) => {
    e.preventDefault();
    e.stopPropagation();
    lookPointerRef.current = e.pointerId;
    lastLookRef.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const moveLook = (e: any) => {
    if (lookPointerRef.current !== e.pointerId) return;
    e.preventDefault();
    const dx = e.clientX - lastLookRef.current.x;
    const dy = e.clientY - lastLookRef.current.y;
    lastLookRef.current = { x: e.clientX, y: e.clientY };
    queueLook(dx, dy);
  };

  const endLook = (e: any) => {
    if (lookPointerRef.current !== e.pointerId) return;
    lookPointerRef.current = null;
  };

  const setButton = (button: "jump" | "slide" | "sprint", pressed: boolean) => (e: ReactPointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (pressed) {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    } else {
      e.currentTarget.releasePointerCapture?.(e.pointerId);
    }
    emitMobileControl({ type: "button", button, pressed });
  };

  const setCast = (hand: HandType, phase: "start" | "end") => (e: ReactPointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (phase === "start") {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    } else {
      e.currentTarget.releasePointerCapture?.(e.pointerId);
    }
    window.dispatchEvent(new CustomEvent("mobile-cast", { detail: { hand, phase } }));
  };

  const actionButtonClass = "mobile-action-button pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full border-2 border-white/35 bg-black/55 text-[10px] text-white active:scale-95 active:bg-white/20";
  const spellbookIconUrl =
    getSpriteUrl("/sprites/misc/spellbook_icon.png") ||
    getSpriteUrl("/sprites/misc/spellbook.gif") ||
    "/sprites/misc/spellbook_icon.png";

  return (
    <div data-testid="mobile-touch-controls" className="mobile-touch-controls pointer-events-none absolute inset-0 z-[85] select-none">
      <div
        className="pointer-events-auto absolute inset-y-0 right-0 w-[58%]"
        style={{ touchAction: "none" }}
        onPointerDown={beginLook}
        onPointerMove={moveLook}
        onPointerUp={endLook}
        onPointerCancel={endLook}
      />

      <div className="mobile-top-actions absolute left-3 top-3 z-10 flex max-w-[calc(100%-24px)] flex-wrap gap-2">
        <button
          data-testid="mobile-open-spell-menu"
          aria-label="Open spell book"
          title="Open spell book"
          className="mobile-spellbook-button pointer-events-auto flex h-12 w-12 items-center justify-center overflow-visible border-0 bg-transparent p-0 text-[9px] text-cyan-50 active:scale-95"
          onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); openSpellMenu(); }}
        >
          <img
            src={spellbookIconUrl}
            alt=""
            crossOrigin="anonymous"
            className="h-full w-full object-contain [image-rendering:pixelated]"
            style={{
              filter: "brightness(1.12) contrast(1.1) saturate(1.08)",
            }}
            onError={(e) => {
              e.currentTarget.classList.add("hidden");
              e.currentTarget.nextElementSibling?.classList.remove("hidden");
            }}
          />
          <span className="hidden font-mono tracking-widest">SPELL</span>
        </button>
        <button
          data-testid="mobile-pause"
          aria-label="Pause"
          title="Pause"
          className="mobile-pause-button pointer-events-auto flex h-11 w-11 items-center justify-center rounded-md border-2 border-cyan-100/40 bg-black/55 active:scale-95 active:bg-white/15"
          onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); pauseTouchGameplay(); }}
        >
          <span className="flex h-5 w-4 items-center justify-between" aria-hidden="true">
            <span className="h-full w-1.5 rounded-sm bg-cyan-50" />
            <span className="h-full w-1.5 rounded-sm bg-cyan-50" />
          </span>
        </button>
      </div>

      <div className="mobile-joystick-zone absolute left-3 bottom-[118px] z-10 flex flex-col gap-2">
        <div
          ref={joystickRef}
          className="mobile-joystick pointer-events-auto relative h-28 w-28 rounded-full border-2 border-cyan-100/35 bg-black/40"
          style={{ touchAction: "none" }}
          onPointerDown={beginMove}
          onPointerMove={moveStick}
          onPointerUp={(e) => {
            e.preventDefault();
            resetMove();
          }}
          onPointerCancel={resetMove}
        >
          <div className="mobile-joystick-center absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-100/25" />
          <div
            ref={joystickKnobRef}
            className="mobile-joystick-knob absolute left-1/2 top-1/2 h-12 w-12 rounded-full border border-cyan-100/55 bg-cyan-200/20"
            style={{
              transform: "translate(calc(-50% + 0px), calc(-50% + 0px))",
            }}
          />
        </div>
      </div>

      <div className="mobile-action-cluster absolute right-3 bottom-[108px] z-10 flex items-end gap-4">
        <div className="flex flex-col items-center gap-2">
          <MobileHotbarWheel hand="left" />
          <button
            data-testid="mobile-left-cast"
            className={actionButtonClass}
            onPointerDown={setCast("left", "start")}
            onPointerUp={setCast("left", "end")}
            onPointerCancel={setCast("left", "end")}
          >
            L
          </button>
        </div>
        <div className="mobile-movement-column mb-1 flex flex-col items-center gap-4">
          <button
            data-testid="mobile-jump"
            className={actionButtonClass}
            onPointerDown={setButton("jump", true)}
            onPointerUp={setButton("jump", false)}
            onPointerCancel={setButton("jump", false)}
          >
            JUMP
          </button>
          <button
            data-testid="mobile-slide"
            className={actionButtonClass}
            onPointerDown={setButton("slide", true)}
            onPointerUp={setButton("slide", false)}
            onPointerCancel={setButton("slide", false)}
          >
            SLIDE
          </button>
          <button
            data-testid="mobile-sprint"
            className={actionButtonClass}
            onPointerDown={setButton("sprint", true)}
            onPointerUp={setButton("sprint", false)}
            onPointerCancel={setButton("sprint", false)}
          >
            RUN
          </button>
        </div>
        <div className="flex flex-col items-center gap-2">
          <MobileHotbarWheel hand="right" />
          <button
            data-testid="mobile-right-cast"
            className={actionButtonClass}
            onPointerDown={setCast("right", "start")}
            onPointerUp={setCast("right", "end")}
            onPointerCancel={setCast("right", "end")}
          >
            R
          </button>
        </div>
      </div>
    </div>
  );
}

const SpellMenu = memo(function SpellMenu({
  menuSpellIndex,
  setMenuSpellIndex,
  onClose,
  bindingHand,
}: {
  menuSpellIndex: number;
  setMenuSpellIndex: (value: number | ((prev: number) => number)) => void;
  onClose: () => void;
  bindingHand: HandType;
}) {
  const leftHotbarSpells = useGameStore(s => s.leftHotbarSpells);
  const rightHotbarSpells = useGameStore(s => s.rightHotbarSpells);
  const leftSelectedHotbarIndex = useGameStore(s => s.leftSelectedHotbarIndex);
  const rightSelectedHotbarIndex = useGameStore(s => s.rightSelectedHotbarIndex);
  const leftCurrentSpell = useGameStore(s => s.leftCurrentSpell);
  const rightCurrentSpell = useGameStore(s => s.rightCurrentSpell);
  const setHotbarSpell = useGameStore(s => s.setHotbarSpell);
  const selectHotbarSlot = useGameStore(s => s.selectHotbarSlot);
  const scrollRef = useRef<HTMLDivElement>(null);

  const highlightedSpell = ALL_SPELLS[menuSpellIndex];
  const bindingHotbar = bindingHand === "right" ? rightHotbarSpells : leftHotbarSpells;
  const bindingSelectedIndex = bindingHand === "right" ? rightSelectedHotbarIndex : leftSelectedHotbarIndex;

  useEffect(() => {
    const focusedCard = scrollRef.current?.querySelector<HTMLElement>(`[data-spell-index="${menuSpellIndex}"]`);
    focusedCard?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [menuSpellIndex]);

  useEffect(() => {
    const handleControllerScroll = (event: Event) => {
      const amount = (event as CustomEvent<number>).detail ?? 0;
      if (!scrollRef.current || amount === 0) return;
      scrollRef.current.scrollTop += amount;
    };

    window.addEventListener("spell-menu-controller-scroll", handleControllerScroll);
    return () => window.removeEventListener("spell-menu-controller-scroll", handleControllerScroll);
  }, []);

  const assignSpellToSlot = (slotIndex: number, spell: SpellType, hand: HandType = bindingHand) => {
    setHotbarSpell(slotIndex, spell, hand);
    selectHotbarSlot(slotIndex, hand);
  };

  const renderHotbarColumn = (hand: HandType, spells: SpellType[], selectedIndex: number) => (
    <div
      className={cn(
        "spell-menu-hotbar-column relative min-w-0 border p-1.5 shadow-[0_0_22px_rgba(8,47,73,0.75),inset_0_0_20px_rgba(34,211,238,0.12)]",
        hand === "right"
          ? "border-fuchsia-300/55 bg-fuchsia-950/55"
          : "border-yellow-200/55 bg-yellow-950/45",
        bindingHand === hand ? "ring-1 ring-white/70" : ""
      )}
    >
      <div className={cn(
        "border-b pb-1 text-center text-[8px] tracking-[0.25em]",
        hand === "right" ? "border-fuchsia-300/35 text-fuchsia-100" : "border-yellow-200/35 text-yellow-100"
      )}>
        {hand === "left" ? "LEFT" : "RIGHT"}
      </div>
      <div className="mt-1.5 flex flex-col gap-1">
        {spells.map((spell, index) => (
          <button
            key={`${hand}-${spell}-${index}`}
            className={cn(
              "spell-menu-hotbar-slot grid h-8 min-w-0 grid-cols-[16px_1fr] items-center gap-1 border bg-black/45 px-1 text-left transition-all",
              selectedIndex === index
                ? hand === "right"
                  ? "border-fuchsia-200 bg-fuchsia-300/20 text-fuchsia-50 shadow-[0_0_14px_rgba(217,70,239,0.65)]"
                  : "border-yellow-200 bg-yellow-200/20 text-yellow-50 shadow-[0_0_14px_rgba(253,224,71,0.55)]"
                : hand === "right"
                  ? "border-fuchsia-300/25 text-fuchsia-100/75 hover:border-fuchsia-200/80"
                  : "border-yellow-200/25 text-yellow-100/75 hover:border-yellow-100/80",
              bindingHand === hand ? "brightness-125" : ""
            )}
            onClick={() => selectHotbarSlot(index, hand)}
          >
            <div className="text-center text-[9px] text-white/80">{hotkeyLabels[index]}</div>
            <div className="truncate text-[7px] leading-3">{spellNames[spell]}</div>
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="absolute inset-0 z-[130] flex items-center justify-center pointer-events-auto">
      <div className="absolute inset-0 bg-cyan-950/10 pointer-events-none" />
      <div
        ref={scrollRef}
        data-testid="spell-menu"
        className="spell-menu-hologram relative overflow-x-hidden overflow-y-auto rounded-[2px] border border-cyan-200/60 bg-[#12071f]/24 p-3 text-cyan-100 shadow-[0_0_35px_rgba(34,211,238,0.45)] backdrop-blur-[1px]"
        style={{
          width: 'min(920px, calc(var(--app-vw, 100dvw) - 32px))',
          maxHeight: 'calc(var(--app-vh, 100dvh) - 96px)',
        }}
      >
        <div className="spell-menu-scanline pointer-events-none absolute inset-0 opacity-40" />
        <div className="spell-menu-header sticky top-0 z-20 flex items-start justify-between gap-4 border-b border-cyan-300/40 bg-[#12071f]/95 pb-3 backdrop-blur-[2px]">
          <div>
            <div className="text-[10px] tracking-[0.4em] text-cyan-300/80">ARCANE LOADOUT</div>
            <div className="spell-menu-title mt-2 text-2xl text-white drop-shadow-[0_0_8px_rgba(103,232,249,0.9)]">SPELL BOOK</div>
          </div>
          <button
            data-testid="spell-menu-close"
            className="spell-menu-close-button border border-cyan-300/70 bg-cyan-300/10 px-3 py-2 text-[10px] tracking-widest text-cyan-100 hover:bg-cyan-200/20"
            onClick={onClose}
          >
            E CLOSE
          </button>
        </div>

        <div className="spell-menu-layout relative mt-3 grid grid-cols-[78px_minmax(0,1fr)_78px] gap-2">
          {renderHotbarColumn("left", leftHotbarSpells, leftSelectedHotbarIndex)}

          <div className="spell-menu-spell-panel min-w-0 border border-cyan-300/20 bg-black/10 p-2">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[8px] tracking-widest text-cyan-100/70">
              <span>NUMBER ROW BINDS ACTIVE HAND</span>
              <span>{bindingHand === "right" ? "RIGHT HAND TARGET" : "LEFT HAND TARGET"}</span>
            </div>

            <div className="spell-menu-grid grid grid-cols-3 gap-2 md:grid-cols-5">
              {ALL_SPELLS.map((spell, index) => {
                const isHighlighted = index === menuSpellIndex;
                const leftAssignedSlot = leftHotbarSpells.indexOf(spell);
                const rightAssignedSlot = rightHotbarSpells.indexOf(spell);
                const assignedSlot = bindingHotbar.indexOf(spell);
                const isCurrent = spell === leftCurrentSpell || spell === rightCurrentSpell;

                return (
                  <button
                    key={spell}
                    data-spell-index={index}
                    className={cn(
                      "spell-menu-card group relative min-h-[84px] min-w-0 border p-1.5 text-left transition-all",
                      isHighlighted
                        ? "border-yellow-200 bg-yellow-200/10 text-yellow-100 shadow-[0_0_20px_rgba(250,204,21,0.45)]"
                        : "border-cyan-300/30 bg-cyan-400/5 text-cyan-100 hover:border-cyan-200/80 hover:bg-cyan-300/10",
                      isCurrent ? "ring-1 ring-white/70" : ""
                    )}
                    onMouseEnter={() => setMenuSpellIndex(index)}
                    onFocus={() => setMenuSpellIndex(index)}
                    onClick={() => assignSpellToSlot(bindingSelectedIndex, spell)}
                  >
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "spell-menu-thumb relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden border border-cyan-200/30",
                        spell === "portal" ? "bg-indigo-300/10" : "bg-cyan-300/5"
                      )}>
                        <SpellThumbnail spell={spell} animate={isHighlighted} deferRank={index} />
                      </div>
                      <div className="min-w-0">
                        <div className={cn("truncate text-[8px] leading-4", spellColors[spell])}>{spellNames[spell]}</div>
                        <div className="text-[8px] tracking-widest text-cyan-100/60">
                          {assignedSlot === -1 ? "UNBOUND" : `${bindingHand.toUpperCase()} ${hotkeyLabels[assignedSlot]}`}
                        </div>
                        <div className="text-[7px] tracking-widest text-cyan-100/35">
                          {leftAssignedSlot === -1 ? "" : `L${hotkeyLabels[leftAssignedSlot]} `}
                          {rightAssignedSlot === -1 ? "" : `R${hotkeyLabels[rightAssignedSlot]}`}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 h-[2px] bg-cyan-200/20">
                      <div className={cn("h-full transition-all", isHighlighted ? "w-full bg-yellow-200" : "w-1/3 bg-cyan-300/70")} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {renderHotbarColumn("right", rightHotbarSpells, rightSelectedHotbarIndex)}
        </div>

        <div className="spell-menu-footer relative mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-cyan-300/30 pt-3 text-[9px] tracking-widest text-cyan-100/70">
          <span>ARROWS/WHEEL/D-PAD SELECT SPELL</span>
          <span>PRESS 1-0 OR A TO BIND, HOLD Q OR LB/RB CHOOSE HAND</span>
          <span>HIGHLIGHTED: {bindingHand.toUpperCase()} {hotkeyLabels[bindingSelectedIndex]} / {spellNames[highlightedSpell]}</span>
        </div>
      </div>
    </div>
  );
}, (previous, next) => (
  previous.menuSpellIndex === next.menuSpellIndex &&
  previous.bindingHand === next.bindingHand
));

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
  const isMapExpanded = useGameStore(s => s.isMapExpanded);
  const toggleMap = useGameStore(s => s.toggleMap);
  const setPauseMenuOpen = useGameStore(s => s.setPauseMenuOpen);
  const isScoreboardOpen = useGameStore(s => s.isScoreboardOpen);
  const setScoreboardOpen = useGameStore(s => s.setScoreboardOpen);
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
  const lobbyMessages = useGameStore(s => s.lobbyMessages);
  const addLobbyMessage = useGameStore(s => s.addLobbyMessage);
  const removeLobbyMessage = useGameStore(s => s.removeLobbyMessage);
  const isVClipEnabled = useGameStore(s => s.isVClipEnabled);
  const setVClipEnabled = useGameStore(s => s.setVClipEnabled);
  const setSurvivalTimeOverrideSeconds = useGameStore(s => s.setSurvivalTimeOverrideSeconds);
  const players = useGameStore(s => s.players);
  
  const aspectRatio = useGameStore(s => s.aspectRatio);
  const setAspectRatio = useGameStore(s => s.setAspectRatio);
  const isFillAspect = aspectRatio === "Fill";
  const fillSafeFrameStyle = isFillAspect ? {
    width: 'min(100cqw, calc(100cqh * 16 / 9))',
    height: 'min(100cqh, calc(100cqw * 9 / 16))',
  } as CSSProperties : undefined;
  const hudRootStyle = {
    containerType: "size",
  } as CSSProperties;
  const [showVideoMenu, setShowVideoMenu] = useState(false);
  
  const [isLocked, setIsLocked] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [isDocumentFullscreen, setIsDocumentFullscreen] = useState(false);
  const [isFullscreenHintOpen, setIsFullscreenHintOpen] = useState(false);
  const [canLock, setCanLock] = useState(true);
  const [isReturningToGame, setIsReturningToGame] = useState(false);
  const [isPauseOverlayOpen, setPauseOverlayOpen] = useState(() => {
    const state = useGameStore.getState();
    return state.isGameLaunched && !state.isControllerGameplayActive && !state.isTouchControlsActive;
  });
  const [playerState, setPlayerState] = useState({
    isMoving: false,
    isSprinting: false,
    isSliding: false,
    isGrounded: true,
    isMeditating: false
  });
  const [menuSpellIndex, setMenuSpellIndex] = useState(0);
  const [isRightHandModifier, setIsRightHandModifier] = useState(false);
  const [menuBindingHand, setMenuBindingHand] = useState<HandType>("left");
  const [isSpellMenuPreloaded, setSpellMenuPreloaded] = useState(false);
  const [pauseMenuIndex, setPauseMenuIndex] = useState(0);
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
  const [buffClock, setBuffClock] = useState(() => Date.now());
  const qHeldRef = useRef(false);
  const keyboardScoreboardRef = useRef(false);
  const controllerScoreboardRef = useRef(false);
  const controllerResumeRequestedRef = useRef(false);
  const pointerLockUnavailableRef = useRef(false);
  const pointerLockRequestIdRef = useRef(0);
  const pointerLockResumeGraceUntilRef = useRef(0);
  const pauseMenuRequestedRef = useRef(false);
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
  const controllerButtonsRef = useRef<Partial<Record<GamepadButtonName | "menuStickLeft" | "menuStickRight" | "menuStickUp" | "menuStickDown", boolean>>>({});
  const controllerRepeatRef = useRef<Partial<Record<string, number>>>({});

  useEffect(() => {
    const updateTouchCapability = () => {
      setIsTouchDevice(isTouchGameplayDevice());
    };

    updateTouchCapability();
    window.addEventListener("resize", updateTouchCapability);
    return () => window.removeEventListener("resize", updateTouchCapability);
  }, []);

  useEffect(() => () => {
    document.documentElement.classList.remove("wizards-mouse-gameplay-active");
  }, []);

  useEffect(() => {
    const updateFullscreenState = () => {
      setIsDocumentFullscreen(Boolean(getFullscreenElement()) || isStandaloneDisplayMode());
    };

    updateFullscreenState();
    document.addEventListener("fullscreenchange", updateFullscreenState);
    document.addEventListener("webkitfullscreenchange", updateFullscreenState as EventListener);
    window.matchMedia?.("(display-mode: fullscreen)").addEventListener?.("change", updateFullscreenState);
    window.matchMedia?.("(display-mode: standalone)").addEventListener?.("change", updateFullscreenState);

    return () => {
      document.removeEventListener("fullscreenchange", updateFullscreenState);
      document.removeEventListener("webkitfullscreenchange", updateFullscreenState as EventListener);
      window.matchMedia?.("(display-mode: fullscreen)").removeEventListener?.("change", updateFullscreenState);
      window.matchMedia?.("(display-mode: standalone)").removeEventListener?.("change", updateFullscreenState);
    };
  }, []);

  useEffect(() => {
    if (isTouchDevice || !isTouchControlsActive) return;
    setTouchControlsActive(false);
    releaseMobileGameplayInputs();
  }, [isTouchControlsActive, isTouchDevice, setTouchControlsActive]);

  useEffect(() => {
    const touchGameplayLayout = isTouchDevice && isTouchControlsActive;
    document.documentElement.classList.toggle("wizards-touch-gameplay", touchGameplayLayout);
    return () => {
      document.documentElement.classList.remove("wizards-touch-gameplay");
    };
  }, [isTouchControlsActive, isTouchDevice]);

  useEffect(() => {
    if (localPlayerName) {
      setPlayerNameInput(localPlayerName);
    }
  }, [localPlayerName]);

  useEffect(() => {
    if (isGameLaunched && startMenuStage === "press-start") {
      setStartMenuStage("resume");
    }
  }, [isGameLaunched, startMenuStage]);

  useEffect(() => {
    if (isSpellMenuPreloaded) return;
    const timeout = window.setTimeout(() => setSpellMenuPreloaded(true), 1800);
    return () => window.clearTimeout(timeout);
  }, [isSpellMenuPreloaded]);

  useEffect(() => {
    if (isSpellMenuOpen) {
      setSpellMenuPreloaded(true);
    }
  }, [isSpellMenuOpen]);

  useEffect(() => {
    if (lobbyMessages.length === 0) return;

    const interval = window.setInterval(() => {
      const now = Date.now();
      lobbyMessages.forEach((message) => {
        if (now - message.createdAt > 12000) {
          removeLobbyMessage(message.id);
        }
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [lobbyMessages, removeLobbyMessage]);

  const touchGameplayActive = isTouchDevice && isTouchControlsActive;
  const controllerGameplayActive = isControllerGameplayActive;
  const isDevSurvivalObserver = import.meta.env.DEV && new URLSearchParams(window.location.search).get("qaSurvival") === "1";
  const mouseGameplayActive = isLocked || (!pauseMenuRequestedRef.current && typeof document !== "undefined" && document.pointerLockElement !== null);
  const isGameplayActive = mouseGameplayActive || touchGameplayActive || controllerGameplayActive;
  const isResumePauseOverlayRequested = isGameLaunched
    && startMenuStage === "resume"
    && ((isPauseOverlayOpen && pauseMenuRequestedRef.current) || showVideoMenu)
    && !mouseGameplayActive;
  const shouldShowMenuOverlay = !isDevSurvivalObserver
    && !isCommandConsoleOpen
    && !isSpellMenuOpen
    && !isReturningToGame
    && (isResumePauseOverlayRequested || ((!isGameLaunched || startMenuStage !== "resume") && !isGameplayActive));
  const menuOverlayStyle = {
    display: shouldShowMenuOverlay ? "flex" : "none",
    containerType: "size",
    width: "var(--app-vw, 100dvw)",
    height: "var(--app-vh, 100dvh)",
    maxWidth: "var(--app-vw, 100dvw)",
    maxHeight: "var(--app-vh, 100dvh)",
    overflow: "hidden",
  } as CSSProperties;
  const shouldRenderGameplayHud = isGameplayActive
    || isReturningToGame
    || (isGameLaunched && startMenuStage === "resume" && !shouldShowMenuOverlay);
  const leftRuneReady = hasRunePower(leftRunePower);
  const rightRuneReady = hasRunePower(rightRunePower);
  const healthPercent = (health / 100) * 100;
  const armorPercent = (armor / ARMOR_MAX) * 100;
  const speedBoostSeconds = Math.ceil(Math.max(0, speedBoostUntil - buffClock) / 1000);
  const jumpBoostSeconds = Math.ceil(Math.max(0, jumpBoostUntil - buffClock) / 1000);
  const slowSeconds = Math.ceil(Math.max(0, slowUntil - buffClock) / 1000);
  const sleepSeconds = Math.ceil(Math.max(0, sleepUntil - buffClock) / 1000);
  const poisonSeconds = Math.ceil(Math.max(0, poisonUntil - buffClock) / 1000);
  const acidSeconds = Math.ceil(Math.max(0, acidUntil - buffClock) / 1000);
  const glassOrbActive = magicGlassOrbUntil > buffClock;
  const hasActiveBuff = speedBoostSeconds > 0 || jumpBoostSeconds > 0 || slowSeconds > 0 || sleepSeconds > 0 || poisonSeconds > 0 || acidSeconds > 0 || glassOrbActive;
  const poisonPercent = Math.min(100, (Math.max(0, poisonUntil - buffClock) / POISON_DURATION_MS) * 100);
  const acidPercent = Math.min(100, (Math.max(0, acidUntil - buffClock) / ACID_DURATION_MS) * 100);
  const roomUrl = window.location.href;
  const currentInviteRoomCode = getCurrentInviteRoomCode();
  const isLocalHttpOrigin = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  const voiceNeedsSecureOrigin = !window.isSecureContext && !isLocalHttpOrigin;
  const isMultiplayerMode = gameMode !== "solo-survival";
  const resumeMenuActionCount = isMultiplayerMode ? pauseMenuItemCount : 2;
  const settingsActionCount = settingsPane === "video"
    ? settingsVideoActionCount
    : settingsPane === "keybinds"
      ? settingsKeybindActionCount
      : settingsPane === "voice"
        ? settingsVoiceActionCount
        : settingsCharacterActionCount;
  const mainMenuActionCount = startMenuStage === "press-start"
    ? 1
    : startMenuStage === "mode-select"
      ? 2
      : startMenuStage === "multiplayer-select"
        ? 3
        : startMenuStage === "custom-lobby"
          ? 8
          : startMenuStage === "survival-options"
            ? 7
            : resumeMenuActionCount;
  const settingsMenuStyle = {
    width: settingsPane === "video"
      ? 'min(520px, calc(100cqw - 24px))'
      : settingsPane === "voice"
        ? 'min(720px, calc(100cqw - 24px))'
        : 'min(920px, calc(100cqw - 24px))',
    maxHeight: 'calc(100cqh - 20px)',
    padding: 'clamp(0.35rem, 1.2cqh, 0.9rem)',
  } as CSSProperties;
  const settingsScrollPanelStyle = {
    maxHeight: settingsPane === "character"
      ? 'max(128px, calc(100cqh - 150px))'
      : 'max(128px, calc(100cqh - 148px))',
  } as CSSProperties;
  const isPauseMenuVisible = shouldShowMenuOverlay && isGameLaunched && startMenuStage === "resume";
  const activeBindingHand: HandType = isRightHandModifier ? "right" : menuBindingHand;
  const requestMapToggle = () => {
    const now = performance.now();
    if (now - lastMapToggleRef.current < 180) return;
    lastMapToggleRef.current = now;
    startTransition(toggleMap);
  };
  const localStatuses = [
    sleepSeconds > 0 ? "SLEEP" : "",
    slowSeconds > 0 ? "SLOWED" : "",
    poisonSeconds > 0 ? "POISON" : "",
    acidSeconds > 0 ? "ACID" : "",
  ].filter(Boolean);
  const localPlayerStatus = health <= 0 ? "DOWN" : (localStatuses.length > 0 ? localStatuses.join(" / ") : "READY");
  const scoreboardRows: ScoreboardRow[] = [
    {
      id: socket.id ?? "local",
      label: localPlayerName ? `YOU - ${localPlayerName}` : "YOU",
      status: localPlayerStatus,
      health,
      armor,
      score: Math.max(0, Math.round(health + armor)),
      isLocal: true,
    },
    ...Object.values(players)
      .filter(player => player.id !== socket.id)
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((player, index) => ({
        id: player.id,
        label: player.playerName || `WIZARD ${index + 1} (${player.id.slice(0, 4).toUpperCase()})`,
        status: getRemotePlayerStatus(player, buffClock),
        health: player.health,
        armor: player.armor ?? 0,
        score: Math.max(0, Math.round(player.health + (player.armor ?? 0))),
      })),
  ];

  const copyInvite = () => {
    void (async () => {
      let inviteUrl = roomUrl;
      try {
        const currentUrl = new URL(window.location.href);
        const params = new URLSearchParams(currentUrl.search);
        if (!params.has("mobilePerf")) params.set("mobilePerf", "1");

        const response = await fetch("/api/lan-info", { cache: "no-store" });
        if (response.ok) {
          const info = await response.json() as LanInfoResponse;
          const lanAddress = info.lanAddresses?.[0];
          const httpPort = info.httpPort || 3000;
          if (lanAddress) {
            inviteUrl = `http://${lanAddress}:${httpPort}${currentUrl.pathname}?${params.toString()}`;
          }
        }
      } catch {
        // Fall back to the current URL if the LAN helper is unavailable.
      }

      await navigator.clipboard?.writeText(inviteUrl).catch(() => {});
    })();
  };

  const joinInviteCode = () => {
    const roomCode = extractInviteRoomCode(inviteCodeInput);
    if (!roomCode) {
      setInviteCodeMessage("ENTER A VALID CODE");
      return;
    }

    setInviteCodeInput(roomCode);
    if (roomCode === currentInviteRoomCode) {
      setInviteCodeMessage("ALREADY IN THIS ROOM");
      return;
    }

    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set("room", roomCode);
    window.location.assign(nextUrl.toString());
  };

  const submitPlayerName = () => {
    const cleaned = sanitizePlayerName(playerNameInput);
    if (cleaned.length < 2) return;
    setLocalPlayerName(cleaned);
  };

  const setScoreboardSource = (source: "keyboard" | "controller", open: boolean) => {
    if (source === "keyboard") {
      if (keyboardScoreboardRef.current === open) return;
      keyboardScoreboardRef.current = open;
    } else {
      if (controllerScoreboardRef.current === open) return;
      controllerScoreboardRef.current = open;
    }
    const nextOpen = keyboardScoreboardRef.current || controllerScoreboardRef.current;
    if (useGameStore.getState().isScoreboardOpen !== nextOpen) {
      setScoreboardOpen(nextOpen);
    }
  };

  const finishMouseGameplayResume = () => {
    pauseMenuRequestedRef.current = false;
    document.documentElement.classList.add("wizards-mouse-gameplay-active");
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

  const openPauseMenuFromGameplay = (inputMode: GameplayInputMode) => {
    pointerLockRequestIdRef.current += 1;
    pauseMenuRequestedRef.current = true;
    pointerLockResumeGraceUntilRef.current = 0;
    document.documentElement.classList.remove("wizards-mouse-gameplay-active");
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
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
  };

  const beginControllerRemap = (action: ControllerAction) => {
    remapReadyAtRef.current = performance.now() + 260;
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

  const updateCharacterField = (key: keyof CharacterCustomization, value: string) => {
    setCharacterCustomization({ [key]: value } as Partial<CharacterCustomization>);
  };

  const cycleCharacterColor = (key: keyof CharacterCustomization, direction: 1 | -1) => {
    const current = normalizeHexInput(String(characterCustomization[key] ?? "")).toLowerCase();
    const presetIndex = characterColorPresets.findIndex((color) => color.toLowerCase() === current);
    const nextColor = characterColorPresets[wrapIndex((presetIndex === -1 ? 0 : presetIndex) + direction, characterColorPresets.length)];
    updateCharacterField(key, nextColor);
  };

  const cycleCharacterStyle = (key: keyof CharacterCustomization, options: string[], direction: 1 | -1) => {
    updateCharacterField(key, cycleOption(options, String(characterCustomization[key]), direction));
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
      const colorIndex = pauseMenuIndex - characterColorStartIndex;
      if (colorIndex >= 0 && colorIndex < characterColorRows.length) {
        cycleCharacterColor(characterColorRows[colorIndex].key, direction);
        return true;
      }

      const styleIndex = pauseMenuIndex - characterStyleStartIndex;
      if (styleIndex >= 0 && styleIndex < characterStyleRows.length) {
        const row = characterStyleRows[styleIndex];
        cycleCharacterStyle(row.key, row.options, direction);
        return true;
      }

      const mouthIndex = pauseMenuIndex - characterMouthStartIndex;
      if (mouthIndex >= 0 && mouthIndex < characterMouthRows.length) {
        const row = characterMouthRows[mouthIndex];
        cycleCharacterStyle(row.key, row.options, direction);
        return true;
      }
    }

    return false;
  };

  useEffect(() => {
    setPauseMenuOpen(isGameLaunched && startMenuStage === "resume" && isPauseMenuVisible);
    return () => setPauseMenuOpen(false);
  }, [isGameLaunched, isPauseMenuVisible, setPauseMenuOpen, startMenuStage]);

  useEffect(() => {
    if (
      speedBoostUntil <= Date.now() &&
      jumpBoostUntil <= Date.now() &&
      slowUntil <= Date.now() &&
      sleepUntil <= Date.now() &&
      poisonUntil <= Date.now() &&
      acidUntil <= Date.now() &&
      magicGlassOrbUntil <= Date.now()
    ) {
      setBuffClock(Date.now());
      return;
    }

    const interval = window.setInterval(() => setBuffClock(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, [acidUntil, jumpBoostUntil, magicGlassOrbUntil, poisonUntil, sleepUntil, slowUntil, speedBoostUntil]);

  // Deplete rune energy
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isCommandConsoleOpen || isEditableTarget(e.target)) return;
      if (e.code !== "KeyQ" || e.repeat) return;
      qHeldRef.current = true;
      setIsRightHandModifier(true);
      setMenuBindingHand("right");
      setActiveHand("right");
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (isCommandConsoleOpen || isEditableTarget(e.target)) return;
      if (e.code !== "KeyQ") return;
      qHeldRef.current = false;
      setIsRightHandModifier(false);
      setMenuBindingHand("left");
      setActiveHand("left");
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [isCommandConsoleOpen, setActiveHand]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isCommandConsoleOpen || isEditableTarget(e.target)) return;
      if (e.key === 'Escape' && (isLocked || document.pointerLockElement || touchGameplayActive || controllerGameplayActive)) {
        e.preventDefault();
        e.stopPropagation();
        openPauseMenuFromGameplay(touchGameplayActive
          ? "touch"
          : controllerGameplayActive
            ? "controller"
            : "mouse");
        return;
      }

      if (e.key === 'Escape' && !isLocked && !isSpellMenuOpen && isReturningToGame) {
        e.preventDefault();
        e.stopPropagation();
        setIsReturningToGame(false);
        setPauseOverlayOpen(true);
        setPauseMenuOpen(true);
        return;
      }

      if (e.key === 'Escape' && !isLocked && !isSpellMenuOpen && showVideoMenu) {
        e.preventDefault();
        e.stopPropagation();
        setShowVideoMenu(false);
        setSettingsPane("video");
        setRemappingAction(null);
        setRemappingVoiceKey(false);
        setPauseMenuIndex(3);
        setPauseOverlayOpen(true);
        setPauseMenuOpen(true);
        return;
      }

    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [controllerGameplayActive, isCommandConsoleOpen, isLocked, isReturningToGame, isSpellMenuOpen, openPauseMenuFromGameplay, setPauseMenuOpen, showVideoMenu, touchGameplayActive]);

  useEffect(() => {
    if (!isLocked && !touchGameplayActive && !controllerGameplayActive) return;
    const interval = setInterval(() => {
      const state = useGameStore.getState();
      setLeftRunePower(Math.max(0, state.leftRunePower - 1));
      setRightRunePower(Math.max(0, state.rightRunePower - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [controllerGameplayActive, isLocked, setLeftRunePower, setRightRunePower, touchGameplayActive]);

  useEffect(() => {
    const handleLockChange = () => {
      const locked = document.pointerLockElement !== null;
      setIsLocked(locked);
      if (locked) {
        document.documentElement.classList.add("wizards-mouse-gameplay-active");
        finishMouseGameplayResume();
      } else {
        if (!pauseMenuRequestedRef.current && performance.now() < pointerLockResumeGraceUntilRef.current) {
          setIsLocked(true);
          return;
        }
        document.documentElement.classList.remove("wizards-mouse-gameplay-active");
        setCanLock(true);
        if (
          useGameStore.getState().isGameLaunched &&
          !useGameStore.getState().isSpellMenuOpen &&
          !isCommandConsoleOpen &&
          !isReturningToGame
        ) {
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
        prev.isGrounded === e.detail.isGrounded &&
        prev.isMeditating === e.detail.isMeditating
      ) return prev;
      return e.detail;
    });
    const handleKeyDown = (e: KeyboardEvent) => {
      // Intentionally left blank or handle other keys
    };

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
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerlockchange", handleLockChange);
      window.removeEventListener("pointerlockerror", handlePointerError, true);
      document.removeEventListener("pointerlockerror", handlePointerError, true);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
      window.removeEventListener("player-state", handlePlayerState);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isCommandConsoleOpen, isReturningToGame, setPauseMenuOpen, setTouchControlsActive]);

  useEffect(() => {
    if (!isGameLaunched) return;

    const reconcileMouseGameplayResume = () => {
      if (pauseMenuRequestedRef.current || !document.pointerLockElement) return;
      if (!isPauseOverlayOpen && !isReturningToGame && !showVideoMenu && isLocked) return;

      document.documentElement.classList.add("wizards-mouse-gameplay-active");
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

    reconcileMouseGameplayResume();
    const interval = window.setInterval(reconcileMouseGameplayResume, 120);
    return () => window.clearInterval(interval);
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
  ]);

  useEffect(() => {
    if (!isSpellMenuOpen) return;
    const index = ALL_SPELLS.indexOf(currentSpell as SpellType);
    setMenuSpellIndex(index === -1 ? 0 : index);
  }, [currentSpell, isSpellMenuOpen]);

  const requestMobileFullscreen = (showHintOnFailure = true) => {
    const webkitDocument = document as Document & {
      webkitExitFullscreen?: () => Promise<void> | void;
    };
    const fullscreenTarget = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void> | void;
    };

    try {
      if (getFullscreenElement()) {
        const exitRequest = document.exitFullscreen?.() ?? webkitDocument.webkitExitFullscreen?.();
        setIsFullscreenHintOpen(false);
        if (exitRequest && typeof exitRequest.catch === "function") {
          exitRequest.catch(() => {
            if (showHintOnFailure) setIsFullscreenHintOpen(true);
          });
        }
        return true;
      }

      if (isStandaloneDisplayMode()) {
        setIsDocumentFullscreen(true);
        setIsFullscreenHintOpen(false);
        return true;
      }

      const request = fullscreenTarget.requestFullscreen?.({ navigationUI: "hide" }) ?? fullscreenTarget.webkitRequestFullscreen?.();
      if (!request) {
        if (showHintOnFailure) setIsFullscreenHintOpen(true);
        return false;
      }

      if (request && typeof request.catch === "function") {
        request
          .then(() => {
            setIsDocumentFullscreen(true);
            setIsFullscreenHintOpen(false);
          })
          .catch(() => {
            if (showHintOnFailure) setIsFullscreenHintOpen(true);
          });
      } else {
        setIsDocumentFullscreen(true);
        setIsFullscreenHintOpen(false);
      }
      return true;
    } catch {
      if (showHintOnFailure) setIsFullscreenHintOpen(true);
      return false;
    }
  };

  const startTouchGameplay = () => {
    if (!localPlayerName) {
      return false;
    }

    pointerLockRequestIdRef.current += 1;
    pauseMenuRequestedRef.current = false;
    pointerLockResumeGraceUntilRef.current = 0;
    document.documentElement.classList.remove("wizards-mouse-gameplay-active");
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
    pauseMenuRequestedRef.current = false;
    pointerLockResumeGraceUntilRef.current = 0;
    document.documentElement.classList.remove("wizards-mouse-gameplay-active");
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

  const pauseControllerGameplay = () => {
    openPauseMenuFromGameplay("controller");
  };

  const requestGamePointerLock = () => {
    if (!localPlayerName) {
      setCanLock(true);
      return false;
    }

    if (document.pointerLockElement) {
      document.documentElement.classList.add("wizards-mouse-gameplay-active");
      finishMouseGameplayResume();
      return true;
    }

    const requestId = pointerLockRequestIdRef.current + 1;
    pointerLockRequestIdRef.current = requestId;
    pauseMenuRequestedRef.current = false;
    pointerLockResumeGraceUntilRef.current = performance.now() + 1800;

    const handlePointerLockGranted = () => {
      if (pointerLockRequestIdRef.current !== requestId) return;
      if (!document.pointerLockElement) return;
      finishMouseGameplayResume();
    };

    const handlePointerLockDenied = (reason?: unknown) => {
      if (pointerLockRequestIdRef.current !== requestId) return;
      if (isPointerLockSecurityError(reason)) {
        pointerLockUnavailableRef.current = true;
      }
      pauseMenuRequestedRef.current = true;
      pointerLockResumeGraceUntilRef.current = 0;
      document.documentElement.classList.remove("wizards-mouse-gameplay-active");
      setIsLocked(false);
      setIsReturningToGame(false);
      setPauseOverlayOpen(true);
      setPauseMenuOpen(true);
      setCanLock(true);
    };

    if (pointerLockUnavailableRef.current || !canRequestPointerLockHere()) {
      pointerLockUnavailableRef.current = true;
      handlePointerLockDenied();
      return false;
    }

    const lockTarget =
      document.getElementById("game-canvas") ??
      document.querySelector("canvas") ??
      document.body;

    try {
      setCanLock(false);
      setIsLocked(true);
      pointerLockResumeGraceUntilRef.current = performance.now() + 1800;
      setPauseOverlayOpen(false);
      setPauseMenuOpen(false);
      document.documentElement.classList.add("wizards-mouse-gameplay-active");
      const request = (lockTarget as HTMLElement & { requestPointerLock?: () => Promise<void> | void }).requestPointerLock?.();
      if (request && typeof request.catch === "function") {
        request.then(handlePointerLockGranted).catch(handlePointerLockDenied);
      } else {
        window.setTimeout(() => {
          if (document.pointerLockElement) {
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

  const closeCommandConsole = (resumeGameplay = true) => {
    setCommandConsoleOpen(false);
    setCommandConsoleValue("/");

    if (resumeGameplay && commandConsoleShouldRelockRef.current && !pointerLockUnavailableRef.current) {
      setIsReturningToGame(true);
      window.setTimeout(requestGamePointerLock, 0);
    }

    commandConsoleShouldRelockRef.current = false;
  };

  const openCommandConsole = () => {
    if (!isGameLaunched || isCommandConsoleOpen || isSpellMenuOpen) return;

    commandConsoleShouldRelockRef.current = Boolean(document.pointerLockElement) && !isTouchDevice;
    setScoreboardSource("keyboard", false);
    setScoreboardSource("controller", false);
    setControllerGameplayActive(false);
    setShowVideoMenu(false);
    setCommandConsoleValue("/");
    setCommandConsoleOpen(true);
    window.dispatchEvent(new Event("command-console-opened"));

    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
  };

  useEffect(() => {
    if (
      !controllerGameplayActive ||
      isLocked ||
      isTouchDevice ||
      isSpellMenuOpen ||
      showVideoMenu ||
      isCommandConsoleOpen ||
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
  }, [controllerGameplayActive, isCommandConsoleOpen, isLocked, isReturningToGame, isSpellMenuOpen, isTouchDevice, requestGamePointerLock, showVideoMenu]);

  const submitCommandConsole = () => {
    const rawCommand = commandConsoleValue.trim();
    const commandParts = rawCommand.replace(/^\/+/, "").trim().split(/\s+/).filter(Boolean);
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
      const truthy = ["on", "true", "1", "yes", "enable", "enabled"];
      const falsy = ["off", "false", "0", "no", "disable", "disabled"];
      const nextEnabled = normalizedValue.length === 0 || normalizedValue === "toggle"
        ? !useGameStore.getState().isVClipEnabled
        : truthy.includes(normalizedValue)
          ? true
          : falsy.includes(normalizedValue)
            ? false
            : null;

      if (nextEnabled === null) {
        addLobbyMessage("Usage: /vclip on or /vclip off", "system");
      } else {
        setVClipEnabled(nextEnabled);
        addLobbyMessage(`VCLIP ${nextEnabled ? "ENABLED" : "DISABLED"}`, "system");
      }

      closeCommandConsole();
      return;
    }

    if (normalizedCommand === "night") {
      const truthy = ["", "on", "true", "1", "yes", "enable", "enabled"];
      const falsy = ["off", "false", "0", "no", "disable", "disabled", "clear", "reset", "day"];

      if (truthy.includes(normalizedValue)) {
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
      const truthy = ["", "on", "true", "1", "yes", "enable", "enabled"];
      const falsy = ["off", "false", "0", "no", "disable", "disabled", "clear", "reset", "cycle"];

      if (truthy.includes(normalizedValue)) {
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
          "system"
        );
      } else {
        addLobbyMessage("Usage: /navrecord start, stop, export, status, or clear", "system");
      }

      closeCommandConsole();
      return;
    }

    addLobbyMessage(`Unknown command: /${normalizedCommand}`, "system");
    closeCommandConsole();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isCommandConsoleOpen || remappingAction || remappingVoiceKey || isEditableTarget(e.target)) return;
      if (e.key !== "/" && e.code !== "Slash") return;
      e.preventDefault();
      e.stopPropagation();
      openCommandConsole();
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [isCommandConsoleOpen, openCommandConsole, remappingAction, remappingVoiceKey]);

  const launchMode = (mode: GameMode) => {
    pauseMenuRequestedRef.current = false;
    setGameMode(mode);
    setGameLaunched(true);
    setStartMenuStage("resume");
    setPauseOverlayOpen(false);
    setPauseMenuIndex(0);

    if (isTouchDevice) {
      startTouchGameplay();
      return;
    }

    if (controllerResumeRequestedRef.current) {
      startControllerGameplay();
      return;
    }

    document.documentElement.classList.add("wizards-mouse-gameplay-active");
    pointerLockResumeGraceUntilRef.current = performance.now() + 1800;
    setIsLocked(true);
    setPauseMenuOpen(false);
    setIsReturningToGame(true);
    window.setTimeout(requestGamePointerLock, 0);
  };

  const cycleLobbyMap = (direction: 1 | -1) => {
    setLobbyRules({
      mapPreset: cycleOption(LOBBY_MAP_PRESETS, lobbyRules.mapPreset, direction) as typeof lobbyRules.mapPreset,
    });
  };

  const cycleLobbyDifficulty = (direction: 1 | -1) => {
    setLobbyRules({
      enemyDifficulty: cycleOption(ENEMY_DIFFICULTY_SETTINGS, lobbyRules.enemyDifficulty, direction) as typeof lobbyRules.enemyDifficulty,
    });
  };

  const cycleSurvivalDifficulty = (direction: 1 | -1) => {
    setSurvivalRules({
      enemyDifficulty: cycleOption(ENEMY_DIFFICULTY_SETTINGS, survivalRules.enemyDifficulty, direction) as typeof survivalRules.enemyDifficulty,
    });
  };

  const cycleLobbyManaRate = (direction: 1 | -1) => {
    setLobbyRules({
      manaSpawnRate: cycleOption(MANA_SPAWN_RATE_SETTINGS, lobbyRules.manaSpawnRate, direction) as typeof lobbyRules.manaSpawnRate,
    });
  };

  const cycleSurvivalManaRate = (direction: 1 | -1) => {
    setSurvivalRules({
      manaSpawnRate: cycleOption(MANA_SPAWN_RATE_SETTINGS, survivalRules.manaSpawnRate, direction) as typeof survivalRules.manaSpawnRate,
    });
  };

  const adjustLobbyMaxPlayers = (direction: 1 | -1) => {
    setLobbyRules({ maxPlayers: Math.max(2, Math.min(16, lobbyRules.maxPlayers + direction)) });
  };

  const adjustSurvivalMaxPlayers = (direction: 1 | -1) => {
    setSurvivalRules({ maxPlayers: Math.max(1, Math.min(12, survivalRules.maxPlayers + direction)) });
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

    if (isTouchDevice || inputMode === "touch") {
      if (startTouchGameplay()) {
        return;
      }
    }

    if (controllerResumeRequestedRef.current || inputMode === "controller") {
      startControllerGameplay();
      return;
    }

    if (canLock) {
      pauseMenuRequestedRef.current = false;
      document.documentElement.classList.add("wizards-mouse-gameplay-active");
      pointerLockResumeGraceUntilRef.current = performance.now() + 1800;
      setIsLocked(true);
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
      if (!document.pointerLockElement) {
        requestGamePointerLock();
      }
      window.setTimeout(() => {
        if (!document.pointerLockElement) {
          setCanLock(true);
        }
      }, 900);
    });
  };

  const openSpellMenuFromGame = () => {
    if (
      isMapExpanded ||
      showVideoMenu ||
      isPauseMenuVisible ||
      !(isLocked || document.pointerLockElement || touchGameplayActive || controllerGameplayActive)
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
    document.documentElement.classList.remove("wizards-mouse-gameplay-active");
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
  };

  const runPauseMenuAction = (index = pauseMenuIndex) => {
    if (showVideoMenu) {
      if (index === 0) {
        setSettingsPane("video");
        return;
      }

      if (index === 1) {
        setSettingsPane("keybinds");
        return;
      }

      if (index === 2) {
        setSettingsPane("voice");
        return;
      }

      if (index === 3) {
        setSettingsPane("character");
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
        const colorIndex = index - characterColorStartIndex;
        if (colorIndex >= 0 && colorIndex < characterColorRows.length) {
          cycleCharacterColor(characterColorRows[colorIndex].key, 1);
          return;
        }

        const styleIndex = index - characterStyleStartIndex;
        if (styleIndex >= 0 && styleIndex < characterStyleRows.length) {
          const row = characterStyleRows[styleIndex];
          cycleCharacterStyle(row.key, row.options, 1);
          return;
        }

        const mouthIndex = index - characterMouthStartIndex;
        if (mouthIndex >= 0 && mouthIndex < characterMouthRows.length) {
          const row = characterMouthRows[mouthIndex];
          cycleCharacterStyle(row.key, row.options, 1);
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

    if (startMenuStage === "press-start") {
      setStartMenuStage("mode-select");
      setPauseMenuIndex(0);
      return;
    }

    if (startMenuStage === "mode-select") {
      if (index === 0) {
        launchMode("solo-survival");
        return;
      }

      setStartMenuStage("multiplayer-select");
      setPauseMenuIndex(0);
      return;
    }

    if (startMenuStage === "multiplayer-select") {
      if (index === 0) {
        setStartMenuStage("custom-lobby");
        setPauseMenuIndex(0);
        return;
      }

      if (index === 1) {
        setStartMenuStage("survival-options");
        setPauseMenuIndex(0);
        return;
      }

      setStartMenuStage("mode-select");
      setPauseMenuIndex(1);
      return;
    }

    if (startMenuStage === "custom-lobby") {
      if (index === 0) {
        cycleLobbyMap(1);
        return;
      }

      if (index === 1) {
        adjustLobbyMaxPlayers(1);
        return;
      }

      if (index === 2) {
        cycleLobbyDifficulty(1);
        return;
      }

      if (index === 3) {
        cycleLobbyManaRate(1);
        return;
      }

      if (index === 4) {
        setLobbyRules({ friendlyFire: !lobbyRules.friendlyFire });
        return;
      }

      if (index === 5) {
        joinInviteCode();
        return;
      }

      if (index === 6) {
        launchMode("custom-lobby");
        return;
      }

      setStartMenuStage("multiplayer-select");
      setPauseMenuIndex(0);
      return;
    }

    if (startMenuStage === "survival-options") {
      if (index === 0) {
        adjustSurvivalMaxPlayers(1);
        return;
      }

      if (index === 1) {
        cycleSurvivalDifficulty(1);
        return;
      }

      if (index === 2) {
        cycleSurvivalManaRate(1);
        return;
      }

      if (index === 3) {
        setSurvivalRules({ friendlyFire: !survivalRules.friendlyFire });
        return;
      }

      if (index === 4) {
        joinInviteCode();
        return;
      }

      if (index === 5) {
        launchMode("multiplayer-survival");
        return;
      }

      setStartMenuStage("multiplayer-select");
      setPauseMenuIndex(1);
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

  const movePauseMenuFocus = (direction: number) => {
    const count = showVideoMenu ? settingsActionCount : mainMenuActionCount;
    setPauseMenuIndex(prev => wrapIndex(prev + direction, count));
  };

  useEffect(() => {
    const count = showVideoMenu ? settingsActionCount : mainMenuActionCount;
    setPauseMenuIndex(prev => Math.min(prev, count - 1));
  }, [mainMenuActionCount, settingsActionCount, showVideoMenu]);

  useEffect(() => {
    if (!showVideoMenu) return;
    const panel = settingsScrollRef.current;
    const focusedItem = panel?.querySelector<HTMLElement>(`[data-settings-index="${pauseMenuIndex}"]`);
    focusedItem?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [pauseMenuIndex, settingsPane, showVideoMenu]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isCommandConsoleOpen || isEditableTarget(e.target)) return;
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
        movePauseMenuFocus(1);
        return;
      }

      if (e.code === "ArrowUp" || e.code === "ArrowLeft") {
        e.preventDefault();
        movePauseMenuFocus(-1);
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
      if (isCommandConsoleOpen || isEditableTarget(e.target)) return;
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
  }, [closePauseMenu, isCommandConsoleOpen, isPauseMenuVisible, movePauseMenuFocus, remappingVoiceKey, runPauseMenuAction, setScoreboardSource, setVoicePushToTalkKey]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isCommandConsoleOpen || isEditableTarget(e.target)) return;
      const slotIndex = getNumberSlot(e.code);
      const hand: HandType = isSpellMenuOpen
        ? (qHeldRef.current ? "right" : menuBindingHand)
        : (qHeldRef.current ? "right" : "left");

      if (e.code === "KeyE" && !e.repeat) {
        e.preventDefault();
        if (isSpellMenuOpen) {
          closeSpellMenuAndResume();
        } else {
          openSpellMenuFromGame();
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
          const spell = ALL_SPELLS[menuSpellIndex];
          const selectedIndex = hand === "right" ? rightSelectedHotbarIndex : leftSelectedHotbarIndex;
          setHotbarSpell(selectedIndex, spell, hand);
          selectHotbarSlot(selectedIndex, hand);
          return;
        }

        if (e.code === "ArrowRight" || e.code === "ArrowDown") {
          e.preventDefault();
          setMenuSpellIndex(prev => (prev + 1) % ALL_SPELLS.length);
          return;
        }

        if (e.code === "ArrowLeft" || e.code === "ArrowUp") {
          e.preventDefault();
          setMenuSpellIndex(prev => (prev - 1 + ALL_SPELLS.length) % ALL_SPELLS.length);
        }
        return;
      }

      if (slotIndex !== -1 && slotIndex < HOTBAR_SIZE && (isLocked || document.pointerLockElement || touchGameplayActive || controllerGameplayActive)) {
        e.preventDefault();
        selectHotbarSlot(slotIndex, hand);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    isLocked,
    isCommandConsoleOpen,
    controllerGameplayActive,
    isSpellMenuOpen,
    touchGameplayActive,
    leftSelectedHotbarIndex,
    menuBindingHand,
    menuSpellIndex,
    openSpellMenuFromGame,
    rightSelectedHotbarIndex,
    selectHotbarSlot,
    setHotbarSpell,
  ]);

  useEffect(() => {
    const consumePress = (key: GamepadButtonName, pressed: boolean) => {
      const wasPressed = controllerButtonsRef.current[key] ?? false;
      controllerButtonsRef.current[key] = pressed;
      return pressed && !wasPressed;
    };

    const consumeRepeat = (key: string, pressed: boolean, firstDelay = 260, repeatDelay = 170) => {
      const now = performance.now();
      const wasPressed = controllerButtonsRef.current[key as keyof typeof controllerButtonsRef.current] ?? false;
      controllerButtonsRef.current[key as keyof typeof controllerButtonsRef.current] = pressed;

      if (!pressed) {
        delete controllerRepeatRef.current[key];
        return false;
      }

      if (!wasPressed) {
        controllerRepeatRef.current[key] = now + firstDelay;
        return true;
      }

      if (now >= (controllerRepeatRef.current[key] ?? 0)) {
        controllerRepeatRef.current[key] = now + repeatDelay;
        return true;
      }

      return false;
    };

    let raf = 0;
    const pollController = () => {
      const now = performance.now();
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
        controllerButtonsRef.current = {};
        controllerRepeatRef.current = {};
        setScoreboardSource("controller", false);
        raf = window.requestAnimationFrame(pollController);
        return;
      }
      controllerLastSeenAtRef.current = now;

      if (remappingAction) {
        if (performance.now() >= remapReadyAtRef.current) {
          const backPressedForRemap = isGamepadButtonPressed(gamepad, controllerBindings.menuBack as GamepadButtonName);
          if (backPressedForRemap) {
            setRemappingAction(null);
            raf = window.requestAnimationFrame(pollController);
            return;
          }

          const capturedButton = controllerButtonOptions.find(button =>
            isGamepadButtonPressed(gamepad, button as GamepadButtonName)
          );
          if (capturedButton) {
            setControllerBinding(remappingAction, capturedButton);
            setRemappingAction(null);
          }
        }
        raf = window.requestAnimationFrame(pollController);
        return;
      }

      const bindings = controllerBindings;
      const leftBumperHeld = isGamepadButtonPressed(gamepad, bindings.leftHotbar as GamepadButtonName);
      const rightBumperHeld = isGamepadButtonPressed(gamepad, bindings.rightHotbar as GamepadButtonName);
      const leftBumperPressed = consumePress("leftBumper", leftBumperHeld);
      const rightBumperPressed = consumePress("rightBumper", rightBumperHeld);

      const aPressed = consumePress("a", isGamepadButtonPressed(gamepad, bindings.menuSelect as GamepadButtonName));
      const bPressed = consumePress("b", isGamepadButtonPressed(gamepad, bindings.menuBack as GamepadButtonName));
      const xPressed = consumePress("x", isGamepadButtonPressed(gamepad, bindings.spellMenu as GamepadButtonName));
      const yPressed = consumePress("y", isGamepadButtonPressed(gamepad, bindings.map as GamepadButtonName));
      const backHeld = isGamepadButtonPressed(gamepad, bindings.scoreboard as GamepadButtonName);
      const startPressed = consumePress("start", isGamepadButtonPressed(gamepad, bindings.pause as GamepadButtonName));

      const dpadLeft = isGamepadButtonPressed(gamepad, "dpadLeft");
      const dpadRight = isGamepadButtonPressed(gamepad, "dpadRight");
      const dpadUp = isGamepadButtonPressed(gamepad, "dpadUp");
      const dpadDown = isGamepadButtonPressed(gamepad, "dpadDown");
      const menuAxisX = getGamepadAxis(gamepad, 0, 0.55);
      const menuAxisY = getGamepadAxis(gamepad, 1, 0.55);
      const scrollAxisY = getGamepadAxis(gamepad, 3, 0.25);
      const pauseMenuOpen = isPauseMenuVisible;

      setScoreboardSource("controller", !isSpellMenuOpen && backHeld);
      if (pauseMenuOpen && showVideoMenu && Math.abs(scrollAxisY) > 0.05) {
        scrollSettingsPanel(scrollAxisY * 18);
      }
      if (isSpellMenuOpen && Math.abs(scrollAxisY) > 0.05) {
        window.dispatchEvent(new CustomEvent("spell-menu-controller-scroll", { detail: scrollAxisY * 18 }));
      }

      const menuNextSpellPressed = consumeRepeat("controllerMenuNextSpell", isSpellMenuOpen && (dpadRight || menuAxisX > 0.6));
      const menuPrevSpellPressed = consumeRepeat("controllerMenuPrevSpell", isSpellMenuOpen && (dpadLeft || menuAxisX < -0.6));
      const menuNextSlotPressed = consumeRepeat("controllerMenuNextSlot", isSpellMenuOpen && (dpadDown || menuAxisY > 0.6));
      const menuPrevSlotPressed = consumeRepeat("controllerMenuPrevSlot", isSpellMenuOpen && (dpadUp || menuAxisY < -0.6));
      const pauseNextPressed = consumeRepeat("controllerPauseNext", pauseMenuOpen && (dpadDown || menuAxisY > 0.6));
      const pausePrevPressed = consumeRepeat("controllerPausePrev", pauseMenuOpen && (dpadUp || menuAxisY < -0.6));
      const pauseRightPressed = consumeRepeat("controllerPauseRight", pauseMenuOpen && (dpadRight || menuAxisX > 0.6));
      const pauseLeftPressed = consumeRepeat("controllerPauseLeft", pauseMenuOpen && (dpadLeft || menuAxisX < -0.6));
      if (isSpellMenuOpen) {
        if (rightBumperHeld || rightBumperPressed) {
          setMenuBindingHand("right");
        } else if (leftBumperHeld || leftBumperPressed) {
          setMenuBindingHand("left");
        }

        if (bPressed || xPressed || startPressed) {
          closeSpellMenuAndResume();
          raf = window.requestAnimationFrame(pollController);
          return;
        }

        if (menuNextSpellPressed) {
          setMenuSpellIndex(prev => (prev + 1) % ALL_SPELLS.length);
        } else if (menuPrevSpellPressed) {
          setMenuSpellIndex(prev => (prev - 1 + ALL_SPELLS.length) % ALL_SPELLS.length);
        }

        if (menuNextSlotPressed || menuPrevSlotPressed) {
          const bindingHand = rightBumperHeld ? "right" : leftBumperHeld ? "left" : activeBindingHand;
          const selectedIndex = bindingHand === "right" ? rightSelectedHotbarIndex : leftSelectedHotbarIndex;
          selectHotbarSlot(selectedIndex + (menuNextSlotPressed ? 1 : -1), bindingHand);
        }

        if (aPressed) {
          const bindingHand = rightBumperHeld ? "right" : leftBumperHeld ? "left" : activeBindingHand;
          const spell = ALL_SPELLS[menuSpellIndex];
          const selectedIndex = bindingHand === "right" ? rightSelectedHotbarIndex : leftSelectedHotbarIndex;
          setHotbarSpell(selectedIndex, spell, bindingHand);
          selectHotbarSlot(selectedIndex, bindingHand);
        }

        raf = window.requestAnimationFrame(pollController);
        return;
      }

      if (pauseMenuOpen) {
        if (pauseNextPressed) {
          movePauseMenuFocus(1);
        } else if (pausePrevPressed) {
          movePauseMenuFocus(-1);
        }

        if (pauseRightPressed) {
          if (!adjustFocusedSetting(1)) {
            if (showVideoMenu && pauseMenuIndex < settingsTabCount) {
              const nextTabIndex = wrapIndex(pauseMenuIndex + 1, settingsTabCount);
              setSettingsPane(settingsPaneOrder[nextTabIndex]);
              setPauseMenuIndex(nextTabIndex);
            } else {
              movePauseMenuFocus(1);
            }
          }
        } else if (pauseLeftPressed) {
          if (!adjustFocusedSetting(-1)) {
            if (showVideoMenu && pauseMenuIndex < settingsTabCount) {
              const nextTabIndex = wrapIndex(pauseMenuIndex - 1, settingsTabCount);
              setSettingsPane(settingsPaneOrder[nextTabIndex]);
              setPauseMenuIndex(nextTabIndex);
            } else {
              movePauseMenuFocus(-1);
            }
          }
        }

        if (bPressed) {
          controllerResumeRequestedRef.current = true;
          closePauseMenu("controller");
          controllerResumeRequestedRef.current = false;
          raf = window.requestAnimationFrame(pollController);
          return;
        }

        if (aPressed) {
          controllerResumeRequestedRef.current = true;
          runPauseMenuAction();
          controllerResumeRequestedRef.current = false;
          raf = window.requestAnimationFrame(pollController);
          return;
        }

        if (startPressed) {
          startControllerGameplay();
          raf = window.requestAnimationFrame(pollController);
          return;
        }

        raf = window.requestAnimationFrame(pollController);
        return;
      }

      if (startPressed) {
        if (touchGameplayActive) {
          pauseTouchGameplay();
        } else if (isLocked || document.pointerLockElement) {
          pauseControllerGameplay();
          if (document.pointerLockElement) {
            document.exitPointerLock();
          }
        } else if (controllerGameplayActive) {
          pauseControllerGameplay();
        } else if (isTouchDevice) {
          startTouchGameplay();
        } else {
          startControllerGameplay();
        }
        raf = window.requestAnimationFrame(pollController);
        return;
      }

      if ((aPressed || startPressed) && !isLocked && !controllerGameplayActive && !isReturningToGame) {
        if (isTouchDevice) {
          startTouchGameplay();
        } else {
          startControllerGameplay();
        }
      }

      if (xPressed && (isLocked || document.pointerLockElement || touchGameplayActive || controllerGameplayActive) && !isMapExpanded && !isScoreboardOpen) {
        openSpellMenuFromGame();
      }

      if (yPressed && !isScoreboardOpen && (isLocked || document.pointerLockElement || touchGameplayActive || controllerGameplayActive || isMapExpanded)) {
        requestMapToggle();
      }

      raf = window.requestAnimationFrame(pollController);
    };

    raf = window.requestAnimationFrame(pollController);
    return () => window.cancelAnimationFrame(raf);
  }, [
    activeBindingHand,
    adjustFocusedSetting,
    canLock,
    closePauseMenu,
    closeSpellMenuAndResume,
    controllerGameplayActive,
    controllerBindings,
    isLocked,
    isCommandConsoleOpen,
    isMapExpanded,
    isPauseMenuVisible,
    isReturningToGame,
    isScoreboardOpen,
    isSpellMenuOpen,
    isTouchDevice,
    leftSelectedHotbarIndex,
    menuSpellIndex,
    movePauseMenuFocus,
    openSpellMenuFromGame,
    pauseControllerGameplay,
    requestGamePointerLock,
    remappingAction,
    rightSelectedHotbarIndex,
    runPauseMenuAction,
    scrollSettingsPanel,
    selectHotbarSlot,
    startControllerGameplay,
    setActiveHand,
    setControllerBinding,
    setHotbarSpell,
    setScoreboardSource,
    showVideoMenu,
    touchGameplayActive,
    toggleMap,
  ]);

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (!useGameStore.getState().isSpellMenuOpen) return;
      setMenuSpellIndex(prev => (prev + (e.deltaY > 0 ? 1 : -1) + ALL_SPELLS.length) % ALL_SPELLS.length);
    };

    window.addEventListener("wheel", handleWheel, { passive: false });
    return () => window.removeEventListener("wheel", handleWheel);
  }, []);

  const mainMenuFocus = (index: number) => !showVideoMenu && pauseMenuIndex === index;
  const settingsFocus = (index: number) => showVideoMenu && pauseMenuIndex === index;
  const focusedMenuClass = "ring-2 ring-yellow-200 ring-offset-2 ring-offset-black shadow-[0_0_20px_rgba(250,204,21,0.55)] brightness-125";
  const settingsBackIndex = settingsPane === "video"
    ? videoBackIndex
    : settingsPane === "keybinds"
      ? keybindBackIndex
      : settingsPane === "voice"
        ? voiceBackIndex
        : characterBackIndex;

  const renderMenuButton = (index: number, label: string, hint: string, onClick: () => void) => (
    <button
      key={`${startMenuStage}-${index}-${label}`}
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onMouseEnter={() => setPauseMenuIndex(index)}
      className={cn(
        "wizard-panel w-full cursor-pointer border-2 border-purple-300/45 bg-[#15081f]/80 px-5 py-3 text-left font-mono uppercase tracking-widest text-white shadow-[6px_6px_0_rgba(0,0,0,0.65)] transition-all hover:brightness-125",
        mainMenuFocus(index) ? focusedMenuClass : ""
      )}
    >
      <span className="block text-[clamp(0.85rem,2.5vmin,1.35rem)] font-bold text-yellow-100">{label}</span>
      <span className="mt-1 block normal-case text-[clamp(0.55rem,1.35vmin,0.78rem)] text-cyan-100/70">{hint}</span>
    </button>
  );

  const renderRuleButton = (
    index: number,
    label: string,
    value: string,
    hint: string,
    onStep: (direction: 1 | -1) => void
  ) => (
    <button
      key={`${startMenuStage}-rule-${index}-${label}`}
      type="button"
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
        "grid w-full grid-cols-[minmax(100px,0.75fr)_minmax(110px,1fr)] items-center gap-3 border-2 bg-black/45 px-3 py-2 text-left transition-all hover:border-yellow-200",
        mainMenuFocus(index) ? "border-yellow-200 shadow-[0_0_18px_rgba(250,204,21,0.35)]" : "border-cyan-100/30"
      )}
    >
      <span className="text-[clamp(0.58rem,1.45vmin,0.8rem)] tracking-widest text-cyan-100/70">{label}</span>
      <span className="text-[clamp(0.7rem,1.8vmin,0.95rem)] font-bold tracking-wider text-white">{value}</span>
      <span className="col-span-2 normal-case text-[clamp(0.5rem,1.18vmin,0.66rem)] text-cyan-100/45">{hint}</span>
    </button>
  );

  const renderInviteCodeForm = (focusIndex: number) => (
    <form
      data-testid="invite-code-form"
      className={cn(
        "flex w-full flex-col gap-1 border-2 bg-black/45 p-2 text-cyan-50",
        mainMenuFocus(focusIndex) ? "border-yellow-200 shadow-[0_0_18px_rgba(250,204,21,0.35)]" : "border-cyan-100/35"
      )}
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        joinInviteCode();
      }}
      onMouseEnter={() => setPauseMenuIndex(focusIndex)}
    >
      <div className="flex items-center justify-between gap-2 text-[clamp(0.56rem,1.4vmin,0.78rem)] tracking-widest text-cyan-100/80">
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
          className="normal-case min-w-[180px] flex-1 border-2 border-[#888] border-b-[#222] border-r-[#222] bg-[#120c16] px-3 py-2 text-[clamp(0.68rem,1.9vmin,0.95rem)] text-white outline-none focus:border-yellow-200"
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
          className="border-2 border-[#888] border-b-[#222] border-r-[#222] bg-[#555] px-4 py-2 text-[clamp(0.62rem,1.8vmin,0.9rem)] text-white hover:bg-[#666]"
        >
          JOIN
        </button>
      </div>
      <div className="min-h-[1rem] text-[clamp(0.5rem,1.25vmin,0.68rem)] tracking-widest text-cyan-100/60">
        {inviteCodeMessage || "TYPE THE SAME ROOM CODE ON EACH DEVICE"}
      </div>
    </form>
  );

  const renderStartMenuContent = () => {
    const survivalPlayerEstimate = gameMode === "multiplayer-survival"
      ? Math.max(1, Object.keys(players).length + 1)
      : 1;
    const survivalDifficulty = getSurvivalDifficultyMultiplier(survivalPlayerEstimate, survivalRules.enemyDifficulty);

    if (startMenuStage === "press-start") {
      return (
        <button
          type="button"
          className="pointer-events-auto flex h-full w-full cursor-pointer flex-col items-center justify-center bg-[radial-gradient(circle_at_center,rgba(88,28,135,0.35),rgba(5,2,7,0.96)_62%)] text-center"
          onClick={(e) => {
            e.stopPropagation();
            setStartMenuStage("mode-select");
            setPauseMenuIndex(0);
          }}
        >
          <span className="font-mono text-[clamp(2rem,8vmin,5.5rem)] font-bold uppercase leading-[0.85] tracking-[0.1em] text-[#ffb347] drop-shadow-[4px_4px_0_theme(colors.purple.900)]">
            Wizards<br />Only<br />Fools!
          </span>
          <span className="mt-8 animate-pulse font-mono text-[clamp(0.95rem,3vmin,1.65rem)] font-bold uppercase tracking-[0.18em] text-cyan-100">
            Press Anywhere To Play
          </span>
        </button>
      );
    }

    if (startMenuStage === "mode-select") {
      return (
        <div className="pointer-events-auto flex w-[min(92cqw,620px)] flex-col items-center gap-3">
          <h1 className="text-center font-mono text-[clamp(1.1rem,4vmin,2.1rem)] font-bold uppercase tracking-[0.18em] text-[#ffb347]">Choose Your Spellstorm</h1>
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
          <h1 className="text-center font-mono text-[clamp(1.1rem,4vmin,2.1rem)] font-bold uppercase tracking-[0.18em] text-[#ffb347]">Multiplayer</h1>
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
          <h1 className="text-center font-mono text-[clamp(1rem,3.5vmin,1.8rem)] font-bold uppercase tracking-[0.18em] text-[#ffb347]">Custom Lobby Rules</h1>
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
          <h1 className="text-center font-mono text-[clamp(1rem,3.5vmin,1.8rem)] font-bold uppercase tracking-[0.18em] text-[#ffb347]">Survival Multiplayer</h1>
          <p className="normal-case text-center text-[clamp(0.58rem,1.45vmin,0.8rem)] tracking-wider text-cyan-100/65">
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

    return null;
  };

  const requestResumeFromOverlay = (target: EventTarget | null) => {
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

  return (
    <div className="pointer-events-none absolute inset-0 text-white font-mono uppercase" style={hudRootStyle}>
      {/* Flashbang Overlay */}
      {flashbangOpacity > 0 && (
        <div 
          className="absolute inset-0 bg-white pointer-events-none z-[200]" 
          style={{ opacity: flashbangOpacity, transition: 'opacity 0.1s linear' }}
        />
      )}

      <LobbyChatBox messages={lobbyMessages} />

      {isCommandConsoleOpen && (
        <CommandConsole
          value={commandConsoleValue}
          isVClipEnabled={isVClipEnabled}
          onChange={setCommandConsoleValue}
          onClose={() => closeCommandConsole()}
          onSubmit={submitCommandConsole}
        />
      )}

      {!localPlayerName && startMenuStage !== "press-start" && (
        <PlayerNamePrompt
          value={playerNameInput}
          onChange={setPlayerNameInput}
          onSubmit={submitPlayerName}
        />
      )}

      {/* Reticle */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none text-white text-xl">
         +
      </div>

      {health <= 0 && (
        <div className="absolute inset-0 bg-red-900/60 flex flex-col items-center justify-center">
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
          startMenuStage !== "resume" ? renderStartMenuContent() : (
          <>
            <div
              className="font-bold tracking-[0.1em] text-[#ffb347] drop-shadow-[4px_4px_0_theme(colors.purple.900)] font-mono text-center"
              style={{
                fontSize: 'clamp(2rem, 9vmin, 5.5rem)',
                lineHeight: 0.84,
                marginBottom: 'clamp(0.75rem, 4vmin, 3rem)',
              }}
            >
              WIZARDS<br/>ONLY<br/>FOOLS!
            </div>
            <div className="flex flex-col items-center pointer-events-auto" style={{ gap: 'clamp(0.5rem, 1.5vmin, 1rem)' }}>
              <div className={canLock ? "" : "cursor-not-allowed opacity-50"}>
                <div 
                  id="play-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    if (!canLock) {
                      return;
                    }
                    if (isTouchDevice) {
                      startTouchGameplay();
                      return;
                    }
                    closePauseMenu("mouse");
                  }}
                  onMouseEnter={() => setPauseMenuIndex(0)}
                  className={cn(
                    "font-bold uppercase tracking-wider shadow-[6px_6px_0_theme(colors.black)] font-mono text-center wizard-panel text-white transition-all",
                    canLock ? "cursor-pointer hover:brightness-125" : "",
                    mainMenuFocus(0) ? focusedMenuClass : ""
                  )}
                  style={{
                    pointerEvents: canLock ? 'auto' : 'none',
                    fontSize: 'clamp(0.9rem, 3vmin, 1.5rem)',
                    lineHeight: 1.1,
                    padding: 'clamp(0.45rem, 1.5vmin, 1rem) clamp(0.8rem, 3vmin, 2rem)',
                  }}
                >
                  {canLock ? (isTouchDevice ? "TAP TO PLAY" : "CLICK TO PLAY / START TO RESUME") : "PLEASE WAIT..."}
                </div>
              </div>
              
              {isMultiplayerMode && (
                <form
                  data-testid="invite-code-form"
                  className={cn(
                    "flex w-[min(92vw,520px)] flex-col gap-1 border-2 bg-black/45 p-2 text-cyan-50",
                    mainMenuFocus(1) ? "border-yellow-200 shadow-[0_0_18px_rgba(250,204,21,0.35)]" : "border-cyan-100/35"
                  )}
                  onSubmit={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    joinInviteCode();
                  }}
                  onMouseEnter={() => setPauseMenuIndex(1)}
                >
                  <div className="flex items-center justify-between gap-2 text-[clamp(0.56rem,1.4vmin,0.78rem)] tracking-widest text-cyan-100/80">
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
                      className="normal-case min-w-[180px] flex-1 border-2 border-[#888] border-b-[#222] border-r-[#222] bg-[#120c16] px-3 py-2 text-[clamp(0.68rem,1.9vmin,0.95rem)] text-white outline-none focus:border-yellow-200"
                      onChange={(e) => {
                        setInviteCodeInput(e.target.value);
                        setInviteCodeMessage("");
                      }}
                      onFocus={() => setPauseMenuIndex(1)}
                      onKeyDown={(e) => e.stopPropagation()}
                    />
                    <button
                      data-testid="invite-code-submit"
                      type="submit"
                      className="border-2 border-[#888] border-b-[#222] border-r-[#222] bg-[#555] px-4 py-2 text-[clamp(0.62rem,1.8vmin,0.9rem)] text-white hover:bg-[#666]"
                    >
                      JOIN
                    </button>
                  </div>
                  <div className="min-h-[1rem] text-[clamp(0.5rem,1.25vmin,0.68rem)] tracking-widest text-cyan-100/60">
                    {inviteCodeMessage || "TYPE THE SAME ROOM CODE ON EACH DEVICE"}
                  </div>
                </form>
              )}

              <div className="flex flex-wrap items-center justify-center gap-3" style={{ marginTop: 'clamp(0.25rem, 1.5vmin, 1rem)' }}>
                {isMultiplayerMode && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      copyInvite();
                    }}
                    onMouseEnter={() => setPauseMenuIndex(2)}
                    className={cn(
                      "flex items-center gap-2 bg-[#555] border-2 border-[#888] border-b-[#222] border-r-[#222] hover:bg-[#666] text-white shadow-lg cursor-pointer transition-all",
                      mainMenuFocus(2) ? focusedMenuClass : ""
                    )}
                    style={{
                      fontSize: 'clamp(0.7rem, 2vmin, 1rem)',
                      padding: 'clamp(0.35rem, 1vmin, 0.5rem) clamp(0.7rem, 2vmin, 1rem)',
                    }}
                  >
                    <Copy size={14} />
                    <span>COPY INVITE</span>
                  </button>
                )}
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowVideoMenu(true);
                    setSettingsPane("video");
                    setPauseMenuIndex(0);
                  }}
                  onMouseEnter={() => setPauseMenuIndex(isMultiplayerMode ? 3 : 1)}
                  className={cn(
                    "flex items-center gap-2 bg-[#555] border-2 border-[#888] border-b-[#222] border-r-[#222] hover:bg-[#666] text-white shadow-lg cursor-pointer transition-all uppercase tracking-widest font-bold",
                    mainMenuFocus(isMultiplayerMode ? 3 : 1) ? focusedMenuClass : ""
                  )}
                  style={{
                    fontSize: 'clamp(0.7rem, 2vmin, 1rem)',
                    padding: 'clamp(0.35rem, 1vmin, 0.5rem) clamp(0.7rem, 2vmin, 1rem)',
                  }}
                >
                  Settings
                </button>
              </div>
            </div>
          </>
          )
        ) : (
          <div
            className="settings-panel flex flex-col items-center gap-2 border-[3px] border-purple-500 bg-[#120c16] pointer-events-auto shadow-[0_0_28px_rgba(168,85,247,0.28)]"
            style={settingsMenuStyle}
          >
             <h2 className="text-white font-bold tracking-widest" style={{ fontSize: 'clamp(0.9rem, 2.8vmin, 1.3rem)', marginBottom: 'clamp(0.05rem, 0.45vmin, 0.5rem)' }}>SETTINGS</h2>

             <div className="grid w-full grid-cols-4 gap-2">
               <button
                 data-settings-index={0}
                 className={cn(
                   "border px-2 py-1 text-left font-mono tracking-widest uppercase transition-all",
                   settingsPane === "video" ? "border-yellow-400 bg-yellow-400/10 text-yellow-300" : "border-gray-600 text-gray-300 hover:border-gray-400",
                   settingsFocus(0) ? focusedMenuClass : ""
                 )}
                 style={{ fontSize: 'clamp(0.68rem, 1.7vmin, 0.9rem)' }}
                 onMouseEnter={() => setPauseMenuIndex(0)}
                 onMouseDown={(e) => e.stopPropagation()}
                 onClick={(e) => {
                   e.preventDefault();
                   e.stopPropagation();
                   setSettingsPane("video");
                   setPauseMenuIndex(0);
                 }}
               >
                 Video
               </button>
               <button
                 data-settings-index={1}
                 className={cn(
                   "border px-2 py-1 text-left font-mono tracking-widest uppercase transition-all",
                   settingsPane === "keybinds" ? "border-cyan-300 bg-cyan-300/10 text-cyan-100" : "border-gray-600 text-gray-300 hover:border-gray-400",
                   settingsFocus(1) ? focusedMenuClass : ""
                 )}
                 style={{ fontSize: 'clamp(0.68rem, 1.7vmin, 0.9rem)' }}
                 onMouseEnter={() => setPauseMenuIndex(1)}
                 onMouseDown={(e) => e.stopPropagation()}
                 onClick={(e) => {
                   e.preventDefault();
                   e.stopPropagation();
                   setSettingsPane("keybinds");
                   setPauseMenuIndex(1);
                 }}
               >
                 Keybinds
               </button>
               <button
                 data-settings-index={2}
                 className={cn(
                   "border px-2 py-1 text-left font-mono tracking-widest uppercase transition-all",
                   settingsPane === "voice" ? "border-emerald-300 bg-emerald-300/10 text-emerald-100" : "border-gray-600 text-gray-300 hover:border-gray-400",
                   settingsFocus(2) ? focusedMenuClass : ""
                 )}
                 style={{ fontSize: 'clamp(0.68rem, 1.7vmin, 0.9rem)' }}
                 onMouseEnter={() => setPauseMenuIndex(2)}
                 onMouseDown={(e) => e.stopPropagation()}
                 onClick={(e) => {
                   e.preventDefault();
                   e.stopPropagation();
                   setSettingsPane("voice");
                   setPauseMenuIndex(2);
                 }}
               >
                 Voice
               </button>
               <button
                 data-settings-index={3}
                 className={cn(
                   "border px-2 py-1 text-left font-mono tracking-widest uppercase transition-all",
                   settingsPane === "character" ? "border-pink-300 bg-pink-300/10 text-pink-100" : "border-gray-600 text-gray-300 hover:border-gray-400",
                   settingsFocus(3) ? focusedMenuClass : ""
                 )}
                 style={{ fontSize: 'clamp(0.68rem, 1.7vmin, 0.9rem)' }}
                 onMouseEnter={() => setPauseMenuIndex(3)}
                 onMouseDown={(e) => e.stopPropagation()}
                 onClick={(e) => {
                   e.preventDefault();
                   e.stopPropagation();
                   setSettingsPane("character");
                   setPauseMenuIndex(3);
                 }}
               >
                 Character
               </button>
             </div>

             {settingsPane === "video" ? (
               <div className="flex w-full flex-col gap-1">
                 <div className="text-gray-400" style={{ fontSize: 'clamp(0.6rem, 1.45vmin, 0.8rem)' }}>Aspect Ratio</div>
                 <div className="flex flex-col gap-1">
                   {aspectRatioOptions.map((ratio, index) => (
                     <button
                       key={ratio}
                       data-settings-index={index + videoAspectStartIndex}
                       className={cn(
                         "py-0.5 px-2 border text-left font-mono transition-all",
                         aspectRatio === ratio ? "border-yellow-400 text-yellow-400 bg-yellow-400/10" : "border-gray-600 text-gray-300 hover:border-gray-400",
                         settingsFocus(index + videoAspectStartIndex) ? focusedMenuClass : ""
                       )}
                       style={{ fontSize: 'clamp(0.72rem, 1.9vmin, 0.95rem)' }}
                       onMouseEnter={() => setPauseMenuIndex(index + videoAspectStartIndex)}
                       onMouseDown={(e) => e.stopPropagation()}
                       onClick={(e) => {
                         e.preventDefault();
                         e.stopPropagation();
                         if (aspectRatio !== ratio) {
                           setAspectRatio(ratio);
                         }
                       }}
                     >
                       {ratio}
                     </button>
                   ))}
                 </div>
               </div>
             ) : settingsPane === "keybinds" ? (
               <div ref={settingsScrollRef} className="menu-scroll-panel w-full overflow-y-auto pr-1" style={settingsScrollPanelStyle}>
                 <div className="mb-2 text-[9px] tracking-widest text-cyan-100/60">CONTROLS / REMAP</div>
                 <div className="mb-2 grid gap-2 md:grid-cols-3">
                   <div
                     data-settings-index={keybindSensitivityStartIndex}
                     className={cn(
                       "border p-2 text-left transition-all",
                       settingsFocus(keybindSensitivityStartIndex) ? focusedMenuClass : "border-cyan-300/25 bg-cyan-400/5"
                     )}
                     onMouseEnter={() => setPauseMenuIndex(keybindSensitivityStartIndex)}
                     onClick={() => setMouseSensitivity(getPlatformDefaultLookSensitivity())}
                   >
                     <div className="flex items-center justify-between text-[9px] tracking-widest text-cyan-100">
                       <span>Look Sensitivity</span>
                       <span>{Math.round((mouseSensitivity / DEFAULT_MOUSE_SENSITIVITY) * 100)}%</span>
                     </div>
                     <input
                       className="mt-2 w-full accent-yellow-300"
                       type="range"
                       min={0.0005}
                       max={0.006}
                       step={0.0001}
                       value={mouseSensitivity}
                       onChange={(e) => setMouseSensitivity(Number(e.currentTarget.value))}
                     />
                     <div className="mt-1 text-[7px] tracking-widest text-cyan-100/45">A resets, D-pad left/right adjusts</div>
                   </div>
                   <div
                     data-settings-index={keybindSensitivityStartIndex + 1}
                     className={cn(
                       "border p-2 text-left transition-all",
                       settingsFocus(keybindSensitivityStartIndex + 1) ? focusedMenuClass : "border-cyan-300/25 bg-cyan-400/5"
                     )}
                     onMouseEnter={() => setPauseMenuIndex(keybindSensitivityStartIndex + 1)}
                     onClick={() => setControllerLookSensitivity(DEFAULT_CONTROLLER_LOOK_SENSITIVITY)}
                   >
                     <div className="flex items-center justify-between text-[9px] tracking-widest text-cyan-100">
                       <span>Joystick Sensitivity</span>
                       <span>{Math.round((controllerLookSensitivity / DEFAULT_CONTROLLER_LOOK_SENSITIVITY) * 100)}%</span>
                     </div>
                     <input
                       className="mt-2 w-full accent-cyan-300"
                       type="range"
                       min={0.8}
                       max={6}
                       step={0.05}
                       value={controllerLookSensitivity}
                       onChange={(e) => setControllerLookSensitivity(Number(e.currentTarget.value))}
                     />
                     <div className="mt-1 text-[7px] tracking-widest text-cyan-100/45">A resets, D-pad left/right adjusts</div>
                   </div>
                   <button
                     data-settings-index={keybindArrowLookIndex}
                     className={cn(
                       "border p-2 text-left transition-all",
                       settingsFocus(keybindArrowLookIndex) ? focusedMenuClass : "border-cyan-300/25 bg-cyan-400/5 hover:border-cyan-200/70"
                     )}
                     onMouseEnter={() => setPauseMenuIndex(keybindArrowLookIndex)}
                     onClick={() => setKeyboardArrowLookEnabled(!keyboardArrowLookEnabled)}
                   >
                     <div className="flex items-center justify-between gap-3 text-[9px] tracking-widest text-cyan-100">
                       <span>Arrow Key Look</span>
                       <span className={keyboardArrowLookEnabled ? "text-lime-200" : "text-red-200"}>
                         {keyboardArrowLookEnabled ? "Enabled" : "Disabled"}
                       </span>
                     </div>
                     <div className="mt-2 text-[8px] leading-4 tracking-widest text-cyan-100/55">
                       Uses keyboard arrows to turn and aim while the mouse is locked in-game.
                     </div>
                     <div className="mt-1 text-[7px] tracking-widest text-cyan-100/45">Enter/A toggles, D-pad left/right toggles</div>
                   </button>
                 </div>

                 <div className="grid gap-2 md:grid-cols-[0.82fr_1.18fr]">
                   {keyboardKeybindRows.map((group) => (
                     <div key={group.title} className="border border-cyan-300/25 bg-cyan-400/5 p-2">
                       <div className="mb-1 border-b border-cyan-300/20 pb-1 text-[9px] tracking-[0.2em] text-cyan-100">{group.title}</div>
                       <div className="flex flex-col gap-1">
                         {group.rows.map(([action, bind]) => (
                           <div key={`${group.title}-${action}`} className="grid grid-cols-[0.9fr_1.25fr] gap-2 text-[8px] leading-4">
                             <span className="truncate text-cyan-100/55">{action}</span>
                             <span className="text-right text-white/85">{bind}</span>
                           </div>
                         ))}
                       </div>
                     </div>
                   ))}

                   <div className="border border-cyan-300/25 bg-cyan-400/5 p-2">
                     <div className="mb-1 border-b border-cyan-300/20 pb-1 text-[9px] tracking-[0.2em] text-cyan-100">Controller Remap</div>
                     <div className="flex flex-col gap-1">
                       {controllerActionRows.map((row, index) => {
                         const settingIndex = keybindControlStartIndex + index;
                         const isRemapping = remappingAction === row.action;
                         return (
                           <button
                             key={row.action}
                             data-settings-index={settingIndex}
                             className={cn(
                               "grid grid-cols-[1fr_auto] gap-2 border px-2 py-1 text-left text-[8px] leading-4 transition-all",
                               isRemapping
                                 ? "border-pink-300 bg-pink-400/15 text-pink-50 shadow-[0_0_16px_rgba(244,114,182,0.45)]"
                                 : settingsFocus(settingIndex)
                                   ? focusedMenuClass
                                   : "border-cyan-300/20 bg-black/25 text-cyan-100/85 hover:border-cyan-200/60"
                             )}
                             onMouseEnter={() => setPauseMenuIndex(settingIndex)}
                             onClick={() => beginControllerRemap(row.action)}
                           >
                             <span className="min-w-0">
                               <span className="block truncate text-cyan-50">{row.label}</span>
                               <span className="block truncate text-cyan-100/40">{isRemapping ? "Press any controller button..." : row.hint}</span>
                             </span>
                             <span className="self-center border border-yellow-200/50 bg-yellow-200/10 px-2 py-0.5 text-yellow-100">
                               {controllerButtonLabels[controllerBindings[row.action]]}
                             </span>
                           </button>
                         );
                       })}
                     </div>
                   </div>
                 </div>
               </div>
             ) : settingsPane === "voice" ? (
               <div ref={settingsScrollRef} className="menu-scroll-panel w-full overflow-y-auto pr-1" style={settingsScrollPanelStyle}>
                 <div className="mb-2 text-[9px] tracking-widest text-emerald-100/65">PROXIMITY VOICE / MIC</div>
                 {voiceNeedsSecureOrigin && (
                   <div className="mb-2 border border-yellow-300/60 bg-yellow-300/10 p-2 text-[8px] leading-4 tracking-widest text-yellow-100">
                     LAN mic access needs HTTPS. Restart with `npm run dev:https`, then join from the other PC using the HTTPS LAN URL.
                   </div>
                 )}
                 <div className="grid gap-2 md:grid-cols-2">
                   <button
                     data-settings-index={voiceEnabledIndex}
                     className={cn(
                       "border p-3 text-left transition-all",
                       settingsFocus(voiceEnabledIndex) ? focusedMenuClass : "border-emerald-300/25 bg-emerald-400/5 hover:border-emerald-200/70"
                     )}
                     onMouseEnter={() => setPauseMenuIndex(voiceEnabledIndex)}
                     onClick={() => setVoiceChatEnabled(!voiceChatEnabled)}
                   >
                     <div className="flex items-center justify-between gap-3 text-[10px] tracking-widest text-emerald-50">
                       <span>Voice Chat</span>
                       <span className={voiceChatEnabled ? "text-lime-200" : "text-red-200"}>
                         {voiceChatEnabled ? "Enabled" : "Disabled"}
                       </span>
                     </div>
                     <div className="mt-2 text-[8px] leading-4 tracking-widest text-emerald-100/45">
                       Turns your microphone and nearby player voices on or off.
                     </div>
                   </button>

                   <button
                     data-settings-index={voiceInputModeIndex}
                     className={cn(
                       "border p-3 text-left transition-all",
                       settingsFocus(voiceInputModeIndex) ? focusedMenuClass : "border-emerald-300/25 bg-emerald-400/5 hover:border-emerald-200/70"
                     )}
                     onMouseEnter={() => setPauseMenuIndex(voiceInputModeIndex)}
                     onClick={toggleVoiceInputMode}
                   >
                     <div className="flex items-center justify-between gap-3 text-[10px] tracking-widest text-emerald-50">
                       <span>Input Mode</span>
                       <span className="text-yellow-100">{voiceInputMode === "pushToTalk" ? "Press To Talk" : "Open Mic"}</span>
                     </div>
                     <div className="mt-2 text-[8px] leading-4 tracking-widest text-emerald-100/45">
                       D-pad left/right or A toggles between open mic and press-to-talk.
                     </div>
                   </button>

                   <button
                     data-settings-index={voicePushToTalkKeyIndex}
                     className={cn(
                       "border p-3 text-left transition-all",
                       remappingVoiceKey
                         ? "border-pink-300 bg-pink-400/15 text-pink-50 shadow-[0_0_16px_rgba(244,114,182,0.45)]"
                         : settingsFocus(voicePushToTalkKeyIndex)
                           ? focusedMenuClass
                           : "border-emerald-300/25 bg-emerald-400/5 hover:border-emerald-200/70"
                     )}
                     onMouseEnter={() => setPauseMenuIndex(voicePushToTalkKeyIndex)}
                     onClick={beginVoiceKeyRemap}
                   >
                     <div className="flex items-center justify-between gap-3 text-[10px] tracking-widest text-emerald-50">
                       <span>Press-To-Talk Key</span>
                       <span className="border border-yellow-200/50 bg-yellow-200/10 px-2 py-0.5 text-yellow-100">
                         {remappingVoiceKey ? "Press Key..." : formatKeyboardCode(voicePushToTalkKey)}
                       </span>
                     </div>
                     <div className="mt-2 text-[8px] leading-4 tracking-widest text-emerald-100/45">
                       Controller press-to-talk is remapped from the Keybinds tab.
                     </div>
                   </button>

                   <div
                     data-settings-index={voiceOutputVolumeIndex}
                     className={cn(
                       "border p-3 text-left transition-all",
                       settingsFocus(voiceOutputVolumeIndex) ? focusedMenuClass : "border-emerald-300/25 bg-emerald-400/5 hover:border-emerald-200/70"
                     )}
                     onMouseEnter={() => setPauseMenuIndex(voiceOutputVolumeIndex)}
                     onClick={() => setVoiceOutputVolume(DEFAULT_VOICE_OUTPUT_VOLUME)}
                   >
                     <div className="flex items-center justify-between gap-3 text-[10px] tracking-widest text-emerald-50">
                       <span>Voice Volume</span>
                       <span>{Math.round(voiceOutputVolume * 100)}%</span>
                     </div>
                     <input
                       className="mt-3 w-full accent-emerald-300"
                       type="range"
                       min={0}
                       max={1}
                       step={0.01}
                       value={voiceOutputVolume}
                       onMouseDown={(e) => e.stopPropagation()}
                       onClick={(e) => e.stopPropagation()}
                       onChange={(e) => setVoiceOutputVolume(Number(e.currentTarget.value))}
                     />
                     <div className="mt-1 text-[7px] tracking-widest text-emerald-100/45">A resets, D-pad left/right adjusts</div>
                   </div>

                   <div
                     data-settings-index={voiceProximityRangeIndex}
                     className={cn(
                       "border p-3 text-left transition-all",
                       settingsFocus(voiceProximityRangeIndex) ? focusedMenuClass : "border-emerald-300/25 bg-emerald-400/5 hover:border-emerald-200/70"
                     )}
                     onMouseEnter={() => setPauseMenuIndex(voiceProximityRangeIndex)}
                     onClick={() => setVoiceProximityRange(DEFAULT_VOICE_PROXIMITY_RANGE)}
                   >
                     <div className="flex items-center justify-between gap-3 text-[10px] tracking-widest text-emerald-50">
                       <span>Proximity Range</span>
                       <span>{Math.round(voiceProximityRange)}m</span>
                     </div>
                     <input
                       className="mt-3 w-full accent-lime-300"
                       type="range"
                       min={8}
                       max={64}
                       step={1}
                       value={voiceProximityRange}
                       onMouseDown={(e) => e.stopPropagation()}
                       onClick={(e) => e.stopPropagation()}
                       onChange={(e) => setVoiceProximityRange(Number(e.currentTarget.value))}
                     />
                     <div className="mt-1 text-[7px] tracking-widest text-emerald-100/45">Nearby voices fade out smoothly with distance.</div>
                   </div>

                   <div className="border border-emerald-300/25 bg-black/30 p-3 text-left">
                     <div className="flex items-center justify-between gap-3 text-[10px] tracking-widest text-emerald-50">
                       <span>Mic Status</span>
                       <span className={isVoiceSpeaking ? "text-lime-200" : "text-emerald-100/45"}>
                         {isVoiceSpeaking ? "Talking" : voiceChatEnabled ? "Quiet" : "Off"}
                       </span>
                     </div>
                     <div className="mt-2 h-2 overflow-hidden border border-emerald-200/30 bg-black">
                       <div
                         className={cn(
                           "h-full transition-all duration-100",
                           isVoiceSpeaking ? "bg-lime-300 shadow-[0_0_12px_rgba(190,242,100,0.85)]" : "bg-emerald-900"
                         )}
                         style={{ width: isVoiceSpeaking ? "100%" : voiceChatEnabled ? "32%" : "0%" }}
                       />
                     </div>
                     <div className="mt-2 text-[8px] leading-4 tracking-widest text-emerald-100/45">
                       Speaking animation is driven by detected mic volume, then synced to other players.
                     </div>
                     <div className={cn(
                       "mt-2 border px-2 py-1 text-[8px] leading-4 tracking-widest",
                       voiceError ? "border-red-300/50 bg-red-500/10 text-red-100" : "border-emerald-300/20 bg-emerald-400/5 text-emerald-100/65"
                     )}>
                       {voiceError ? `ERROR: ${voiceError}` : `STATUS: ${voiceStatus}`}
                     </div>
                   </div>
                 </div>
               </div>
             ) : (
               <div ref={settingsScrollRef} className="menu-scroll-panel w-full overflow-y-auto pr-1" style={settingsScrollPanelStyle}>
                 <div className="mb-2 text-[9px] tracking-widest text-pink-100/65">CHARACTER CUSTOMIZATION / BASE SPRITE</div>
                 <div className="character-menu-grid grid gap-3">
                   <div className="character-preview-card border border-pink-300/25 bg-pink-400/5 p-2">
                     <div className="mb-2 flex items-center justify-between gap-2 border-b border-pink-300/20 pb-1">
                       <div className="text-[9px] tracking-[0.2em] text-pink-100">Live Character View</div>
                       <button
                         className="border border-yellow-200/40 bg-yellow-200/10 px-2 py-1 text-[8px] tracking-widest text-yellow-100 hover:bg-yellow-200/20"
                         onClick={() => setCharacterCustomization({ ...DEFAULT_CHARACTER_CUSTOMIZATION })}
                       >
                         Reset Base
                       </button>
                     </div>
                     <CharacterPreview character={characterCustomization} />
                     <div className="mt-2 text-[8px] leading-4 tracking-widest text-pink-100/50">
                       Placeholder clothes and hair are procedural today; later sprite sheets can slot into these same style categories.
                     </div>
                   </div>

                   <div className="flex flex-col gap-2">
                     <div className="border border-pink-300/25 bg-pink-400/5 p-2">
                       <div className="mb-2 border-b border-pink-300/20 pb-1 text-[9px] tracking-[0.2em] text-pink-100">Colors</div>
                       <div className="character-control-grid grid gap-1.5">
                         {characterColorRows.map((row, index) => {
                           const settingIndex = characterColorStartIndex + index;
                           const rawValue = String(characterCustomization[row.key] ?? "");
                           const normalizedValue = normalizeHexInput(rawValue);
                           const fallbackValue = String(DEFAULT_CHARACTER_CUSTOMIZATION[row.key] ?? "#ffffff");
                           const pickerValue = isValidHexColor(normalizedValue) ? normalizedValue : fallbackValue;
                           return (
                             <div
                               key={row.key}
                               role="button"
                               tabIndex={0}
                               data-settings-index={settingIndex}
                               className={cn(
                                 "border bg-black/25 p-1.5 transition-all",
                                 settingsFocus(settingIndex) ? focusedMenuClass : "border-pink-300/20 hover:border-pink-200/60"
                               )}
                               onMouseEnter={() => setPauseMenuIndex(settingIndex)}
                               onClick={() => cycleCharacterColor(row.key, 1)}
                             >
                               <div className="mb-1 flex items-center justify-between gap-2 text-[8px] tracking-widest">
                                 <span className="text-pink-50">{row.label}</span>
                                 <span className={isValidHexColor(normalizedValue) ? "text-pink-100/50" : "text-red-200"}>{row.hint}</span>
                               </div>
                               <div className="grid grid-cols-[34px_1fr] gap-1">
                                 <input
                                   aria-label={`${row.label} color picker`}
                                   className="h-8 w-8 cursor-pointer border border-pink-200/40 bg-black"
                                   type="color"
                                   value={pickerValue}
                                   onMouseDown={(e) => e.stopPropagation()}
                                   onClick={(e) => e.stopPropagation()}
                                   onChange={(e) => updateCharacterField(row.key, e.currentTarget.value)}
                                 />
                                 <input
                                   aria-label={`${row.label} hex color`}
                                   className={cn(
                                     "min-w-0 border bg-black/55 px-2 text-[10px] tracking-widest outline-none",
                                     isValidHexColor(normalizedValue) ? "border-pink-300/25 text-pink-50 focus:border-yellow-200" : "border-red-300/70 text-red-100"
                                   )}
                                   value={rawValue}
                                   spellCheck={false}
                                   onMouseDown={(e) => e.stopPropagation()}
                                   onClick={(e) => e.stopPropagation()}
                                   onChange={(e) => updateCharacterField(row.key, normalizeHexInput(e.currentTarget.value))}
                                 />
                               </div>
                               <div className="mt-1 grid grid-cols-[18px_1fr_18px] items-center gap-1">
                                 <button
                                   className="border border-pink-200/30 bg-pink-200/10 text-[8px] text-pink-50 hover:bg-pink-200/20"
                                   onMouseDown={(e) => e.stopPropagation()}
                                   onClick={(e) => {
                                     e.stopPropagation();
                                     cycleCharacterColor(row.key, -1);
                                   }}
                                 >
                                   &lt;
                                 </button>
                                 <div className="flex min-w-0 justify-center gap-1">
                                   {characterColorPresets.map((preset) => (
                                     <span
                                       key={`${row.key}-${preset}`}
                                       className={cn(
                                         "h-3 w-3 border",
                                         pickerValue.toLowerCase() === preset.toLowerCase()
                                           ? "border-yellow-200 shadow-[0_0_8px_rgba(250,204,21,0.75)]"
                                           : "border-white/20"
                                       )}
                                       style={{ backgroundColor: preset }}
                                     />
                                   ))}
                                 </div>
                                 <button
                                   className="border border-pink-200/30 bg-pink-200/10 text-[8px] text-pink-50 hover:bg-pink-200/20"
                                   onMouseDown={(e) => e.stopPropagation()}
                                   onClick={(e) => {
                                     e.stopPropagation();
                                     cycleCharacterColor(row.key, 1);
                                   }}
                                 >
                                   &gt;
                                 </button>
                               </div>
                               <div className="mt-1 text-[7px] tracking-widest text-pink-100/45">
                                 Controller: A or D-pad left/right cycles presets. Keyboard/mouse: type exact hex.
                               </div>
                             </div>
                           );
                         })}
                       </div>
                     </div>

                     <div className="border border-cyan-300/25 bg-cyan-400/5 p-2">
                       <div className="mb-2 border-b border-cyan-300/20 pb-1 text-[9px] tracking-[0.2em] text-cyan-100">Body, Hair & Eyes</div>
                       <div className="character-control-grid grid gap-1.5">
                         {characterStyleRows.map((row, index) => {
                           const settingIndex = characterStyleStartIndex + index;
                           const currentValue = String(characterCustomization[row.key] ?? row.options[0]);
                           return (
                             <button
                               key={row.key}
                               data-settings-index={settingIndex}
                               className={cn(
                                 "grid grid-cols-[1fr_auto] gap-2 border px-2 py-1.5 text-left text-[8px] leading-4 transition-all",
                                 settingsFocus(settingIndex)
                                   ? focusedMenuClass
                                   : "border-cyan-300/20 bg-black/25 text-cyan-100/85 hover:border-cyan-200/60"
                               )}
                               onMouseEnter={() => setPauseMenuIndex(settingIndex)}
                               onClick={() => cycleCharacterStyle(row.key, row.options, 1)}
                             >
                               <span className="truncate text-cyan-50">{row.label}</span>
                               <span className="border border-yellow-200/50 bg-yellow-200/10 px-2 py-0.5 text-yellow-100">
                                 {formatCharacterOption(currentValue)}
                               </span>
                             </button>
                           );
                         })}
                       </div>
                     </div>

                     <div className="border border-yellow-200/30 bg-yellow-200/10 p-2 shadow-[0_0_18px_rgba(250,204,21,0.08)]">
                       <div className="mb-2 border-b border-yellow-200/25 pb-1 text-[9px] tracking-[0.2em] text-yellow-100">Mouth</div>
                       <div className="character-control-grid grid gap-1.5">
                         {characterMouthRows.map((row, index) => {
                           const settingIndex = characterMouthStartIndex + index;
                           const currentValue = String(characterCustomization[row.key] ?? row.options[0]);
                           return (
                             <button
                               key={row.key}
                               data-settings-index={settingIndex}
                               className={cn(
                                 "grid grid-cols-[1fr_auto] gap-2 border px-2 py-1.5 text-left text-[8px] leading-4 transition-all",
                                 settingsFocus(settingIndex)
                                   ? focusedMenuClass
                                   : "border-yellow-200/25 bg-black/30 text-yellow-100/85 hover:border-yellow-100/70"
                               )}
                               onMouseEnter={() => setPauseMenuIndex(settingIndex)}
                               onClick={() => cycleCharacterStyle(row.key, row.options, 1)}
                             >
                               <span className="truncate text-yellow-50">{row.label}</span>
                               <span className="border border-pink-200/50 bg-pink-200/10 px-2 py-0.5 text-pink-100">
                                 {formatCharacterOption(currentValue)}
                               </span>
                             </button>
                           );
                         })}
                       </div>
                     </div>
                   </div>
                 </div>
               </div>
             )}

             <button 
               data-settings-index={settingsBackIndex}
               className={cn(
                 "mt-1 bg-gray-800 border-[3px] border-gray-600 hover:bg-gray-700 text-white px-5 py-0.5 font-mono tracking-widest uppercase w-full transition-all",
                 settingsFocus(settingsBackIndex) ? focusedMenuClass : ""
               )}
               style={{ fontSize: 'clamp(0.78rem, 2vmin, 1rem)' }}
               onMouseEnter={() => setPauseMenuIndex(settingsBackIndex)}
               onClick={() => {
                 setShowVideoMenu(false);
                 setSettingsPane("video");
                 setRemappingAction(null);
                 setRemappingVoiceKey(false);
                 setPauseMenuIndex(3);
               }}
             >
               Back
             </button>
          </div>
        )}
        </div>
      </div>,
      document.body
      )}

      {isFullscreenHintOpen && createPortal(
        <div
          data-testid="fullscreen-help"
          className="fixed inset-0 z-[190] flex items-center justify-center bg-black/72 px-4 font-mono uppercase text-white pointer-events-auto"
          style={{ width: "var(--app-vw, 100dvw)", height: "var(--app-vh, 100dvh)" }}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          <div className="max-w-[520px] border-2 border-cyan-200/70 bg-[#090510]/95 p-4 text-center shadow-[0_0_32px_rgba(34,211,238,0.38)]">
            <div className="text-lg tracking-[0.22em] text-cyan-100">Full Screen</div>
            <div className="mt-3 text-[10px] leading-5 tracking-widest text-cyan-50/80">
              Android Chrome can enter full screen from the FULL button. iOS Safari blocks that API, so use Share, Add to Home Screen, then launch Wizards from the new icon for the cleanest full-screen mode.
            </div>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <button
                className="border border-cyan-200/70 bg-cyan-300/10 px-4 py-2 text-[10px] tracking-widest text-cyan-50 hover:bg-cyan-200/20"
                onClick={() => requestMobileFullscreen(true)}
              >
                Try Again
              </button>
              <button
                className="border border-yellow-200/70 bg-yellow-300/10 px-4 py-2 text-[10px] tracking-widest text-yellow-50 hover:bg-yellow-200/20"
                onClick={() => setIsFullscreenHintOpen(false)}
              >
                OK
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
       
      {isSpellMenuPreloaded && (
        <div style={{ display: isSpellMenuOpen ? "contents" : "none" }} aria-hidden={!isSpellMenuOpen}>
          <SpellMenu
            menuSpellIndex={menuSpellIndex}
            setMenuSpellIndex={setMenuSpellIndex}
            onClose={closeSpellMenuAndResume}
            bindingHand={activeBindingHand}
          />
        </div>
      )}

      {isScoreboardOpen && !isSpellMenuOpen && (
        <PlayerScoreMenu rows={scoreboardRows} />
      )}

      {isReturningToGame && !isLocked && !controllerGameplayActive && !isSpellMenuOpen && (
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
      {(shouldRenderGameplayHud || isSpellMenuOpen) && !isMapExpanded && (
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
      {touchGameplayActive && !isSpellMenuOpen && !isMapExpanded && !isScoreboardOpen && (
        <MobileTouchControls
          openSpellMenu={openSpellMenuFromGame}
          pauseTouchGameplay={pauseTouchGameplay}
        />
      )}

      {shouldRenderGameplayHud && !isSpellMenuOpen && !isMapExpanded && !isScoreboardOpen && (
      <div className="hud-shell absolute bottom-0 left-0 w-full z-50 pointer-events-none">
         {/* RUNE TIMER BAR */}
         <div
           className="mana-meter absolute left-1/2 -translate-x-1/2 bg-[#211627] border-[3px] border-[#120c16] rounded-xl overflow-hidden flex flex-col p-1 pointer-events-none shadow-[0_4px_10px_rgba(0,0,0,0.8)]"
           style={{
             bottom: 'calc(var(--hud-status-height) + 10px)',
             width: 'min(clamp(220px, 72%, 400px), calc(100% - 32px))',
           }}
         >
            <div className="mana-meter-title flex justify-center px-3 items-center text-[12px] text-[#a8a8a8] z-10 drop-shadow-[1px_1px_0_theme(colors.black)] font-mono pb-1 tracking-widest">
               <span>MANA</span>
            </div>
            <div className="mana-meter-bar w-full h-5 bg-black rounded-lg relative overflow-hidden box-content shadow-[inset_0_2px_4px_rgba(0,0,0,0.8)] flex gap-1">
               {/* Left Bar */}
               <div className="flex-1 relative bg-[#1a0e24]">
                  <div 
                     className="absolute inset-y-0 left-0 bg-[#a855f7] shadow-[0_0_10px_rgba(168,85,247,0.8)] transition-all duration-300 ease-linear"
                     style={{ width: `${(leftRunePower / RUNE_POWER_MAX) * 100}%` }}
                  />
               </div>
               
               {/* Middle Separator */}
               <div className="w-[2px] bg-[#120c16] shrink-0" />
               
               {/* Right Bar */}
               <div className="flex-1 relative bg-[#1a0e24]">
                  <div 
                     className="absolute inset-y-0 right-0 bg-[#a855f7] shadow-[0_0_10px_rgba(168,85,247,0.8)] transition-all duration-300 ease-linear"
                     style={{ width: `${(rightRunePower / RUNE_POWER_MAX) * 100}%` }}
                  />
               </div>
            </div>
         </div>
         
         {/* WIZARD STATUS BAR */}
         <div className="w-full wizard-panel flex items-center justify-between px-2 sm:px-4 overflow-hidden pointer-events-auto border-t-[6px] border-[#5d466e]" style={{ height: 'var(--hud-status-height)' }}>
           <div className="hud-status-grid grid grid-cols-4 gap-1 sm:gap-2 md:gap-4 w-full h-full items-stretch p-1 sm:p-2">
              
              {/* SPELLS (GRIMOIRE) */}
              <div className="flex-1 flex flex-col items-center justify-center wizard-inset h-full overflow-hidden">
                <div className="hud-panel-title text-[#a8a8a8] text-[clamp(7px,1.2vw,12px)] mb-1 tracking-widest font-mono">GRIMOIRE</div>
                <div className="hud-hotkey-list flex w-full flex-col gap-1 px-1.5 sm:px-3 pb-1 text-[clamp(6px,1.05vw,11px)] font-sans">
                   <div className="hud-hotkey-row flex items-center gap-2">
                     <span className={cn("hud-hotkey-label w-5 text-[8px]", activeHand === "left" ? "text-yellow-300" : "text-[#555]")}>L</span>
                     <div className="hud-hotkey-slots flex flex-1 justify-between gap-1">
                       {leftHotbarSpells.map((s, idx) => (
                        <div key={`left-${s}-${idx}`} className={cn(
                          "min-w-0 px-px transition-all duration-300",
                          leftSelectedHotbarIndex === idx ? (s === 'lightning' ? "text-blue-300 drop-shadow-[1px_1px_0_theme(colors.black)] font-bold scale-110" : "text-yellow-400 drop-shadow-[1px_1px_0_theme(colors.black)] font-bold scale-110") : "text-[#555]"
                        )}>
                            {hotkeyLabels[idx]}
                         </div>
                       ))}
                     </div>
                   </div>
                   <div className="hud-hotkey-row flex items-center gap-2">
                     <span className={cn("hud-hotkey-label w-5 text-[8px]", activeHand === "right" ? "text-fuchsia-300" : "text-[#555]")}>R</span>
                     <div className="hud-hotkey-slots flex flex-1 justify-between gap-1">
                       {rightHotbarSpells.map((s, idx) => (
                        <div key={`right-${s}-${idx}`} className={cn(
                          "min-w-0 px-px transition-all duration-300",
                          rightSelectedHotbarIndex === idx ? "text-fuchsia-300 drop-shadow-[1px_1px_0_theme(colors.black)] font-bold scale-110" : "text-[#555]"
                        )}>
                            {hotkeyLabels[idx]}
                         </div>
                       ))}
                     </div>
                   </div>
                 </div>
              </div>

              {/* CURRENT SPELL NAME */}
              <div className="flex-1 flex flex-col items-center justify-center wizard-inset h-full overflow-hidden">
                 <div className="hud-panel-title text-[clamp(8px,1.3vw,12px)] text-[#a8a8a8] mb-1 tracking-widest font-mono">SPELLS</div>
                 <div className={cn(
                    "hud-spell-line max-w-full truncate px-1 text-center leading-none drop-shadow-[2px_2px_0_theme(colors.black)] font-mono",
                    leftRuneReady ? spellColors[leftCurrentSpell] : "text-[#555]"
                 )}
                 style={{ fontSize: 'clamp(0.52rem, 1.45vw, 1.05rem)' }}>
                    L {leftRuneReady ? spellNames[leftCurrentSpell] : "No Mana"}
                 </div>
                 <div className={cn(
                    "hud-spell-line max-w-full truncate px-1 text-center leading-none drop-shadow-[2px_2px_0_theme(colors.black)] font-mono",
                    rightRuneReady ? spellColors[rightCurrentSpell] : "text-[#555]"
                 )}
                 style={{ fontSize: 'clamp(0.52rem, 1.45vw, 1.05rem)' }}>
                    R {rightRuneReady ? spellNames[rightCurrentSpell] : "No Mana"}
                 </div>
                 {hasActiveBuff && (
                   <div className="hud-buff-list mt-1 flex max-w-full flex-wrap justify-center gap-1 text-[8px] leading-3 tracking-widest">
                     {speedBoostSeconds > 0 && <span className="border border-yellow-300/50 bg-yellow-500/15 px-1 text-yellow-200">SPD {speedBoostSeconds}s</span>}
                     {jumpBoostSeconds > 0 && <span className="border border-lime-300/50 bg-lime-500/15 px-1 text-lime-200">JMP {jumpBoostSeconds}s</span>}
                     {slowSeconds > 0 && <span className="border border-slate-300/50 bg-slate-500/20 px-1 text-slate-100">SLOW {slowSeconds}s</span>}
                     {sleepSeconds > 0 && <span className="border border-sky-200/50 bg-sky-500/20 px-1 text-sky-100">SLEEP {sleepSeconds}s</span>}
                     {poisonSeconds > 0 && <span className="border border-purple-300/50 bg-purple-500/20 px-1 text-purple-100">POISON {poisonSeconds}s</span>}
                     {acidSeconds > 0 && <span className="border border-green-300/50 bg-green-500/20 px-1 text-green-100">ACID {acidSeconds}s</span>}
                     {glassOrbActive && <span className="border border-cyan-100/50 bg-cyan-400/15 px-1 text-cyan-50">ORB</span>}
                   </div>
                 )}
              </div>

              {/* HEALTH (VITALITY) */}
              <div className="hud-vitality-panel flex-1 flex flex-col items-center justify-center wizard-inset h-full px-2 sm:px-4">
                 <div className="hud-panel-title text-[12px] text-[#a8a8a8] mb-1 tracking-widest font-mono">VITALITY</div>
                 {(poisonSeconds > 0 || acidSeconds > 0) && (
                   <div className="mb-1 flex w-full flex-col gap-0.5">
                     {poisonSeconds > 0 && (
                       <div className="relative h-2 w-full overflow-hidden border border-purple-300/45 bg-black shadow-[0_0_8px_rgba(168,85,247,0.45)]">
                         <div
                           className="absolute inset-y-0 left-0 bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.95)] transition-all duration-200"
                           style={{ width: `${poisonPercent}%` }}
                         />
                       </div>
                     )}
                     {acidSeconds > 0 && (
                       <div className="relative h-2 w-full overflow-hidden border border-green-300/45 bg-black shadow-[0_0_8px_rgba(34,197,94,0.45)]">
                         <div
                           className="absolute inset-y-0 left-0 bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.95)] transition-all duration-200"
                           style={{ width: `${acidPercent}%` }}
                         />
                       </div>
                     )}
                   </div>
                 )}
                 <div className="hud-health-bar relative h-5 w-full overflow-hidden border border-red-300/55 bg-black shadow-[inset_0_0_8px_rgba(0,0,0,0.9),0_0_10px_rgba(239,68,68,0.3)]">
                    <div
                      className="absolute inset-y-0 left-0 bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.9)] transition-all duration-200"
                      style={{ width: `${healthPercent}%` }}
                    />
                    <div className="hud-bar-label absolute inset-0 flex items-center justify-between px-2 text-[9px] leading-none text-red-50 drop-shadow-[1px_1px_0_theme(colors.black)]">
                      <span>HEALTH</span>
                      <span>{Math.round(health)}%</span>
                    </div>
                 </div>
                 <div className="hud-armor-bar relative mt-1 h-5 w-full overflow-hidden border border-sky-200/55 bg-black shadow-[inset_0_0_8px_rgba(0,0,0,0.9),0_0_10px_rgba(56,189,248,0.35)]">
                    <div
                      className="absolute inset-y-0 left-0 bg-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.95)] transition-all duration-200"
                      style={{ width: `${armorPercent}%` }}
                    />
                    <div className="hud-bar-label absolute inset-0 flex items-center justify-between px-2 text-[9px] leading-none text-sky-50 drop-shadow-[1px_1px_0_theme(colors.black)]">
                      <span>ARMOR</span>
                      <span>{Math.round(armor)}/{ARMOR_MAX}</span>
                    </div>
                 </div>
              </div>

              {/* MANA (AETHER) */}
              <div className="hud-aether-panel flex-1 flex flex-col items-center justify-center wizard-inset h-full px-2 sm:px-4">
                 <div className="hud-panel-title text-[12px] text-[#a8a8a8] mb-2 tracking-widest font-mono">AETHER</div>
                 <div className="w-full">
                    <div className="hud-aether-bar w-full h-6 bg-black border border-[#211627] relative overflow-hidden box-content shadow-[0_0_0_2px_#4a3359]">
                       <div 
                         className="absolute inset-y-0 left-0 bg-blue-500"
                         style={{ width: `${thrusterFuel * 100}%` }}
                       />
                    </div>
                 </div>
              </div>

           </div>
         </div>
      </div>
      )}
    </div>
  );
}
