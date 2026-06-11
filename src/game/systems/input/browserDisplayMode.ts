export function canRequestPointerLockHere() {
  try {
    if (window.self === window.top) return true;

    const frame = window.frameElement as HTMLIFrameElement | null;
    const allow = frame?.allow ?? "";
    return /\bpointer-lock\b/i.test(allow);
  } catch {
    return false;
  }
}

export function shouldUseRemoteMouseLookFallback() {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  return params.get("remoteInput") === "1" ||
    params.get("rustdesk") === "1" ||
    params.get("qaHideMenu") === "1";
}

export function getFullscreenElement() {
  const webkitDocument = document as Document & { webkitFullscreenElement?: Element | null };
  return document.fullscreenElement ?? webkitDocument.webkitFullscreenElement ?? null;
}

export function isStandaloneDisplayMode() {
  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
  return (
    navigatorWithStandalone.standalone === true ||
    window.matchMedia?.("(display-mode: fullscreen)").matches ||
    window.matchMedia?.("(display-mode: standalone)").matches
  );
}

export function isPointerLockSecurityError(reason: unknown) {
  if (!reason) return false;

  const message = typeof reason === "string"
    ? reason
    : reason instanceof Error
      ? `${reason.name}: ${reason.message}`
      : String(reason);

  return /pointer lock|pointerlock/i.test(message);
}

export function isPermanentPointerLockRejection(reason: unknown) {
  if (!reason) return false;

  const message = typeof reason === "string"
    ? reason
    : reason instanceof Error
      ? `${reason.name}: ${reason.message}`
      : String(reason);

  return /pointer lock|pointerlock/i.test(message) && /sandbox|permission|policy|iframe|frame|allow/i.test(message);
}

export function setMouseLookFallbackActive(active: boolean) {
  if (active) {
    document.documentElement.dataset.wizardsMouseLookFallback = "true";
    return;
  }

  delete document.documentElement.dataset.wizardsMouseLookFallback;
}
