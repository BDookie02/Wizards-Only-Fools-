export type DocumentFullscreenStateOptions = {
  hasFullscreenElement: boolean;
  standaloneDisplayMode: boolean;
};

export type TouchFullscreenActionOptions = DocumentFullscreenStateOptions & {
  canRequestFullscreen: boolean;
};

export type TouchFullscreenAction = "exit" | "standalone" | "request" | "hint";

export function resolveDocumentFullscreenState({
  hasFullscreenElement,
  standaloneDisplayMode,
}: DocumentFullscreenStateOptions) {
  return hasFullscreenElement || standaloneDisplayMode;
}

export function resolveTouchFullscreenAction({
  hasFullscreenElement,
  standaloneDisplayMode,
  canRequestFullscreen,
}: TouchFullscreenActionOptions): TouchFullscreenAction {
  if (hasFullscreenElement) return "exit";
  if (standaloneDisplayMode) return "standalone";
  return canRequestFullscreen ? "request" : "hint";
}
