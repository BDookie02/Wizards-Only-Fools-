import { useEffect, Component, ReactNode, lazy, Suspense, useState, useRef } from 'react';
import {
  ASPECT_RATIO_STORAGE_KEY,
  CharacterCustomization,
  DEFAULT_MOBILE_LOOK_SENSITIVITY,
  DEFAULT_MOUSE_SENSITIVITY,
  GameMode,
  SurvivalGameMode,
  getSurvivalLevelXpTarget,
  sanitizeAspectRatio,
  sanitizePlayerName,
  useGameStore,
} from './store/gameStore';
import { isMobileLikeDevice } from './game/performanceMode';
import { getGamepadAxis, getPrimaryGamepad, isGamepadButtonPressed, type GamepadButtonName } from './game/controllerInput';
import { drawPixelAvatarFrame } from './game/PixelAvatar';

const loadHUDModule = () => import('./game/HUD').then((module) => ({ default: module.HUD }));
const loadGameWorldModule = () => import('./game/GameWorld').then((module) => ({ default: module.GameWorld }));
const loadMiniMapModule = () => import('./components/MiniMap').then((module) => ({ default: module.MiniMap }));

const LazyHUD = lazy(loadHUDModule);
const LazyGameWorld = lazy(loadGameWorldModule);
const LazyVoiceChat = lazy(() => import('./game/VoiceChat').then((module) => ({ default: module.VoiceChat })));
const LazyMiniMap = lazy(loadMiniMapModule);

type IdleSchedulerWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
};

function scheduleGameplayPreload(callback: () => void) {
  if (typeof window === 'undefined') return () => {};

  const idleWindow = window as IdleSchedulerWindow;
  if (typeof idleWindow.requestIdleCallback === 'function') {
    const handle = idleWindow.requestIdleCallback(callback, { timeout: 1200 });
    return () => idleWindow.cancelIdleCallback?.(handle);
  }

  const timer = window.setTimeout(callback, 650);
  return () => window.clearTimeout(timer);
}

function preloadGameplayModules() {
  void Promise.all([
    loadGameWorldModule(),
    loadHUDModule(),
    loadMiniMapModule(),
  ]).catch(() => undefined);
}

class ErrorBoundary extends Component<{children: ReactNode}, {error: Error | null}> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return <div className="text-red-500 z-50 absolute p-10 bg-black inset-0">{String((this.state.error as Error).stack || this.state.error)}</div>;
    }
    return this.props.children;
  }
}

function sanitizeInviteRoomCode(value: string) {
  return value
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .slice(0, 64);
}

function extractInviteRoomCode(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';

  try {
    const url = new URL(trimmed, window.location.origin);
    const room = url.searchParams.get('room');
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

function getCurrentRoomCode() {
  if (typeof window === 'undefined') return '';
  return sanitizeInviteRoomCode(new URLSearchParams(window.location.search).get('room') || '');
}

function getMobileInviteUrl(roomCode: string, lanInfo?: LanInfoResponse) {
  if (typeof window === 'undefined') return '';
  const room = extractInviteRoomCode(roomCode);
  if (!room) return '';

  const url = new URL(window.location.href);
  url.searchParams.set('room', room);
  url.searchParams.set('mobilePerf', '1');

  const lanAddress = lanInfo?.lanAddresses?.[0];
  const httpPort = lanInfo?.httpPort;
  if (lanAddress && httpPort) {
    return `http://${lanAddress}:${httpPort}${url.pathname}?${url.searchParams.toString()}`;
  }

  return url.toString();
}

function applyRoomCode(value: string) {
  if (typeof window === 'undefined') return '';
  const room = extractInviteRoomCode(value);
  const url = new URL(window.location.href);
  if (room) url.searchParams.set('room', room);
  else url.searchParams.delete('room');
  window.history.replaceState(null, '', url.toString());
  return room;
}

function makeDefaultWizardName() {
  return `Wizard ${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function makeDefaultRoomCode() {
  return `wof-${Math.random().toString(36).slice(2, 7)}`;
}

type LaunchMenuStage = 'press' | 'save' | 'new' | 'multiplayer' | 'custom' | 'survival';

type LanInfoResponse = {
  lanAddresses?: string[];
  httpPort?: number;
  httpsPort?: number | null;
  secure?: boolean;
};

const launchColorPresets = [
  '#d6cf91',
  '#8d5524',
  '#c68642',
  '#f1c27d',
  '#ffdbac',
  '#f472b6',
  '#60a5fa',
  '#22c55e',
  '#facc15',
  '#f8fafc',
];

const launchHatStyles: CharacterCustomization['hatStyle'][] = ['none', 'wizard', 'floppy-wizard', 'cap', 'hood', 'pharaoh'];
const launchHairStyles: CharacterCustomization['hairStyle'][] = ['none', 'short', 'bob', 'spikes', 'long'];
const newSurvivalActionCount = 8;
type MenuDirection = 'up' | 'down' | 'left' | 'right';

function getLaunchMenuOptionCount(stage: LaunchMenuStage) {
  if (stage === 'save') return 3;
  if (stage === 'new') return newSurvivalActionCount;
  if (stage === 'multiplayer') return 3;
  if (stage === 'custom' || stage === 'survival') return 3;
  return 1;
}

function wrapLaunchMenuIndex(index: number, count: number) {
  return ((index % count) + count) % count;
}

function clampLaunchMenuIndex(index: number, count: number) {
  return Math.max(0, Math.min(count - 1, index));
}

function findDirectionalMenuIndex(selector: string, attribute: string, currentIndex: number, direction: MenuDirection, count: number) {
  if (typeof document === 'undefined') return clampLaunchMenuIndex(currentIndex, count);

  const targets = Array.from(document.querySelectorAll<HTMLElement>(selector))
    .map((element) => ({
      element,
      index: Number(element.getAttribute(attribute)),
      rect: element.getBoundingClientRect(),
    }))
    .filter(({ element, index, rect }) => (
      Number.isFinite(index) &&
      !element.hasAttribute('disabled') &&
      rect.width > 0 &&
      rect.height > 0
    ));
  const current = targets.find((target) => target.index === currentIndex);

  if (!current) {
    const fallbackDelta = direction === 'down' || direction === 'right' ? 1 : -1;
    return clampLaunchMenuIndex(currentIndex + fallbackDelta, count);
  }

  const currentCenterX = current.rect.left + current.rect.width / 2;
  const currentCenterY = current.rect.top + current.rect.height / 2;
  const isVertical = direction === 'up' || direction === 'down';
  const candidates = targets
    .filter((target) => target.index !== currentIndex)
    .map((target) => {
      const centerX = target.rect.left + target.rect.width / 2;
      const centerY = target.rect.top + target.rect.height / 2;
      const primaryDistance =
        direction === 'up' ? currentCenterY - centerY :
        direction === 'down' ? centerY - currentCenterY :
        direction === 'left' ? currentCenterX - centerX :
        centerX - currentCenterX;
      if (primaryDistance <= 4) return null;

      const perpendicularDistance = isVertical
        ? Math.abs(centerX - currentCenterX)
        : Math.abs(centerY - currentCenterY);
      const overlaps = isVertical
        ? target.rect.right >= current.rect.left && target.rect.left <= current.rect.right
        : target.rect.bottom >= current.rect.top && target.rect.top <= current.rect.bottom;
      const score = primaryDistance * 1000 + perpendicularDistance + (overlaps ? 0 : 500);
      return { index: target.index, score };
    })
    .filter((candidate): candidate is { index: number; score: number } => candidate !== null)
    .sort((a, b) => a.score - b.score);

  return candidates[0]?.index ?? currentIndex;
}

type LaunchInputSource = 'mouse' | 'controller';

function cycleLaunchOption<T>(options: T[], current: T, direction: 1 | -1 = 1) {
  const index = Math.max(0, options.indexOf(current));
  return options[wrapLaunchMenuIndex(index + direction, options.length)];
}

function formatLaunchOption(value: string) {
  return value
    .split(/(?=[A-Z])|[-_\s]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function LaunchCharacterPreview({ character }: { character: CharacterCustomization }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const size = 180;
    const scale = 2;
    canvas.width = size * scale;
    canvas.height = size * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.fillStyle = '#090510';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = 'rgba(34, 211, 238, 0.08)';
    for (let x = 0; x < size; x += 12) ctx.fillRect(x, 0, 1, size);
    for (let y = 0; y < size; y += 12) ctx.fillRect(0, y, size, 1);
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(12, 10, size - 24, size - 20);
    drawPixelAvatarFrame(ctx, {
      character,
      direction: 0,
      animation: 'holding',
      frame: 0,
      x: 26,
      y: 28,
      scale: 1.35,
      detailScale: 1.35,
    });
  }, [character]);

  return (
    <canvas
      ref={canvasRef}
      className="h-auto w-full border border-yellow-200/35 bg-black"
      style={{ imageRendering: 'pixelated' }}
    />
  );
}

function isDevSurvivalObserver() {
  if (!import.meta.env.DEV || typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.get('qaSurvival') === '1' ||
    params.has('qaSurvivalChunk') ||
    params.get('spawnMountain') === '1' ||
    params.get('spawnGraveyard') === '1';
}

function LaunchMenu() {
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
  const [stage, setStage] = useState<LaunchMenuStage>('press');
  const [playerNameInput, setPlayerNameInput] = useState(() => localPlayerName || survivalSave?.playerName || makeDefaultWizardName());
  const [inviteCodeInput, setInviteCodeInput] = useState(() => getCurrentRoomCode() || makeDefaultRoomCode());
  const [mobileInviteUrl, setMobileInviteUrl] = useState(() => getMobileInviteUrl(getCurrentRoomCode()));
  const [mobileInviteMessage, setMobileInviteMessage] = useState('');
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
      characterCustomization,
      mode,
    });
  };

  const enterInviteFlow = (inputSource: LaunchInputSource = 'mouse') => {
    const room = getCurrentRoomCode();
    if (!room) {
      setStage('save');
      return;
    }

    setInviteCodeInput(room);
    setControllerMenuIndex(0);
    if (!survivalSave) {
      setStage('new');
      setControllerMenuIndex(6);
      return;
    }

    continueSurvivalSave('multiplayer-survival');
    setStage('survival');
    setControllerGameplayActive(inputSource === 'controller');
  };

  const beginNewSurvival = (mode: SurvivalGameMode, inputSource: LaunchInputSource = 'mouse') => {
    const profile = createSurvivalProfile(mode);
    if (!profile) return;

    if (mode === 'multiplayer-survival') {
      setStage('survival');
      setControllerMenuIndex(0);
      return;
    }

    launchMode('solo-survival', false, inputSource);
  };

  const continueSavedSurvival = (inputSource: LaunchInputSource = 'mouse') => {
    if (!survivalSave) return;
    const mode = survivalSave.lastMode;
    if (!continueSurvivalSave(mode)) return;

    if (mode === 'multiplayer-survival') {
      setStage('survival');
      setControllerMenuIndex(0);
      return;
    }

    launchMode('solo-survival', false, inputSource);
  };

  const launchMode = (mode: GameMode, useInviteCode = false, inputSource: LaunchInputSource = 'mouse') => {
    const isSurvivalMode = mode === 'solo-survival' || mode === 'multiplayer-survival';
    if (isSurvivalMode) {
      if (survivalSave) {
        saveSurvivalProgress({ lastMode: mode });
      } else if (!createSurvivalProfile(mode)) {
        setStage('new');
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
    setControllerGameplayActive(inputSource === 'controller');
    setGameMode(mode);
    setGameLaunched(true);
    if (inputSource === 'controller') {
      window.setTimeout(() => window.dispatchEvent(new Event('controller-gameplay-started')), 0);
    }
  };

  const goBack = () => {
    if (stage === 'press') return;
    if (stage === 'save') {
      setStage('press');
      return;
    }
    if (stage === 'new') {
      setStage('save');
      return;
    }
    if (stage === 'multiplayer') {
      setStage('save');
      return;
    }
    setStage('multiplayer');
  };

  const runControllerMenuAction = (index: number) => {
    if (stage === 'press') {
      enterInviteFlow('controller');
      return;
    }

    if (stage === 'save') {
      if (index === 0) {
        setStage('new');
        return;
      }
      if (index === 1) {
        continueSavedSurvival('controller');
        return;
      }
      setStage('multiplayer');
      return;
    }

    if (stage === 'new') {
      if (index === 0) updateOutfitColor();
      else if (index === 1) updateSkinColor();
      else if (index === 2) updateHairColor();
      else if (index === 3) updateHatStyle();
      else if (index === 4) updateHairStyle();
      else if (index === 5) beginNewSurvival('solo-survival', 'controller');
      else if (index === 6) beginNewSurvival('multiplayer-survival', 'controller');
      else setStage('save');
      return;
    }

    if (stage === 'multiplayer') {
      if (index === 0) setStage('custom');
      else if (index === 1) {
        if (!survivalSave) {
          setStage('new');
          setControllerMenuIndex(6);
          return;
        }
        continueSurvivalSave('multiplayer-survival');
        setStage('survival');
      }
      else setStage('save');
      return;
    }

    if (stage === 'custom' || stage === 'survival') {
      if (index === 0) {
        launchMode(stage === 'custom' ? 'custom-lobby' : 'multiplayer-survival', true, 'controller');
      } else if (index === 1) {
        copyMobileInvite();
      } else {
        setStage('multiplayer');
      }
    }
  };

  useEffect(() => {
    setControllerMenuIndex((index) => clampLaunchMenuIndex(index, getLaunchMenuOptionCount(stage)));
    controllerRepeatRef.current = {};
  }, [stage]);

  useEffect(() => {
    if (stage !== 'custom' && stage !== 'survival') {
      setMobileInviteMessage('');
      return;
    }

    const room = extractInviteRoomCode(inviteCodeInput);
    setMobileInviteMessage('');
    if (!room) {
      setMobileInviteUrl('');
      return;
    }

    let cancelled = false;
    setMobileInviteUrl(getMobileInviteUrl(room));

    void fetch('/api/lan-info', { cache: 'no-store' })
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
      () => setMobileInviteMessage('MOBILE LINK COPIED'),
      () => setMobileInviteMessage('COPY FAILED')
    );
  };

  const moveLaunchMenuFocus = (direction: MenuDirection) => {
    setControllerMenuIndex((index) => findDirectionalMenuIndex(
      '[data-launch-index]',
      'data-launch-index',
      index,
      direction,
      getLaunchMenuOptionCount(stage)
    ));
  };

  useEffect(() => {
    const consumePress = (key: string, pressed: boolean) => {
      const wasPressed = controllerButtonsRef.current[key] ?? false;
      controllerButtonsRef.current[key] = pressed;
      return pressed && !wasPressed;
    };

    const consumeRepeat = (key: string, pressed: boolean, firstDelay = 260, repeatDelay = 130) => {
      const now = performance.now();
      const wasPressed = controllerButtonsRef.current[key] ?? false;
      controllerButtonsRef.current[key] = pressed;
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
      const gamepad = getPrimaryGamepad();
      if (!gamepad) {
        controllerButtonsRef.current = {};
        controllerRepeatRef.current = {};
        raf = window.requestAnimationFrame(pollController);
        return;
      }

      const selectPressed = consumePress('launchSelect', isGamepadButtonPressed(gamepad, controllerBindings.menuSelect as GamepadButtonName));
      const backPressed = consumePress('launchBack', isGamepadButtonPressed(gamepad, controllerBindings.menuBack as GamepadButtonName));
      const startPressed = consumePress('launchStart', isGamepadButtonPressed(gamepad, controllerBindings.pause as GamepadButtonName));
      const dpadUp = isGamepadButtonPressed(gamepad, 'dpadUp');
      const dpadDown = isGamepadButtonPressed(gamepad, 'dpadDown');
      const dpadLeft = isGamepadButtonPressed(gamepad, 'dpadLeft');
      const dpadRight = isGamepadButtonPressed(gamepad, 'dpadRight');
      const axisY = getGamepadAxis(gamepad, 1, 0.55);
      const axisX = getGamepadAxis(gamepad, 0, 0.55);
      const moveUp = consumeRepeat('launchUp', dpadUp || axisY < -0.6);
      const moveDown = consumeRepeat('launchDown', dpadDown || axisY > 0.6);
      const moveLeft = consumeRepeat('launchLeft', dpadLeft || axisX < -0.6);
      const moveRight = consumeRepeat('launchRight', dpadRight || axisX > 0.6);

      if (moveUp) {
        moveLaunchMenuFocus('up');
      } else if (moveDown) {
        moveLaunchMenuFocus('down');
      } else if (moveLeft) {
        moveLaunchMenuFocus('left');
      } else if (moveRight) {
        moveLaunchMenuFocus('right');
      }

      if (backPressed) {
        goBack();
        raf = window.requestAnimationFrame(pollController);
        return;
      }

      if (selectPressed || startPressed) {
        runControllerMenuAction(controllerMenuIndex);
      }

      raf = window.requestAnimationFrame(pollController);
    };

    raf = window.requestAnimationFrame(pollController);
    return () => window.cancelAnimationFrame(raf);
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
  const getLaunchButtonClass = (index: number, extra = "") => `${buttonClass} ${controllerMenuIndex === index ? controllerFocusClass : ''} ${extra}`;
  const setupButtonClass = (index: number) => `border-2 bg-black/45 px-3 py-2 text-left tracking-[0.12em] transition hover:border-yellow-200 ${controllerMenuIndex === index ? controllerFocusClass : 'border-cyan-100/30'}`;
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

  if (stage === 'press') {
    return (
      <button
        type="button"
        className="pointer-events-auto fixed inset-0 z-[220] flex cursor-pointer flex-col items-center justify-center bg-[radial-gradient(circle_at_center,rgba(88,28,135,0.35),rgba(5,2,7,0.96)_62%)] px-4 text-center font-mono uppercase text-white"
        style={{ width: 'var(--app-vw, 100dvw)', height: 'var(--app-vh, 100dvh)' }}
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
      style={{ width: 'var(--app-vw, 100dvw)', height: 'var(--app-vh, 100dvh)' }}
    >
      {stage === 'save' && (
        <div className={`${panelClass} flex flex-col gap-3`}>
          <h1 className="text-center text-[clamp(1.1rem,4vmin,2.1rem)] font-bold tracking-[0.18em] text-[#ffb347]">Survival Save</h1>
          <button data-launch-index={0} className={getLaunchButtonClass(0)} onClick={() => setStage('new')}>New</button>
          <button
            data-launch-index={1}
            className={getLaunchButtonClass(1, survivalSave ? '' : 'cursor-not-allowed opacity-45')}
            disabled={!survivalSave}
            onClick={() => continueSavedSurvival()}
          >
            {survivalSave ? `Continue LVL ${survivalSave.survivalLevel} - ${survivalSave.playerName}` : 'Continue'}
          </button>
          <button data-launch-index={2} className={getLaunchButtonClass(2)} onClick={() => setStage('multiplayer')}>Multiplayer</button>
        </div>
      )}

      {stage === 'new' && (
        <div className="pointer-events-auto max-h-[calc(100dvh-24px)] w-[min(94vw,900px)] overflow-y-auto border-2 border-purple-300/45 bg-[#100718]/92 p-4 shadow-[0_0_42px_rgba(88,28,135,0.42)]">
          <h1 className="text-center text-[clamp(1rem,3.4vmin,1.75rem)] font-bold tracking-[0.18em] text-[#ffb347]">New Wizard</h1>
          <div className="mt-4 grid gap-4 md:grid-cols-[220px_1fr]">
            <LaunchCharacterPreview character={characterCustomization} />
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
                {renderSetupButton(0, 'Outfit', characterCustomization.topColor, () => updateOutfitColor())}
                {renderSetupButton(1, 'Skin', characterCustomization.skinColor, () => updateSkinColor())}
                {renderSetupButton(2, 'Hair Color', characterCustomization.hairColor, () => updateHairColor())}
                {renderSetupButton(3, 'Hat', formatLaunchOption(characterCustomization.hatStyle), () => updateHatStyle())}
                {renderSetupButton(4, 'Hair', formatLaunchOption(characterCustomization.hairStyle), () => updateHairStyle())}
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
              className={getLaunchButtonClass(5, canSubmitName ? '' : 'cursor-not-allowed opacity-45')}
              disabled={!canSubmitName}
              onMouseEnter={() => setControllerMenuIndex(5)}
              onClick={() => beginNewSurvival('solo-survival')}
            >
              Start Solo Survival
            </button>
            <button
              data-launch-index={6}
              className={getLaunchButtonClass(6, canSubmitName ? '' : 'cursor-not-allowed opacity-45')}
              disabled={!canSubmitName}
              onMouseEnter={() => setControllerMenuIndex(6)}
              onClick={() => beginNewSurvival('multiplayer-survival')}
            >
              Survival Multiplayer
            </button>
            <button
              data-launch-index={7}
              className={getLaunchButtonClass(7)}
              onMouseEnter={() => setControllerMenuIndex(7)}
              onClick={() => setStage('save')}
            >
              Back
            </button>
          </div>
        </div>
      )}

      {stage === 'multiplayer' && (
        <div className={`${panelClass} flex flex-col gap-3`}>
          <h1 className="text-center text-[clamp(1.1rem,4vmin,2.1rem)] font-bold tracking-[0.18em] text-[#ffb347]">Multiplayer</h1>
          <button data-launch-index={0} className={getLaunchButtonClass(0)} onClick={() => setStage('custom')}>Custom Lobby</button>
          <button data-launch-index={1} className={getLaunchButtonClass(1)} onClick={() => {
            if (!survivalSave) {
              setStage('new');
              setControllerMenuIndex(6);
              return;
            }
            continueSurvivalSave('multiplayer-survival');
            setStage('survival');
          }}>
            Survival Multiplayer
          </button>
          <button data-launch-index={2} className={getLaunchButtonClass(2)} onClick={() => setStage('save')}>Back</button>
        </div>
      )}

      {(stage === 'custom' || stage === 'survival') && (
        <div className={`${panelClass} flex flex-col gap-3`}>
          <h1 className="text-center text-[clamp(1rem,3.5vmin,1.8rem)] font-bold tracking-[0.18em] text-[#ffb347]">
            {stage === 'custom' ? 'Custom Lobby' : 'Survival Multiplayer'}
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
              <span className="text-yellow-100">{inviteRoomCode || 'NO ROOM'}</span>
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
            className={getLaunchButtonClass(0, canSubmitInviteCode ? '' : 'cursor-not-allowed opacity-45')}
            disabled={!canSubmitInviteCode}
            onClick={() => launchMode(stage === 'custom' ? 'custom-lobby' : 'multiplayer-survival', true)}
          >
            {stage === 'custom' ? 'Create Custom Lobby' : 'Create Survival Lobby'}
          </button>
          <button
            data-launch-index={1}
            className={getLaunchButtonClass(1, mobileInviteUrl ? '' : 'cursor-not-allowed opacity-45')}
            disabled={!mobileInviteUrl}
            onClick={copyMobileInvite}
          >
            {mobileInviteMessage || 'Copy Mobile Link'}
          </button>
          <button data-launch-index={2} className={getLaunchButtonClass(2)} onClick={() => setStage('multiplayer')}>Back</button>
          <div className="text-center text-[0.62rem] tracking-[0.18em] text-cyan-100/50">
            Controller: D-pad/stick moves, A selects, B backs out.
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const isGameLaunched = useGameStore(s => s.isGameLaunched);
  const aspectRatio = useGameStore(s => s.aspectRatio);
  const setAspectRatio = useGameStore(s => s.setAspectRatio);
  const setMouseSensitivity = useGameStore(s => s.setMouseSensitivity);

  useEffect(() => {
    if (!isDevSurvivalObserver()) return;
    const state = useGameStore.getState();
    if (!state.localPlayerName) {
      state.setLocalPlayerName('TerrainQA');
    }
    state.setGameMode('solo-survival');
    state.setGameLaunched(true);
  }, []);

  useEffect(() => {
    if (isGameLaunched) return;

    let canceled = false;
    const cancelPreload = scheduleGameplayPreload(() => {
      if (canceled || useGameStore.getState().isGameLaunched) return;
      preloadGameplayModules();
    });

    return () => {
      canceled = true;
      cancelPreload();
    };
  }, [isGameLaunched]);

  useEffect(() => {
    if (!isMobileLikeDevice()) return;

    const state = useGameStore.getState();
    let hasSavedAspectRatio = false;
    try {
      hasSavedAspectRatio = window.localStorage.getItem(ASPECT_RATIO_STORAGE_KEY) !== null;
    } catch {
      hasSavedAspectRatio = false;
    }

    if (state.aspectRatio === '16/9' && !hasSavedAspectRatio) {
      setAspectRatio('Fill');
    }

    if (state.mouseSensitivity === DEFAULT_MOUSE_SENSITIVITY) {
      setMouseSensitivity(DEFAULT_MOBILE_LOOK_SENSITIVITY);
    }
  }, [setAspectRatio, setMouseSensitivity]);

  useEffect(() => {
    const updateInputLayoutClass = () => {
      const touchLayout = isMobileLikeDevice();
      document.documentElement.classList.toggle('wizards-touch-layout', touchLayout);
      if (!touchLayout) {
        document.documentElement.classList.remove('wizards-touch-gameplay');
      }
    };

    updateInputLayoutClass();
    window.addEventListener('resize', updateInputLayoutClass);
    window.addEventListener('orientationchange', updateInputLayoutClass);

    return () => {
      window.removeEventListener('resize', updateInputLayoutClass);
      window.removeEventListener('orientationchange', updateInputLayoutClass);
      document.documentElement.classList.remove('wizards-touch-layout');
      document.documentElement.classList.remove('wizards-touch-gameplay');
    };
  }, []);

  const safeAspectRatio = sanitizeAspectRatio(aspectRatio);
  const isFill = safeAspectRatio === 'Fill';
  const [aspectWidth, aspectHeight] = isFill
    ? [16, 9]
    : safeAspectRatio.split('/').map(Number);
  const numRatio = aspectWidth / aspectHeight;
  const frameStyle = isFill
    ? {
      width: 'var(--app-vw, 100dvw)',
      height: 'var(--app-vh, 100dvh)',
    }
    : {
      width: `min(var(--app-vw, 100dvw), calc(var(--app-vh, 100dvh) * ${numRatio}))`,
      height: `min(var(--app-vh, 100dvh), calc(var(--app-vw, 100dvw) / ${numRatio}))`,
      maxWidth: 'var(--app-vw, 100dvw)',
      maxHeight: 'var(--app-vh, 100dvh)',
      aspectRatio: `${aspectWidth} / ${aspectHeight}`,
    };

  useEffect(() => {
    let viewportRaf = 0;
    const updateViewportVars = () => {
      viewportRaf = 0;
      const useVisualViewport = isMobileLikeDevice();
      const visualViewport = window.visualViewport;
      const width = Math.max(1, Math.round(useVisualViewport ? (visualViewport?.width ?? window.innerWidth) : window.innerWidth));
      const height = Math.max(1, Math.round(useVisualViewport ? (visualViewport?.height ?? window.innerHeight) : window.innerHeight));
      document.documentElement.style.setProperty('--app-vw', `${width}px`);
      document.documentElement.style.setProperty('--app-vh', `${height}px`);
    };
    const scheduleViewportUpdate = () => {
      if (viewportRaf) return;
      viewportRaf = window.requestAnimationFrame(updateViewportVars);
    };

    updateViewportVars();
    window.addEventListener('resize', scheduleViewportUpdate);
    window.addEventListener('orientationchange', scheduleViewportUpdate);
    window.visualViewport?.addEventListener('resize', scheduleViewportUpdate);
    window.visualViewport?.addEventListener('scroll', scheduleViewportUpdate);

    return () => {
      if (viewportRaf) window.cancelAnimationFrame(viewportRaf);
      window.removeEventListener('resize', scheduleViewportUpdate);
      window.removeEventListener('orientationchange', scheduleViewportUpdate);
      window.visualViewport?.removeEventListener('resize', scheduleViewportUpdate);
      window.visualViewport?.removeEventListener('scroll', scheduleViewportUpdate);
    };
  }, []);

  useEffect(() => {
    const nudgeResize = () => window.dispatchEvent(new Event('resize'));
    let rafB = 0;
    const rafA = window.requestAnimationFrame(() => {
      nudgeResize();
      rafB = window.requestAnimationFrame(nudgeResize);
    });
    const timeout = window.setTimeout(nudgeResize, 120);

    return () => {
      window.cancelAnimationFrame(rafA);
      window.cancelAnimationFrame(rafB);
      window.clearTimeout(timeout);
    };
  }, [safeAspectRatio]);

  useEffect(() => {
    const preventBrowserZoom = (event: Event) => {
      event.preventDefault();
    };
    const preventCtrlWheelZoom = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
    };

    window.addEventListener('wheel', preventCtrlWheelZoom, { passive: false });
    document.addEventListener('gesturestart', preventBrowserZoom, { passive: false });
    document.addEventListener('gesturechange', preventBrowserZoom, { passive: false });
    document.addEventListener('gestureend', preventBrowserZoom, { passive: false });

    return () => {
      window.removeEventListener('wheel', preventCtrlWheelZoom);
      document.removeEventListener('gesturestart', preventBrowserZoom);
      document.removeEventListener('gesturechange', preventBrowserZoom);
      document.removeEventListener('gestureend', preventBrowserZoom);
    };
  }, []);

  return (
    <div
      className="relative w-full h-[100dvh] bg-black overflow-hidden font-mono flex items-center justify-center"
      style={{ width: 'var(--app-vw, 100dvw)', height: 'var(--app-vh, 100dvh)' }}
    >
      
      {/* GameWorld and HUD Container */}
      <div 
        className={`game-frame ${isGameLaunched ? 'gameplay-cursor-hidden' : ''} relative bg-black overflow-hidden shrink-0 ${isFill ? 'w-full h-full' : 'shadow-[0_0_50px_rgba(0,0,0,1)]'}`}
        data-aspect-ratio={safeAspectRatio}
        style={frameStyle}
      >
        <div className="absolute inset-0">
          <ErrorBoundary>
            {isGameLaunched && (
              <Suspense fallback={null}>
                <LazyGameWorld />
              </Suspense>
            )}
          </ErrorBoundary>
        </div>

        <div className="absolute pointer-events-none inset-0">
          {isGameLaunched && (
            <Suspense fallback={null}>
              <LazyVoiceChat />
            </Suspense>
          )}
          {isGameLaunched ? (
            <Suspense fallback={null}>
              <LazyHUD />
            </Suspense>
          ) : (
            <LaunchMenu />
          )}
          {isGameLaunched && (
            <Suspense fallback={null}>
              <LazyMiniMap />
            </Suspense>
          )}
        </div>
      </div>
    </div>
  );
}
