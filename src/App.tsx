import { useEffect, Suspense, useLayoutEffect, useMemo, useRef } from 'react';
import {
  ASPECT_RATIO_STORAGE_KEY,
  DEFAULT_MOBILE_LOOK_SENSITIVITY,
  DEFAULT_MOUSE_SENSITIVITY,
  sanitizeAspectRatio,
  useGameStore,
} from './store/gameStore';
import {
  applyMobileLayoutDefaults,
  installAppViewportCssVars,
  installBrowserZoomPrevention,
  installInputLayoutClassSync,
} from './game/systems/input/mobileLayoutRuntime';
import { AppErrorBoundary } from './game/ui/appFrame/AppErrorBoundary';
import { getAppFrameLayout } from './game/ui/appFrame/appFrameLayout';
import { scheduleGameplayPreload } from './game/ui/appFrame/gameplayPreload';
import { LazyGameWorld, LazyHUD, LazyLaunchMenu, LazyMiniMap, LazyQaPerfStatsProbe, LazyVoiceChat, preloadGameplayModules } from './game/ui/appFrame/lazyAppModules';

let survivalQaObserverModulePromise: Promise<typeof import('./game/tools/qa/survivalQaObserver')> | null = null;

function loadSurvivalQaObserverModule() {
  survivalQaObserverModulePromise ??= import('./game/tools/qa/survivalQaObserver');
  return survivalQaObserverModulePromise;
}

function isVoiceChatRouteRequested() {
  if (typeof window === 'undefined') return false;
  try {
    const params = new URLSearchParams(window.location.search);
    return (
      params.has('voiceAutoStart') ||
      params.has('voiceSoundboard') ||
      params.has('voiceTest')
    );
  } catch {
    return false;
  }
}

function isQaPerfStatsRouteRequested() {
  if (typeof window === 'undefined') return false;
  try {
    return new URLSearchParams(window.location.search).get('qaPerfStats') === '1';
  } catch {
    return false;
  }
}

function hasSurvivalQaParam(params: URLSearchParams) {
  for (const key of params.keys()) {
    if (key.startsWith('qaSurvival')) return true;
  }
  return false;
}

function isAppFrameQaMetricsRouteRequested() {
  if (typeof window === 'undefined') return false;
  try {
    const params = new URLSearchParams(window.location.search);
    return (
      params.get('qaPerfStats') === '1' ||
      params.get('qaHudLayout') === '1' ||
      params.get('qaAspectMatrix') === '1' ||
      params.get('qaTouchLayout') === '1' ||
      params.get('mobilePerf') === '1' ||
      params.get('qaCanvasRuntime') === '1' ||
      params.get('spawnMountain') === '1' ||
      hasSurvivalQaParam(params)
    );
  } catch {
    return false;
  }
}

function isSurvivalQaObserverRouteRequested() {
  if (typeof window === 'undefined') return false;
  try {
    const params = new URLSearchParams(window.location.search);
    return (
      params.get('qaSurvival') === '1' ||
      params.has('qaSurvivalChunk') ||
      params.get('qaSpellDummies') === '1' ||
      params.get('spawnMountain') === '1' ||
      params.get('spawnGraveyard') === '1'
    );
  } catch {
    return false;
  }
}

function clearAppFrameQaDatasets() {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const keys = [
    'wofAppAspectRatio',
    'wofAppFrameFill',
    'wofAppViewportSize',
    'wofAppFrameSize',
    'wofAppFrameAspect',
    'wofAppFrameOffset',
    'wofAppFrameHorizontalInset',
    'wofAppFrameVerticalInset',
    'wofQaAspectMatrix',
    'wofQaAspectProfiles',
    'wofQaHudStateCases',
    'wofQaAspectHudRoutes',
    'wofQaAspectProfile',
    'wofQaAspectProfileSize',
    'wofQaAspectExpectedTouchLayout',
    'wofQaAspectExpectedTouchControls',
    'wofQaAspectFrameMode',
  ] as const;
  for (const key of keys) {
    delete root.dataset[key];
  }
}

export default function App() {
  const isGameLaunched = useGameStore(s => s.isGameLaunched);
  const gameMode = useGameStore(s => s.gameMode);
  const voiceChatEnabled = useGameStore(s => s.voiceChatEnabled);
  const aspectRatio = useGameStore(s => s.aspectRatio);
  const setAspectRatio = useGameStore(s => s.setAspectRatio);
  const setMouseSensitivity = useGameStore(s => s.setMouseSensitivity);
  const gameFrameRef = useRef<HTMLDivElement>(null);
  const voiceChatRouteRequested = useMemo(() => isVoiceChatRouteRequested(), []);
  const qaPerfStatsRouteRequested = useMemo(() => isQaPerfStatsRouteRequested(), []);
  const survivalQaObserverRouteRequested = useMemo(() => isSurvivalQaObserverRouteRequested(), []);
  const shouldPublishAppFrameQaMetrics = useMemo(() => isAppFrameQaMetricsRouteRequested(), []);
  const shouldMountVoiceChat = isGameLaunched && (voiceChatEnabled || voiceChatRouteRequested);
  const shouldMountQaPerfStatsProbe = isGameLaunched && qaPerfStatsRouteRequested;

  useLayoutEffect(() => {
    if (!survivalQaObserverRouteRequested) return undefined;
    let cancelled = false;
    void loadSurvivalQaObserverModule().then((module) => {
      if (!cancelled) module.applySurvivalQaObserver();
    }).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [survivalQaObserverRouteRequested]);

  useEffect(() => {
    document.documentElement.dataset.wofAppGameMode = gameMode;
    document.documentElement.dataset.wofAppGameLaunched = String(isGameLaunched);
  }, [gameMode, isGameLaunched]);

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
    applyMobileLayoutDefaults({
      aspectRatioStorageKey: ASPECT_RATIO_STORAGE_KEY,
      defaultMouseSensitivity: DEFAULT_MOUSE_SENSITIVITY,
      defaultMobileLookSensitivity: DEFAULT_MOBILE_LOOK_SENSITIVITY,
      state: useGameStore.getState(),
      setAspectRatio,
      setMouseSensitivity,
    });
  }, [setAspectRatio, setMouseSensitivity]);

  useEffect(() => installInputLayoutClassSync(), []);

  const { safeAspectRatio, isFill, frameStyle } = getAppFrameLayout(sanitizeAspectRatio(aspectRatio));

  useEffect(() => installAppViewportCssVars(), []);

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
    if (!shouldPublishAppFrameQaMetrics) {
      clearAppFrameQaDatasets();
      return clearAppFrameQaDatasets;
    }

    let disposed = false;
    let cleanup: (() => void) | undefined;

    void import('./game/tools/qa/appFrameQaMetrics').then((metrics) => {
      if (disposed) {
        metrics.clearAppFrameQaMetrics();
        return;
      }

      const updateQaFrameMetrics = () => {
        metrics.updateAppFrameQaMetrics(gameFrameRef.current, safeAspectRatio, isFill);
      };

      updateQaFrameMetrics();
      const resizeObserver = typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(updateQaFrameMetrics);
      if (gameFrameRef.current) resizeObserver?.observe(gameFrameRef.current);

      window.addEventListener('resize', updateQaFrameMetrics);
      window.addEventListener('orientationchange', updateQaFrameMetrics);
      window.visualViewport?.addEventListener('resize', updateQaFrameMetrics);
      window.visualViewport?.addEventListener('scroll', updateQaFrameMetrics);

      cleanup = () => {
        resizeObserver?.disconnect();
        window.removeEventListener('resize', updateQaFrameMetrics);
        window.removeEventListener('orientationchange', updateQaFrameMetrics);
        window.visualViewport?.removeEventListener('resize', updateQaFrameMetrics);
        window.visualViewport?.removeEventListener('scroll', updateQaFrameMetrics);
        metrics.clearAppFrameQaMetrics();
      };
    }).catch(() => undefined);

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [isFill, safeAspectRatio, shouldPublishAppFrameQaMetrics]);

  useEffect(() => installBrowserZoomPrevention(), []);

  return (
    <div
      className="relative w-full h-[100dvh] bg-black overflow-hidden font-mono flex items-center justify-center"
      style={{ width: 'var(--app-vw, 100dvw)', height: 'var(--app-vh, 100dvh)' }}
    >
      
      {/* GameWorld and HUD Container */}
      <div 
        ref={gameFrameRef}
        className={`game-frame ${isGameLaunched ? 'gameplay-cursor-hidden' : ''} relative bg-black overflow-hidden shrink-0 ${isFill ? 'w-full h-full' : 'shadow-[0_0_50px_rgba(0,0,0,1)]'}`}
        data-aspect-ratio={safeAspectRatio}
        data-wof-app-frame="game"
        data-testid="game-frame"
        style={frameStyle}
      >
        <div className="absolute inset-0">
          <AppErrorBoundary>
            {isGameLaunched && (
              <Suspense fallback={null}>
                <LazyGameWorld />
              </Suspense>
            )}
          </AppErrorBoundary>
        </div>
        {shouldMountQaPerfStatsProbe && (
          <Suspense fallback={null}>
            <LazyQaPerfStatsProbe />
          </Suspense>
        )}

        <div className="absolute pointer-events-none inset-0">
          {shouldMountVoiceChat && (
            <Suspense fallback={null}>
              <LazyVoiceChat />
            </Suspense>
          )}
          {isGameLaunched ? (
            <Suspense fallback={null}>
              <LazyHUD />
            </Suspense>
          ) : (
            <Suspense fallback={null}>
              <LazyLaunchMenu />
            </Suspense>
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
