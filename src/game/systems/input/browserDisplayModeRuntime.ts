export type PointerLockFramePermissionOptions = {
  sameWindow: boolean;
  frameAllow?: string;
};

export type StandaloneDisplayModeOptions = {
  navigatorStandalone?: boolean;
  fullscreenMatches?: boolean;
  standaloneMatches?: boolean;
};

export function resolvePointerLockFramePermission({
  sameWindow,
  frameAllow = "",
}: PointerLockFramePermissionOptions) {
  return sameWindow || /\bpointer-lock\b/i.test(frameAllow);
}

export function resolveRemoteMouseLookFallbackFromParams(params?: URLSearchParams | null) {
  if (!params) return false;
  return (
    params.get("remoteInput") === "1" ||
    params.get("rustdesk") === "1" ||
    params.get("qaHideMenu") === "1"
  );
}

export function resolveStandaloneDisplayMode({
  navigatorStandalone = false,
  fullscreenMatches = false,
  standaloneMatches = false,
}: StandaloneDisplayModeOptions) {
  return navigatorStandalone || fullscreenMatches || standaloneMatches;
}

export function getPointerLockReasonMessage(reason: unknown) {
  if (!reason) return "";
  if (typeof reason === "string") return reason;
  if (reason instanceof Error) return `${reason.name}: ${reason.message}`;
  return String(reason);
}

export function isPointerLockSecurityErrorMessage(message: string) {
  return /pointer lock|pointerlock/i.test(message);
}

export function isPermanentPointerLockRejectionMessage(message: string) {
  return /pointer lock|pointerlock/i.test(message) && /sandbox|permission|policy|iframe|frame|allow/i.test(message);
}
