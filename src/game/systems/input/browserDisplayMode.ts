import {
  getPointerLockReasonMessage,
  isPermanentPointerLockRejectionMessage,
  isPointerLockSecurityErrorMessage,
  resolvePointerLockFramePermission,
  resolveRemoteMouseLookFallbackFromParams,
  resolveStandaloneDisplayMode,
} from "./browserDisplayModeRuntime";

let cachedRemoteMouseLookSearch: string | null = null;
let cachedRemoteMouseLookFallback = false;

export function canRequestPointerLockHere() {
  try {
    const frame = window.frameElement as HTMLIFrameElement | null;
    return resolvePointerLockFramePermission({
      sameWindow: window.self === window.top,
      frameAllow: frame?.allow ?? "",
    });
  } catch {
    return false;
  }
}

export function shouldUseRemoteMouseLookFallbackFromSearch(search: string) {
  if (search === cachedRemoteMouseLookSearch) return cachedRemoteMouseLookFallback;
  const params = new URLSearchParams(search);
  cachedRemoteMouseLookSearch = search;
  cachedRemoteMouseLookFallback = resolveRemoteMouseLookFallbackFromParams(params);
  return cachedRemoteMouseLookFallback;
}

export function shouldUseRemoteMouseLookFallback() {
  if (typeof window === "undefined") return false;
  return shouldUseRemoteMouseLookFallbackFromSearch(window.location.search);
}

export function getFullscreenElement() {
  const webkitDocument = document as Document & { webkitFullscreenElement?: Element | null };
  return document.fullscreenElement ?? webkitDocument.webkitFullscreenElement ?? null;
}

export function isStandaloneDisplayMode(
  fullscreenMedia?: MediaQueryList | null,
  standaloneMedia?: MediaQueryList | null,
) {
  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
  return resolveStandaloneDisplayMode({
    navigatorStandalone: navigatorWithStandalone.standalone === true,
    fullscreenMatches: Boolean((fullscreenMedia ?? window.matchMedia?.("(display-mode: fullscreen)"))?.matches),
    standaloneMatches: Boolean((standaloneMedia ?? window.matchMedia?.("(display-mode: standalone)"))?.matches),
  });
}

export function isPointerLockSecurityError(reason: unknown) {
  return isPointerLockSecurityErrorMessage(getPointerLockReasonMessage(reason));
}

export function isPermanentPointerLockRejection(reason: unknown) {
  return isPermanentPointerLockRejectionMessage(getPointerLockReasonMessage(reason));
}

export function setMouseLookFallbackActive(active: boolean) {
  if (active) {
    document.documentElement.dataset.wizardsMouseLookFallback = "true";
    return;
  }

  delete document.documentElement.dataset.wizardsMouseLookFallback;
}
