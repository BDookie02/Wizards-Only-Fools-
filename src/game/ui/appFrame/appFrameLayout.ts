import type { CSSProperties } from "react";
import type { AspectRatioOption } from "../../../store/gameStore";

export type AppFrameLayout = {
  safeAspectRatio: AspectRatioOption;
  isFill: boolean;
  frameStyle: CSSProperties;
};

type AspectRatioDimensions = {
  width: number;
  height: number;
};

const APP_VIEWPORT_SIZE_STYLE: CSSProperties = {
  width: "var(--app-vw, 100dvw)",
  height: "var(--app-vh, 100dvh)",
};

const APP_FRAME_ASPECT_DIMENSIONS: Record<Exclude<AspectRatioOption, "Fill">, AspectRatioDimensions> = {
  "16/9": { width: 16, height: 9 },
  "4/3": { width: 4, height: 3 },
  "21/9": { width: 21, height: 9 },
};

function makeAspectFrameStyle({ width, height }: AspectRatioDimensions): CSSProperties {
  const ratio = width / height;
  return {
    width: `min(var(--app-vw, 100dvw), calc(var(--app-vh, 100dvh) * ${ratio}))`,
    height: `min(var(--app-vh, 100dvh), calc(var(--app-vw, 100dvw) / ${ratio}))`,
    maxWidth: "var(--app-vw, 100dvw)",
    maxHeight: "var(--app-vh, 100dvh)",
    aspectRatio: `${width} / ${height}`,
  };
}

const APP_FRAME_LAYOUTS: Record<AspectRatioOption, AppFrameLayout> = {
  "16/9": {
    safeAspectRatio: "16/9",
    isFill: false,
    frameStyle: makeAspectFrameStyle(APP_FRAME_ASPECT_DIMENSIONS["16/9"]),
  },
  "4/3": {
    safeAspectRatio: "4/3",
    isFill: false,
    frameStyle: makeAspectFrameStyle(APP_FRAME_ASPECT_DIMENSIONS["4/3"]),
  },
  "21/9": {
    safeAspectRatio: "21/9",
    isFill: false,
    frameStyle: makeAspectFrameStyle(APP_FRAME_ASPECT_DIMENSIONS["21/9"]),
  },
  Fill: {
    safeAspectRatio: "Fill",
    isFill: true,
    frameStyle: APP_VIEWPORT_SIZE_STYLE,
  },
};

export function getAppFrameLayout(safeAspectRatio: AspectRatioOption): AppFrameLayout {
  return APP_FRAME_LAYOUTS[safeAspectRatio];
}
