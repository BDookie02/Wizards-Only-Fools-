import {
  getAspectRatioHudQaRouteSummary,
  getAspectRatioHudQaStateSummary,
  getAspectRatioQaProfile,
  getAspectRatioQaProfileSummary,
  isAspectRatioQaMatrixEnabled,
} from "./aspectRatioQaMatrix";
import type { AspectRatioOption } from "../../../store/gameStore";
import { readAppViewportSize } from "../../systems/input/mobileLayoutRuntime";
import {
  APP_FRAME_QA_ASPECT_DATASET_KEYS,
  APP_FRAME_QA_DATASET_KEYS,
  resolveAppFrameQaMetrics,
} from "./appFrameQaRuntime";

let lastAppFrameQaSnapshot = "";

export function clearAppFrameQaMetrics() {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  for (const key of APP_FRAME_QA_DATASET_KEYS) {
    delete root.dataset[key];
  }
  for (const key of APP_FRAME_QA_ASPECT_DATASET_KEYS) {
    delete root.dataset[key];
  }
  lastAppFrameQaSnapshot = "";
}

export function updateAppFrameQaMetrics(frame: HTMLElement | null, safeAspectRatio: AspectRatioOption, isFill: boolean) {
  if (typeof window === "undefined" || typeof document === "undefined" || !frame) return;

  const rect = frame.getBoundingClientRect();
  const { width: viewportWidth, height: viewportHeight } = readAppViewportSize();
  const aspectMatrixEnabled = isAspectRatioQaMatrixEnabled();
  const profile = aspectMatrixEnabled ? getAspectRatioQaProfile(viewportWidth, viewportHeight) : null;
  const metrics = resolveAppFrameQaMetrics({
    safeAspectRatio,
    isFill,
    frameRect: rect,
    viewportWidth,
    viewportHeight,
    aspectMatrixEnabled,
    profile,
    aspectProfileSummary: aspectMatrixEnabled ? getAspectRatioQaProfileSummary() : "",
    aspectHudStateSummary: aspectMatrixEnabled ? getAspectRatioHudQaStateSummary() : "",
    aspectHudRouteSummary: aspectMatrixEnabled ? getAspectRatioHudQaRouteSummary() : "",
  });
  const root = document.documentElement;
  const snapshot = metrics.snapshot;
  if (snapshot === lastAppFrameQaSnapshot) return;
  lastAppFrameQaSnapshot = snapshot;

  for (const key of APP_FRAME_QA_DATASET_KEYS) {
    root.dataset[key] = metrics.appDatasetValues[key];
  }

  if (metrics.aspectDatasetValues) {
    for (const key of APP_FRAME_QA_ASPECT_DATASET_KEYS) {
      root.dataset[key] = metrics.aspectDatasetValues[key];
    }
    return;
  }

  for (const key of APP_FRAME_QA_ASPECT_DATASET_KEYS) {
    delete root.dataset[key];
  }
}
