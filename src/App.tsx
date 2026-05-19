import { useEffect, Component, ReactNode, lazy, Suspense, useState, useRef } from 'react';
import {
  ASPECT_RATIO_STORAGE_KEY,
  DEFAULT_MOBILE_LOOK_SENSITIVITY,
  DEFAULT_MOUSE_SENSITIVITY,
  GameMode,
  sanitizeAspectRatio,
  sanitizePlayerName,
  useGameStore,
} from './store/gameStore';
import { isMobileLikeDevice } from './game/performanceMode';
import { getGamepadAxis, getPrimaryGamepad, isGamepadButtonPressed, type GamepadButtonName } from './game/controllerInput';

const LazyHUD = lazy(() => import('./game/HUD').then((module) => ({ default: module.HUD })));
const LazyGameWorld = lazy(() => import('./game/GameWorld').then((module) => ({ default: module.GameWorld })));
const LazyVoiceChat = lazy(() => import('./game/VoiceChat').then((module) => ({ default: module.VoiceChat })));
const LazyMiniMap = lazy(() => import('./components/MiniMap').then((module) => ({ default: module.MiniMap })));

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

function getCurrentRoomCode() {
  if (typeof window === 'undefined') return '';
  return new URLSearchParams(window.location.search).get('room') || '';
}

function applyRoomCode(value: string) {
  if (typeof window === 'undefined') return;
  const room = value.trim();
  const url = new URL(window.location.href);
  if (room) url.searchParams.set('room', room);
  else url.searchParams.delete('room');
  window.history.replaceState(null, '', url.toString());
}

function makeDefaultWizardName() {
  return `Wizard ${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function makeDefaultRoomCode() {
  return `wof-${Math.random().toString(36).slice(2, 7)}`;
}

function getLaunchMenuOptionCount(stage: 'press' | 'name' | 'mode' | 'multiplayer' | 'custom' | 'survival') {
  if (stage === 'mode') return 2;
  if (stage === 'multiplayer') return 3;
  if (stage === 'custom' || stage === 'survival') return 2;
  return 1;
}

function wrapLaunchMenuIndex(index: number, count: number) {
  return ((index % count) + count) % count;
}

type LaunchInputSource = 'mouse' | 'controller';

function isDevSurvivalObserver() {
  if (!import.meta.env.DEV || typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.get('qaSurvival') === '1' || params.get('spawnMountain') === '1' || params.get('spawnGraveyard') === '1';
}

function LaunchMenu() {
  const localPlayerName = useGameStore(s => s.localPlayerName);
  const setLocalPlayerName = useGameStore(s => s.setLocalPlayerName);
  const setGameMode = useGameStore(s => s.setGameMode);
  const setGameLaunched = useGameStore(s => s.setGameLaunched);
  const setTouchControlsActive = useGameStore(s => s.setTouchControlsActive);
  const setControllerGameplayActive = useGameStore(s => s.setControllerGameplayActive);
  const controllerBindings = useGameStore(s => s.controllerBindings);
  const [stage, setStage] = useState<'press' | 'name' | 'mode' | 'multiplayer' | 'custom' | 'survival'>('press');
  const [playerNameInput, setPlayerNameInput] = useState(() => localPlayerName || makeDefaultWizardName());
  const [inviteCodeInput, setInviteCodeInput] = useState(() => getCurrentRoomCode() || makeDefaultRoomCode());
  const [controllerMenuIndex, setControllerMenuIndex] = useState(0);
  const controllerButtonsRef = useRef<Partial<Record<string, boolean>>>({});
  const controllerRepeatRef = useRef<Partial<Record<string, number>>>({});
  const cleanedName = sanitizePlayerName(playerNameInput);
  const canSubmitName = cleanedName.length >= 2;
  const canSubmitInviteCode = inviteCodeInput.trim().length > 0;

  const finishName = () => {
    if (!canSubmitName) return;
    setLocalPlayerName(cleanedName);
    setStage('mode');
  };

  const launchMode = (mode: GameMode, useInviteCode = false, inputSource: LaunchInputSource = 'mouse') => {
    if (!localPlayerName && canSubmitName) {
      setLocalPlayerName(cleanedName);
    }
    if (useInviteCode) {
      if (!canSubmitInviteCode) return;
      applyRoomCode(inviteCodeInput);
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
    if (stage === 'name') {
      setStage('press');
      return;
    }
    if (stage === 'mode') {
      setStage(localPlayerName ? 'press' : 'name');
      return;
    }
    if (stage === 'multiplayer') {
      setStage('mode');
      return;
    }
    setStage('multiplayer');
  };

  const runControllerMenuAction = (index: number) => {
    if (stage === 'press') {
      setStage(localPlayerName ? 'mode' : 'name');
      return;
    }

    if (stage === 'name') {
      finishName();
      return;
    }

    if (stage === 'mode') {
      if (index === 0) launchMode('solo-survival', false, 'controller');
      else setStage('multiplayer');
      return;
    }

    if (stage === 'multiplayer') {
      if (index === 0) setStage('custom');
      else if (index === 1) setStage('survival');
      else setStage('mode');
      return;
    }

    if (stage === 'custom' || stage === 'survival') {
      if (index === 0) {
        launchMode(stage === 'custom' ? 'custom-lobby' : 'multiplayer-survival', true, 'controller');
      } else {
        setStage('multiplayer');
      }
    }
  };

  useEffect(() => {
    setControllerMenuIndex((index) => wrapLaunchMenuIndex(index, getLaunchMenuOptionCount(stage)));
    controllerRepeatRef.current = {};
  }, [stage]);

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
      const movePrevious = consumeRepeat('launchPrevious', dpadUp || dpadLeft || axisY < -0.6 || axisX < -0.6);
      const moveNext = consumeRepeat('launchNext', dpadDown || dpadRight || axisY > 0.6 || axisX > 0.6);

      if (moveNext || movePrevious) {
        setControllerMenuIndex((index) => wrapLaunchMenuIndex(index + (moveNext ? 1 : -1), getLaunchMenuOptionCount(stage)));
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
  }, [controllerBindings, controllerMenuIndex, localPlayerName, stage, canSubmitInviteCode, canSubmitName, cleanedName, inviteCodeInput]);

  const panelClass = "pointer-events-auto w-[min(92vw,640px)] border-2 border-purple-300/45 bg-[#100718]/90 p-4 shadow-[0_0_42px_rgba(88,28,135,0.42)]";
  const buttonClass = "w-full border-2 border-[#888] border-b-[#222] border-r-[#222] bg-[#2b1738] px-4 py-3 text-left font-mono uppercase tracking-[0.14em] text-cyan-50 transition hover:bg-[#3f2450]";
  const controllerFocusClass = "border-yellow-200 bg-yellow-300/15 text-yellow-100 shadow-[0_0_22px_rgba(250,204,21,0.28)]";
  const getLaunchButtonClass = (index: number, extra = "") => `${buttonClass} ${controllerMenuIndex === index ? controllerFocusClass : ''} ${extra}`;

  if (stage === 'press') {
    return (
      <button
        type="button"
        className="pointer-events-auto fixed inset-0 z-[220] flex cursor-pointer flex-col items-center justify-center bg-[radial-gradient(circle_at_center,rgba(88,28,135,0.35),rgba(5,2,7,0.96)_62%)] px-4 text-center font-mono uppercase text-white"
        style={{ width: 'var(--app-vw, 100dvw)', height: 'var(--app-vh, 100dvh)' }}
        onClick={() => setStage(localPlayerName ? 'mode' : 'name')}
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
      {stage === 'name' && (
        <div data-testid="player-name-prompt" className={panelClass}>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              finishName();
            }}
          >
            <div className="text-center text-[clamp(1rem,4vmin,1.65rem)] tracking-[0.18em] text-yellow-200">Name Your Wizard</div>
            <input
              autoFocus
              aria-label="Player name"
              value={playerNameInput}
              maxLength={18}
              autoCapitalize="words"
              autoCorrect="off"
              spellCheck={false}
              placeholder="enter wizard name"
              className="normal-case mt-4 w-full border-2 border-[#888] border-b-[#222] border-r-[#222] bg-black px-3 py-3 text-center text-[clamp(0.9rem,3vmin,1.3rem)] text-white outline-none focus:border-yellow-200"
              onChange={(event) => setPlayerNameInput(sanitizePlayerName(event.currentTarget.value))}
            />
            <button
              type="submit"
              disabled={!canSubmitName}
              className={`mt-4 w-full border-2 px-4 py-3 text-[clamp(0.78rem,2.3vmin,1rem)] tracking-widest transition-all ${canSubmitName ? 'border-yellow-200 bg-yellow-300/15 text-yellow-100 hover:bg-yellow-300/25' : 'cursor-not-allowed border-gray-600 bg-gray-900 text-gray-500'} ${controllerMenuIndex === 0 ? controllerFocusClass : ''}`}
            >
              Join Lobby
            </button>
            <div className="mt-3 text-center text-[0.62rem] tracking-[0.18em] text-cyan-100/50">
              Controller: A accepts, B goes back. Name can still be edited with keyboard.
            </div>
          </form>
        </div>
      )}

      {stage === 'mode' && (
        <div className={`${panelClass} flex flex-col gap-3`}>
          <h1 className="text-center text-[clamp(1.1rem,4vmin,2.1rem)] font-bold tracking-[0.18em] text-[#ffb347]">Choose Your Spellstorm</h1>
          <button className={getLaunchButtonClass(0)} onClick={() => launchMode('solo-survival')}>Solo Survival</button>
          <button className={getLaunchButtonClass(1)} onClick={() => setStage('multiplayer')}>Multiplayer</button>
        </div>
      )}

      {stage === 'multiplayer' && (
        <div className={`${panelClass} flex flex-col gap-3`}>
          <h1 className="text-center text-[clamp(1.1rem,4vmin,2.1rem)] font-bold tracking-[0.18em] text-[#ffb347]">Multiplayer</h1>
          <button className={getLaunchButtonClass(0)} onClick={() => setStage('custom')}>Custom Lobby</button>
          <button className={getLaunchButtonClass(1)} onClick={() => setStage('survival')}>Survival Multiplayer</button>
          <button className={getLaunchButtonClass(2)} onClick={() => setStage('mode')}>Back</button>
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
          <button
            className={getLaunchButtonClass(0, canSubmitInviteCode ? '' : 'cursor-not-allowed opacity-45')}
            disabled={!canSubmitInviteCode}
            onClick={() => launchMode(stage === 'custom' ? 'custom-lobby' : 'multiplayer-survival', true)}
          >
            {stage === 'custom' ? 'Create Custom Lobby' : 'Create Survival Lobby'}
          </button>
          <button className={getLaunchButtonClass(1)} onClick={() => setStage('multiplayer')}>Back</button>
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
        className={`game-frame relative bg-black overflow-hidden shrink-0 ${isFill ? 'w-full h-full' : 'shadow-[0_0_50px_rgba(0,0,0,1)]'}`}
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
