import * as THREE from "three";
import { isCurrentQaTelemetryRouteEnabled } from "../../../tools/qa/qaRouteTelemetry";

function shouldPublishRendererCreatedTelemetry() {
  return isCurrentQaTelemetryRouteEnabled(["perf", "canvas", "hud", "aspect", "touch", "mountain", "survival"]);
}

export function configureGameRenderer(gl: THREE.WebGLRenderer) {
  gl.outputColorSpace = THREE.SRGBColorSpace;
  gl.toneMapping = THREE.NoToneMapping;
  gl.toneMappingExposure = 1;

  // Mobile browsers can compound CSS post-filters while resizing/fullscreening a
  // WebGL canvas. Keep the canvas unfiltered and let Three handle color output.
  gl.domElement.style.setProperty("filter", "none");
  gl.domElement.style.setProperty("-webkit-filter", "none");
  gl.domElement.style.setProperty("color-scheme", "only light");
  gl.domElement.style.setProperty("width", "100%");
  gl.domElement.style.setProperty("height", "100%");
  if (shouldPublishRendererCreatedTelemetry()) {
    document.documentElement.dataset.wofCanvasRendererCreated = "1";
  }
}
