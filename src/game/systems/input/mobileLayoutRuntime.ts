import { isIOSLikeDevice, isMobileLikeDevice } from "./performanceMode";
import {
  resolveAppViewportCssVarValues,
  resolveInputLayoutClassState,
  resolveMobileLayoutDefaultActions,
  type MobileLayoutAspectRatio,
} from "./mobileLayoutRulesRuntime";
import {
  resolveAppViewportSizeFromMetrics,
  type AppViewportCssVarsOptions,
  type AppViewportSize,
} from "./mobileViewportRuntime";

export type { AppViewportCssVarsOptions, AppViewportSize } from "./mobileViewportRuntime";

export type MobileLayoutDefaultState = {
  aspectRatio: string;
  mouseSensitivity: number;
};

export type MobileLayoutDefaultsConfig = {
  aspectRatioStorageKey: string;
  defaultMouseSensitivity: number;
  defaultMobileLookSensitivity: number;
  state: MobileLayoutDefaultState;
  setAspectRatio: (aspectRatio: MobileLayoutAspectRatio) => void;
  setMouseSensitivity: (sensitivity: number) => void;
};

export function readAppViewportSize({
  useVisualViewport = true,
}: {
  useVisualViewport?: boolean;
} = {}): AppViewportSize {
  if (typeof window === "undefined") {
    return { width: 1, height: 1 };
  }
  const visualViewport = window.visualViewport;
  const visualViewportWidth = visualViewport?.width ?? window.innerWidth;
  const visualViewportHeight = visualViewport?.height ?? window.innerHeight;
  const coverIOSViewport = useVisualViewport && isIOSLikeDevice();
  return resolveAppViewportSizeFromMetrics({
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    visualViewportWidth,
    visualViewportHeight,
    useVisualViewport,
    coverIOSViewport,
  });
}

function hasStoredAspectRatio(storageKey: string) {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(storageKey) !== null;
  } catch {
    return false;
  }
}

export function applyMobileLayoutDefaults({
  aspectRatioStorageKey,
  defaultMouseSensitivity,
  defaultMobileLookSensitivity,
  state,
  setAspectRatio,
  setMouseSensitivity,
}: MobileLayoutDefaultsConfig) {
  const mobileLikeDevice = isMobileLikeDevice();
  if (!mobileLikeDevice) return;

  const actions = resolveMobileLayoutDefaultActions({
    mobileLikeDevice,
    aspectRatio: state.aspectRatio,
    hasStoredAspectRatio: hasStoredAspectRatio(aspectRatioStorageKey),
    mouseSensitivity: state.mouseSensitivity,
    defaultMouseSensitivity,
    defaultMobileLookSensitivity,
  });

  if (actions.aspectRatio) setAspectRatio(actions.aspectRatio);
  if (actions.mouseSensitivity !== null) setMouseSensitivity(actions.mouseSensitivity);
}

export function updateInputLayoutClasses(root = typeof document === "undefined" ? null : document.documentElement) {
  if (!root) return false;
  const classState = resolveInputLayoutClassState(isMobileLikeDevice());
  root.classList.toggle("wizards-touch-layout", classState.touchLayout);
  if (classState.removeTouchGameplay) {
    root.classList.remove("wizards-touch-gameplay");
  }
  return classState.touchLayout;
}

export function clearInputLayoutClasses(root = typeof document === "undefined" ? null : document.documentElement) {
  root?.classList.remove("wizards-touch-layout");
  root?.classList.remove("wizards-touch-gameplay");
}

let lastAppViewportRoot: HTMLElement | null = null;
let lastAppViewportWidth = 0;
let lastAppViewportHeight = 0;

export function installInputLayoutClassSync(root = typeof document === "undefined" ? null : document.documentElement) {
  const updateInputLayoutClass = () => updateInputLayoutClasses(root);

  updateInputLayoutClass();
  if (typeof window === "undefined") {
    return () => clearInputLayoutClasses(root);
  }

  window.addEventListener("resize", updateInputLayoutClass);
  window.addEventListener("orientationchange", updateInputLayoutClass);

  return () => {
    window.removeEventListener("resize", updateInputLayoutClass);
    window.removeEventListener("orientationchange", updateInputLayoutClass);
    clearInputLayoutClasses(root);
  };
}

export function writeAppViewportCssVars(
  root = typeof document === "undefined" ? null : document.documentElement,
  { useVisualViewport = isMobileLikeDevice() }: AppViewportCssVarsOptions = {},
) {
  if (typeof window === "undefined" || !root) return;

  const { width, height } = readAppViewportSize({ useVisualViewport });
  if (root === lastAppViewportRoot && width === lastAppViewportWidth && height === lastAppViewportHeight) return;
  lastAppViewportRoot = root;
  lastAppViewportWidth = width;
  lastAppViewportHeight = height;
  const cssVars = resolveAppViewportCssVarValues({ width, height });
  root.style.setProperty("--app-vw", cssVars.appVw);
  root.style.setProperty("--app-vh", cssVars.appVh);
}

export function installAppViewportCssVars(root = typeof document === "undefined" ? null : document.documentElement) {
  if (typeof window === "undefined" || !root) return () => {};

  const useVisualViewport = isMobileLikeDevice();
  let viewportRaf = 0;
  const updateViewportVars = () => {
    viewportRaf = 0;
    writeAppViewportCssVars(root, { useVisualViewport });
  };
  const scheduleViewportUpdate = () => {
    if (viewportRaf) return;
    viewportRaf = window.requestAnimationFrame(updateViewportVars);
  };

  updateViewportVars();
  window.addEventListener("resize", scheduleViewportUpdate);
  window.addEventListener("orientationchange", scheduleViewportUpdate);
  if (useVisualViewport) {
    window.visualViewport?.addEventListener("resize", scheduleViewportUpdate);
    window.visualViewport?.addEventListener("scroll", scheduleViewportUpdate);
  }

  return () => {
    if (viewportRaf) window.cancelAnimationFrame(viewportRaf);
    window.removeEventListener("resize", scheduleViewportUpdate);
    window.removeEventListener("orientationchange", scheduleViewportUpdate);
    if (useVisualViewport) {
      window.visualViewport?.removeEventListener("resize", scheduleViewportUpdate);
      window.visualViewport?.removeEventListener("scroll", scheduleViewportUpdate);
    }
  };
}

export function installBrowserZoomPrevention() {
  if (typeof window === "undefined" || typeof document === "undefined") return () => {};

  const preventBrowserZoom = (event: Event) => {
    event.preventDefault();
  };
  const preventCtrlWheelZoom = (event: WheelEvent) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
  };

  window.addEventListener("wheel", preventCtrlWheelZoom, { passive: false });
  document.addEventListener("gesturestart", preventBrowserZoom, { passive: false });
  document.addEventListener("gesturechange", preventBrowserZoom, { passive: false });
  document.addEventListener("gestureend", preventBrowserZoom, { passive: false });

  return () => {
    window.removeEventListener("wheel", preventCtrlWheelZoom);
    document.removeEventListener("gesturestart", preventBrowserZoom);
    document.removeEventListener("gesturechange", preventBrowserZoom);
    document.removeEventListener("gestureend", preventBrowserZoom);
  };
}
