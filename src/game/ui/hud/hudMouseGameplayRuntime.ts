export const HUD_MOUSE_GAMEPLAY_ACTIVE_CLASS = "wizards-mouse-gameplay-active";
export const HUD_POINTER_LOCK_RESUME_GRACE_MS = 1800;

export function setHudMouseGameplayActive(active: boolean) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle(HUD_MOUSE_GAMEPLAY_ACTIVE_CLASS, active);
}

export function isPointerLockActive() {
  return typeof document !== "undefined" && document.pointerLockElement !== null;
}

export function isHudMouseLookFallbackActive() {
  return typeof document !== "undefined" && document.documentElement.dataset.wizardsMouseLookFallback === "true";
}

export function getHudPointerLockTarget() {
  if (typeof document === "undefined") return null;
  return (
    document.getElementById("game-canvas") ??
    document.querySelector("canvas") ??
    document.body
  ) as HTMLElement | null;
}

export function getHudPointerLockRequester(target: HTMLElement | null) {
  return target ? (target as HTMLElement & { requestPointerLock?: () => Promise<void> | void }).requestPointerLock : undefined;
}

export function exitPointerLockIfActive() {
  if (!isPointerLockActive()) return false;
  document.exitPointerLock();
  return true;
}

export function dispatchHudGameplayModalOpened() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("command-console-opened"));
}

export function getHudPointerLockNowMs() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

export function getHudPointerLockResumeGraceUntil(nowMs = getHudPointerLockNowMs()) {
  return nowMs + HUD_POINTER_LOCK_RESUME_GRACE_MS;
}

export function shouldTreatPointerLockLossAsResumeGrace(options: {
  nowMs: number;
  pauseRequested: boolean;
  resumeGraceUntilMs: number;
}) {
  return !options.pauseRequested && options.nowMs < options.resumeGraceUntilMs;
}
