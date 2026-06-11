import type { CSSProperties } from "react";
import { SURVIVAL_BLOCK_SIZE } from "../../../store/gameStore";

const canvasBaseStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  display: "block",
};

export function getGameWorldCanvasStyle(isSurvivalMode: boolean, mobilePerformanceMode: boolean): CSSProperties {
  return mobilePerformanceMode
    ? {
      ...canvasBaseStyle,
      backgroundColor: isSurvivalMode ? "#bcefff" : "#9bdcff",
      filter: "none",
      WebkitFilter: "none",
      imageRendering: "pixelated",
      colorScheme: "only light",
    }
    : {
      ...canvasBaseStyle,
      backgroundColor: isSurvivalMode ? "#bcefff" : "#000000",
      imageRendering: "pixelated",
    };
}

export function getGameWorldLightingConfig(isSurvivalMode: boolean, mobilePerformanceMode: boolean) {
  return {
    ambientIntensity: mobilePerformanceMode ? 1.25 : isSurvivalMode ? 0.72 : 0.4,
    directionalIntensity: mobilePerformanceMode ? 2.55 : isSurvivalMode ? 1.85 : 1.5,
  };
}

export function getGameWorldHorizonConfig(isSurvivalMode: boolean) {
  return {
    radius: isSurvivalMode ? SURVIVAL_BLOCK_SIZE * 5.5 : 400,
    height: isSurvivalMode ? 2200 : 250,
    y: isSurvivalMode ? 330 : 40,
    segments: isSurvivalMode ? 96 : 64,
  };
}
