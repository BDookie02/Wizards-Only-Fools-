import { shouldMountCanvasRuntimeProbeFromSearch } from "./canvasQaTelemetryRoute";

export function shouldPublishCanvasRuntimeFrameTelemetryFromSearch(search: string) {
  return shouldMountCanvasRuntimeProbeFromSearch(search);
}

export function getCanvasRuntimeFrameNowMs() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}
