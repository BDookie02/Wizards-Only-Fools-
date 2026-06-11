import { shouldPublishCanvasLayoutTelemetry } from "./canvasQaTelemetryRoute";

export type GameCanvasSize = {
  width: number;
  height: number;
};

function publishGameCanvasSizingQa(canvas: HTMLCanvasElement, size?: GameCanvasSize) {
  if (!shouldPublishCanvasLayoutTelemetry()) return;

  const rect = canvas.getBoundingClientRect();
  document.documentElement.dataset.wofGameCanvasCssSize = [
    Math.round(rect.width),
    Math.round(rect.height),
  ].join("x");
  document.documentElement.dataset.wofGameCanvasBackingSize = [
    canvas.width,
    canvas.height,
  ].join("x");
  if (size) {
    document.documentElement.dataset.wofGameCanvasTargetSize = [
      size.width,
      size.height,
    ].join("x");
  }
}

export function applyGameCanvasElementSizing(canvas: HTMLCanvasElement, size?: GameCanvasSize) {
  canvas.style.display = "block";
  canvas.style.touchAction = "none";
  canvas.style.imageRendering = "pixelated";

  if (size) {
    canvas.style.width = `${size.width}px`;
    canvas.style.height = `${size.height}px`;
  } else {
    canvas.style.width = "100%";
    canvas.style.height = "100%";
  }

  publishGameCanvasSizingQa(canvas, size);
}
