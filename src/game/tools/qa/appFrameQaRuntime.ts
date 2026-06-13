import type { AspectRatioOption } from "../../../store/gameStore";
import type { AspectRatioQaProfile } from "./aspectRatioQaMatrix";

export type AppFrameQaRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type AppFrameQaMetricsInput = {
  safeAspectRatio: AspectRatioOption;
  isFill: boolean;
  frameRect: AppFrameQaRect;
  viewportWidth: number;
  viewportHeight: number;
  aspectMatrixEnabled: boolean;
  profile: AspectRatioQaProfile | null;
  aspectProfileSummary?: string;
  aspectHudStateSummary?: string;
  aspectHudRouteSummary?: string;
};

export const APP_FRAME_QA_DATASET_KEYS = [
  "wofAppAspectRatio",
  "wofAppFrameFill",
  "wofAppViewportSize",
  "wofAppFrameSize",
  "wofAppFrameAspect",
  "wofAppFrameOffset",
  "wofAppFrameHorizontalInset",
  "wofAppFrameVerticalInset",
] as const;

export const APP_FRAME_QA_ASPECT_DATASET_KEYS = [
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

export type AppFrameQaDatasetKey = (typeof APP_FRAME_QA_DATASET_KEYS)[number];
export type AppFrameQaAspectDatasetKey = (typeof APP_FRAME_QA_ASPECT_DATASET_KEYS)[number];

export type AppFrameQaMetricsResult = {
  snapshot: string;
  appDatasetValues: Record<AppFrameQaDatasetKey, string>;
  aspectDatasetValues: Record<AppFrameQaAspectDatasetKey, string> | null;
};

export function resolveAppFrameQaMetrics({
  safeAspectRatio,
  isFill,
  frameRect,
  viewportWidth,
  viewportHeight,
  aspectMatrixEnabled,
  profile,
  aspectProfileSummary = "",
  aspectHudStateSummary = "",
  aspectHudRouteSummary = "",
}: AppFrameQaMetricsInput): AppFrameQaMetricsResult {
  const frameWidth = Math.max(1, Math.round(frameRect.width));
  const frameHeight = Math.max(1, Math.round(frameRect.height));
  const frameLeft = Math.round(frameRect.left);
  const frameTop = Math.round(frameRect.top);
  const frameAspect = (frameRect.width / Math.max(1, frameRect.height)).toFixed(4);
  const horizontalInset = Math.max(0, Math.round((viewportWidth - frameRect.width) * 0.5));
  const verticalInset = Math.max(0, Math.round((viewportHeight - frameRect.height) * 0.5));
  const frameFill = isFill ? "1" : "0";
  const aspectProfile = profile?.id ?? "custom";
  const aspectProfileSize = profile ? `${profile.width}x${profile.height}` : "custom";
  const expectedTouchLayout = profile?.expectedTouchLayout ? "1" : "0";
  const expectedTouchControls = profile?.expectedTouchControls ? "1" : "0";
  const aspectFrameMode = `${safeAspectRatio}:${isFill ? "fill" : "boxed"}`;
  const snapshot = `${safeAspectRatio}|${frameFill}|${viewportWidth}|${viewportHeight}|${frameWidth}|${frameHeight}|${frameLeft}|${frameTop}|${frameAspect}|${horizontalInset}|${verticalInset}|${aspectMatrixEnabled ? "1" : "0"}|${aspectProfile}|${aspectProfileSize}|${expectedTouchLayout}|${expectedTouchControls}|${aspectFrameMode}`;

  const appDatasetValues: Record<AppFrameQaDatasetKey, string> = {
    wofAppAspectRatio: safeAspectRatio,
    wofAppFrameFill: frameFill,
    wofAppViewportSize: `${viewportWidth}x${viewportHeight}`,
    wofAppFrameSize: `${frameWidth}x${frameHeight}`,
    wofAppFrameAspect: frameAspect,
    wofAppFrameOffset: `${frameLeft}x${frameTop}`,
    wofAppFrameHorizontalInset: String(horizontalInset),
    wofAppFrameVerticalInset: String(verticalInset),
  };

  const aspectDatasetValues: Record<AppFrameQaAspectDatasetKey, string> | null = aspectMatrixEnabled
    ? {
      wofQaAspectMatrix: "1",
      wofQaAspectProfiles: aspectProfileSummary,
      wofQaHudStateCases: aspectHudStateSummary,
      wofQaAspectHudRoutes: aspectHudRouteSummary,
      wofQaAspectProfile: aspectProfile,
      wofQaAspectProfileSize: aspectProfileSize,
      wofQaAspectExpectedTouchLayout: expectedTouchLayout,
      wofQaAspectExpectedTouchControls: expectedTouchControls,
      wofQaAspectFrameMode: aspectFrameMode,
    }
    : null;

  return {
    snapshot,
    appDatasetValues,
    aspectDatasetValues,
  };
}
