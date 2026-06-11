import {
  getAspectRatioHudQaRouteSummary,
  getAspectRatioHudQaStateSummary,
  getAspectRatioQaProfile,
  getAspectRatioQaProfileSummary,
  isAspectRatioQaMatrixEnabled,
} from "./aspectRatioQaMatrix";
import type { AspectRatioOption } from "../../../store/gameStore";
import { readAppViewportSize } from "../../systems/input/mobileLayoutRuntime";

const APP_FRAME_QA_DATASET_KEYS = [
  "wofAppAspectRatio",
  "wofAppFrameFill",
  "wofAppViewportSize",
  "wofAppFrameSize",
  "wofAppFrameAspect",
  "wofAppFrameOffset",
  "wofAppFrameHorizontalInset",
  "wofAppFrameVerticalInset",
] as const;

const QA_ASPECT_DATASET_KEYS = [
  "wofQaAspectMatrix",
  "wofQaAspectProfiles",
  "wofQaHudStateCases",
  "wofQaAspectHudRoutes",
  "wofQaAspectProfile",
  "wofQaAspectProfileSize",
  "wofQaAspectExpectedTouchLayout",
  "wofQaAspectExpectedTouchControls",
  "wofQaAspectFrameMode",
] as const;

let lastAppFrameQaSnapshot = "";

export function clearAppFrameQaMetrics() {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  for (const key of APP_FRAME_QA_DATASET_KEYS) {
    delete root.dataset[key];
  }
  for (const key of QA_ASPECT_DATASET_KEYS) {
    delete root.dataset[key];
  }
  lastAppFrameQaSnapshot = "";
}

export function updateAppFrameQaMetrics(frame: HTMLElement | null, safeAspectRatio: AspectRatioOption, isFill: boolean) {
  if (typeof window === "undefined" || typeof document === "undefined" || !frame) return;

  const rect = frame.getBoundingClientRect();
  const { width: viewportWidth, height: viewportHeight } = readAppViewportSize();
  const frameWidth = Math.max(1, Math.round(rect.width));
  const frameHeight = Math.max(1, Math.round(rect.height));
  const frameLeft = Math.round(rect.left);
  const frameTop = Math.round(rect.top);
  const frameAspect = (rect.width / Math.max(1, rect.height)).toFixed(4);
  const horizontalInset = Math.max(0, Math.round((viewportWidth - rect.width) * 0.5));
  const verticalInset = Math.max(0, Math.round((viewportHeight - rect.height) * 0.5));
  const frameFill = isFill ? "1" : "0";
  const aspectMatrixEnabled = isAspectRatioQaMatrixEnabled();
  const profile = aspectMatrixEnabled ? getAspectRatioQaProfile(viewportWidth, viewportHeight) : null;
  const aspectProfile = profile?.id ?? "custom";
  const aspectProfileSize = profile ? `${profile.width}x${profile.height}` : "custom";
  const expectedTouchLayout = profile?.expectedTouchLayout ? "1" : "0";
  const expectedTouchControls = profile?.expectedTouchControls ? "1" : "0";
  const aspectFrameMode = `${safeAspectRatio}:${isFill ? "fill" : "boxed"}`;
  const root = document.documentElement;
  const snapshot = `${safeAspectRatio}|${frameFill}|${viewportWidth}|${viewportHeight}|${frameWidth}|${frameHeight}|${frameLeft}|${frameTop}|${frameAspect}|${horizontalInset}|${verticalInset}|${aspectMatrixEnabled ? "1" : "0"}|${aspectProfile}|${aspectProfileSize}|${expectedTouchLayout}|${expectedTouchControls}|${aspectFrameMode}`;
  if (snapshot === lastAppFrameQaSnapshot) return;
  lastAppFrameQaSnapshot = snapshot;

  root.dataset.wofAppAspectRatio = safeAspectRatio;
  root.dataset.wofAppFrameFill = frameFill;
  root.dataset.wofAppViewportSize = `${viewportWidth}x${viewportHeight}`;
  root.dataset.wofAppFrameSize = `${frameWidth}x${frameHeight}`;
  root.dataset.wofAppFrameAspect = frameAspect;
  root.dataset.wofAppFrameOffset = `${frameLeft}x${frameTop}`;
  root.dataset.wofAppFrameHorizontalInset = String(horizontalInset);
  root.dataset.wofAppFrameVerticalInset = String(verticalInset);

  if (aspectMatrixEnabled) {
    root.dataset.wofQaAspectMatrix = "1";
    root.dataset.wofQaAspectProfiles = getAspectRatioQaProfileSummary();
    root.dataset.wofQaHudStateCases = getAspectRatioHudQaStateSummary();
    root.dataset.wofQaAspectHudRoutes = getAspectRatioHudQaRouteSummary();
    root.dataset.wofQaAspectProfile = aspectProfile;
    root.dataset.wofQaAspectProfileSize = aspectProfileSize;
    root.dataset.wofQaAspectExpectedTouchLayout = expectedTouchLayout;
    root.dataset.wofQaAspectExpectedTouchControls = expectedTouchControls;
    root.dataset.wofQaAspectFrameMode = aspectFrameMode;
    return;
  }

  for (const key of QA_ASPECT_DATASET_KEYS) {
    delete root.dataset[key];
  }
}
