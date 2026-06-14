import { getFullscreenElement, isStandaloneDisplayMode } from "./browserDisplayMode";
import {
  resolveDocumentFullscreenState,
  resolveTouchFullscreenAction,
} from "./fullscreenRuntimeRules";

type FullscreenRuntimeCallbacks = {
  onFullscreenStateChange: (active: boolean) => void;
  onFullscreenHintChange: (open: boolean) => void;
};

type WebkitDocument = Document & {
  webkitExitFullscreen?: () => Promise<void> | void;
};

type WebkitFullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

function getDocumentFullscreenState(
  fullscreenMedia?: MediaQueryList | null,
  standaloneMedia?: MediaQueryList | null,
) {
  return resolveDocumentFullscreenState({
    hasFullscreenElement: Boolean(getFullscreenElement()),
    standaloneDisplayMode: isStandaloneDisplayMode(fullscreenMedia, standaloneMedia),
  });
}

export function subscribeDocumentFullscreenState(onFullscreenStateChange: (active: boolean) => void) {
  if (typeof document === "undefined" || typeof window === "undefined") return () => {};

  const fullscreenMedia = window.matchMedia?.("(display-mode: fullscreen)");
  const standaloneMedia = window.matchMedia?.("(display-mode: standalone)");
  const updateFullscreenState = () => onFullscreenStateChange(getDocumentFullscreenState(fullscreenMedia, standaloneMedia));

  updateFullscreenState();
  document.addEventListener("fullscreenchange", updateFullscreenState);
  document.addEventListener("webkitfullscreenchange", updateFullscreenState as EventListener);
  fullscreenMedia?.addEventListener?.("change", updateFullscreenState);
  standaloneMedia?.addEventListener?.("change", updateFullscreenState);

  return () => {
    document.removeEventListener("fullscreenchange", updateFullscreenState);
    document.removeEventListener("webkitfullscreenchange", updateFullscreenState as EventListener);
    fullscreenMedia?.removeEventListener?.("change", updateFullscreenState);
    standaloneMedia?.removeEventListener?.("change", updateFullscreenState);
  };
}

export function requestTouchFullscreenMode(
  { onFullscreenStateChange, onFullscreenHintChange }: FullscreenRuntimeCallbacks,
  showHintOnFailure = true,
) {
  if (typeof document === "undefined") return false;

  const webkitDocument = document as WebkitDocument;
  const fullscreenTarget = document.documentElement as WebkitFullscreenElement;
  const fullscreenElement = getFullscreenElement();
  const standaloneDisplayMode = isStandaloneDisplayMode();
  const exitFullscreen = document.exitFullscreen ?? webkitDocument.webkitExitFullscreen;
  const requestFullscreen = fullscreenTarget.requestFullscreen;
  const webkitRequestFullscreen = fullscreenTarget.webkitRequestFullscreen;
  const showHint = () => {
    if (showHintOnFailure) onFullscreenHintChange(true);
  };

  try {
    const action = resolveTouchFullscreenAction({
      hasFullscreenElement: Boolean(fullscreenElement),
      standaloneDisplayMode,
      canRequestFullscreen: Boolean(requestFullscreen || webkitRequestFullscreen),
    });

    if (action === "exit") {
      const exitRequest = exitFullscreen?.call(document);
      onFullscreenHintChange(false);
      if (exitRequest && typeof exitRequest.catch === "function") {
        exitRequest.catch(showHint);
      }
      return true;
    }

    if (action === "standalone") {
      onFullscreenStateChange(true);
      onFullscreenHintChange(false);
      return true;
    }

    if (action === "hint") {
      showHint();
      return false;
    }

    const request = requestFullscreen
      ? requestFullscreen.call(fullscreenTarget, { navigationUI: "hide" })
      : webkitRequestFullscreen?.call(fullscreenTarget);
    if (request && typeof request.catch === "function") {
      request
        .then(() => {
          onFullscreenStateChange(true);
          onFullscreenHintChange(false);
        })
        .catch(showHint);
    } else {
      onFullscreenStateChange(true);
      onFullscreenHintChange(false);
    }
    return true;
  } catch {
    showHint();
    return false;
  }
}
