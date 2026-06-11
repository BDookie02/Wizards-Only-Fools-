import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { isForcedTouchControlsQaMode, isTouchGameplayDevice } from "../../systems/input/performanceMode";
import { releaseMobileGameplayInputs } from "./mobileTouchEvents";

type GameplayInputMode = "mouse" | "touch" | "controller";

type HudTouchGameplayRuntimeOptions = {
  isGameLaunched: boolean;
  isTouchControlsActive: boolean;
  lastGameplayInputModeRef: MutableRefObject<GameplayInputMode>;
  setControllerGameplayActive: (active: boolean) => void;
  setIsReturningToGame: (active: boolean) => void;
  setPauseMenuOpen: (open: boolean) => void;
  setPauseOverlayOpen: (open: boolean) => void;
  setShowVideoMenu: (open: boolean) => void;
  setTouchControlsActive: (active: boolean) => void;
};

export function useHudTouchGameplayRuntime({
  isGameLaunched,
  isTouchControlsActive,
  lastGameplayInputModeRef,
  setControllerGameplayActive,
  setIsReturningToGame,
  setPauseMenuOpen,
  setPauseOverlayOpen,
  setShowVideoMenu,
  setTouchControlsActive,
}: HudTouchGameplayRuntimeOptions) {
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const isTouchDeviceRef = useRef(false);

  useEffect(() => {
    const updateTouchCapability = () => {
      const nextIsTouchDevice = isTouchGameplayDevice();
      if (isTouchDeviceRef.current === nextIsTouchDevice) return;
      isTouchDeviceRef.current = nextIsTouchDevice;
      setIsTouchDevice(nextIsTouchDevice);
    };

    updateTouchCapability();
    window.addEventListener("resize", updateTouchCapability);
    return () => window.removeEventListener("resize", updateTouchCapability);
  }, []);

  useEffect(() => {
    if (isTouchDevice || !isTouchControlsActive) return;
    setTouchControlsActive(false);
    releaseMobileGameplayInputs();
  }, [isTouchControlsActive, isTouchDevice, setTouchControlsActive]);

  useEffect(() => {
    if (!import.meta.env.DEV || !isForcedTouchControlsQaMode() || !isTouchDevice || !isGameLaunched || isTouchControlsActive) return;

    document.documentElement.classList.remove("wizards-mouse-gameplay-active");
    lastGameplayInputModeRef.current = "touch";
    setPauseOverlayOpen(false);
    setPauseMenuOpen(false);
    setTouchControlsActive(true);
    setControllerGameplayActive(false);
    setIsReturningToGame(false);
    setShowVideoMenu(false);
  }, [
    isGameLaunched,
    isTouchControlsActive,
    isTouchDevice,
    lastGameplayInputModeRef,
    setControllerGameplayActive,
    setIsReturningToGame,
    setPauseMenuOpen,
    setPauseOverlayOpen,
    setShowVideoMenu,
    setTouchControlsActive,
  ]);

  useEffect(() => {
    const touchGameplayLayout = isTouchDevice && isTouchControlsActive;
    document.documentElement.classList.toggle("wizards-touch-gameplay", touchGameplayLayout);
    return () => {
      document.documentElement.classList.remove("wizards-touch-gameplay");
    };
  }, [isTouchControlsActive, isTouchDevice]);

  return isTouchDevice;
}
