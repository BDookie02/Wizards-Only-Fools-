import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { isQaTelemetryRouteEnabledFromSearch } from "../../../tools/qa/qaRouteTelemetry";

export function shouldPublishCanvasRuntimeFrameTelemetryFromSearch(search: string) {
  return isQaTelemetryRouteEnabledFromSearch(search, ["perf", "hud", "aspect", "canvas"]);
}

export function CanvasRuntimeProbe() {
  const publishFrameTelemetry = useMemo(() => (
    typeof window !== "undefined" &&
    shouldPublishCanvasRuntimeFrameTelemetryFromSearch(window.location.search)
  ), []);
  if (!publishFrameTelemetry) return null;

  return <CanvasRuntimeTelemetryProbe />;
}

function CanvasRuntimeTelemetryProbe() {
  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    document.documentElement.dataset.wofCanvasRuntimeMounted = "1";
    document.documentElement.dataset.wofCanvasRuntimeFrameTelemetry = "1";
    return () => {
      delete document.documentElement.dataset.wofCanvasRuntimeMounted;
      delete document.documentElement.dataset.wofCanvasRuntimeFrameTelemetry;
      delete document.documentElement.dataset.wofCanvasRuntimeFrames;
      delete document.documentElement.dataset.wofCanvasRuntimeLastFrameAt;
    };
  }, []);

  return <CanvasRuntimeFrameTelemetry />;
}

function CanvasRuntimeFrameTelemetry() {
  const frameCountRef = useRef(0);

  useFrame(() => {
    if (typeof document === "undefined") return;
    frameCountRef.current += 1;
    if (frameCountRef.current === 1 || frameCountRef.current % 10 === 0) {
      document.documentElement.dataset.wofCanvasRuntimeFrames = String(frameCountRef.current);
      document.documentElement.dataset.wofCanvasRuntimeLastFrameAt = String(Math.round(performance.now()));
    }
  });

  return null;
}
