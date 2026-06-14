import type { AppViewportSize } from "./mobileViewportRuntime";

export type MobileLayoutAspectRatio = "16/9" | "4/3" | "1/1" | "Fill";

export type MobileLayoutDefaultRuleOptions = {
  mobileLikeDevice: boolean;
  aspectRatio: string;
  hasStoredAspectRatio: boolean;
  mouseSensitivity: number;
  defaultMouseSensitivity: number;
  defaultMobileLookSensitivity: number;
};

export type MobileLayoutDefaultActions = {
  aspectRatio: MobileLayoutAspectRatio | null;
  mouseSensitivity: number | null;
};

export type InputLayoutClassState = {
  touchLayout: boolean;
  removeTouchGameplay: boolean;
};

export type AppViewportCssVarValues = {
  appVw: string;
  appVh: string;
};

export function resolveMobileLayoutDefaultActions({
  mobileLikeDevice,
  aspectRatio,
  hasStoredAspectRatio,
  mouseSensitivity,
  defaultMouseSensitivity,
  defaultMobileLookSensitivity,
}: MobileLayoutDefaultRuleOptions): MobileLayoutDefaultActions {
  if (!mobileLikeDevice) {
    return { aspectRatio: null, mouseSensitivity: null };
  }

  return {
    aspectRatio: aspectRatio === "16/9" && !hasStoredAspectRatio ? "Fill" : null,
    mouseSensitivity: mouseSensitivity === defaultMouseSensitivity ? defaultMobileLookSensitivity : null,
  };
}

export function resolveInputLayoutClassState(mobileLikeDevice: boolean): InputLayoutClassState {
  return {
    touchLayout: mobileLikeDevice,
    removeTouchGameplay: !mobileLikeDevice,
  };
}

export function resolveAppViewportCssVarValues({ width, height }: AppViewportSize): AppViewportCssVarValues {
  return {
    appVw: `${width}px`,
    appVh: `${height}px`,
  };
}
