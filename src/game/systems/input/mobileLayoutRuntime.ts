import { isMobileLikeDevice } from "./performanceMode";

export type MobileLayoutDefaultState = {
  aspectRatio: string;
  mouseSensitivity: number;
};

export type MobileLayoutDefaultsConfig = {
  aspectRatioStorageKey: string;
  defaultMouseSensitivity: number;
  defaultMobileLookSensitivity: number;
  state: MobileLayoutDefaultState;
  setAspectRatio: (aspectRatio: "16/9" | "4/3" | "1/1" | "Fill") => void;
  setMouseSensitivity: (sensitivity: number) => void;
};

export type AppViewportSize = {
  width: number;
  height: number;
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
  return {
    width: Math.max(1, Math.round(useVisualViewport ? (visualViewport?.width ?? window.innerWidth) : window.innerWidth)),
    height: Math.max(1, Math.round(useVisualViewport ? (visualViewport?.height ?? window.innerHeight) : window.innerHeight)),
  };
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
  if (!isMobileLikeDevice()) return;

  if (state.aspectRatio === "16/9" && !hasStoredAspectRatio(aspectRatioStorageKey)) {
    setAspectRatio("Fill");
  }

  if (state.mouseSensitivity === defaultMouseSensitivity) {
    setMouseSensitivity(defaultMobileLookSensitivity);
  }
}

export function updateInputLayoutClasses(root = typeof document === "undefined" ? null : document.documentElement) {
  if (!root) return false;
  const touchLayout = isMobileLikeDevice();
  root.classList.toggle("wizards-touch-layout", touchLayout);
  if (!touchLayout) {
    root.classList.remove("wizards-touch-gameplay");
  }
  return touchLayout;
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

export function writeAppViewportCssVars(root = typeof document === "undefined" ? null : document.documentElement) {
  if (typeof window === "undefined" || !root) return;

  const useVisualViewport = isMobileLikeDevice();
  const { width, height } = readAppViewportSize({ useVisualViewport });
  if (root === lastAppViewportRoot && width === lastAppViewportWidth && height === lastAppViewportHeight) return;
  lastAppViewportRoot = root;
  lastAppViewportWidth = width;
  lastAppViewportHeight = height;
  root.style.setProperty("--app-vw", `${width}px`);
  root.style.setProperty("--app-vh", `${height}px`);
}

export function installAppViewportCssVars(root = typeof document === "undefined" ? null : document.documentElement) {
  if (typeof window === "undefined" || !root) return () => {};

  const useVisualViewport = isMobileLikeDevice();
  let viewportRaf = 0;
  const updateViewportVars = () => {
    viewportRaf = 0;
    writeAppViewportCssVars(root);
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
