import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { SURVIVAL_BLOCK_SIZE, useGameStore } from "../../../../store/gameStore";
import {
  didGameCanvasResizeChange,
  getGameCanvasResizeSnapshot,
  type GameCanvasResizeSnapshot,
} from "./canvasResizeRuntime";
import { applyGameCanvasElementSizing } from "./gameCanvasElementSizing";
import { isCurrentQaTelemetryRouteEnabled } from "../../../tools/qa/qaRouteTelemetry";

function shouldPublishCanvasResizeNudgeTelemetry() {
  return isCurrentQaTelemetryRouteEnabled(["perf", "hud", "aspect", "canvas", "touch"]);
}

export function CanvasResizeNudge() {
  const aspectRatio = useGameStore(s => s.aspectRatio);
  const { camera, gl, invalidate, setSize } = useThree();

  useEffect(() => {
    const publishTelemetry = shouldPublishCanvasResizeNudgeTelemetry();
    let raf = 0;
    let timeout = 0;
    let resizeApplyCount = 0;
    let resizeSkipCount = 0;
    let lastSnapshot: GameCanvasResizeSnapshot | null = null;
    const parent = gl.domElement.parentElement;

    const resizeCanvas = () => {
      raf = 0;
      if (!parent) return;

      const rect = parent.getBoundingClientRect();
      const width = Math.max(1, Math.round(rect.width));
      const height = Math.max(1, Math.round(rect.height));
      if (width <= 0 || height <= 0) return;

      const nextSnapshot = getGameCanvasResizeSnapshot(width, height);
      if (!didGameCanvasResizeChange(lastSnapshot, nextSnapshot)) {
        resizeSkipCount += 1;
        if (publishTelemetry) {
          document.documentElement.dataset.wofGameCanvasResizeSkips = String(resizeSkipCount);
        }
        return;
      }
      lastSnapshot = nextSnapshot;
      resizeApplyCount += 1;
      if (publishTelemetry) {
        document.documentElement.dataset.wofGameCanvasResizeApplies = String(resizeApplyCount);
      }
      applyGameCanvasElementSizing(gl.domElement, { width, height });
      gl.setSize(width, height, false);
      setSize(width, height);
      if ((camera as THREE.PerspectiveCamera).isPerspectiveCamera) {
        const perspectiveCamera = camera as THREE.PerspectiveCamera;
        perspectiveCamera.aspect = width / height;
        perspectiveCamera.near = 0.035;
        perspectiveCamera.far = SURVIVAL_BLOCK_SIZE * 18;
        perspectiveCamera.updateProjectionMatrix();
      }
      invalidate();
    };

    const scheduleResize = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(resizeCanvas);
    };

    const observer = typeof ResizeObserver !== "undefined" && parent
      ? new ResizeObserver(scheduleResize)
      : null;

    if (parent) observer?.observe(parent);
    scheduleResize();
    timeout = window.setTimeout(scheduleResize, 140);
    window.addEventListener("resize", scheduleResize);
    window.addEventListener("orientationchange", scheduleResize);

    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      window.clearTimeout(timeout);
      observer?.disconnect();
      window.removeEventListener("resize", scheduleResize);
      window.removeEventListener("orientationchange", scheduleResize);
      delete document.documentElement.dataset.wofGameCanvasResizeApplies;
      delete document.documentElement.dataset.wofGameCanvasResizeSkips;
    };
  }, [aspectRatio, camera, gl, invalidate, setSize]);

  return null;
}
