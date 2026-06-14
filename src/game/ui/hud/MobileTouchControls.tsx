import { useRef } from "react";
import { MobileActionCluster } from "./MobileActionCluster";
import { MobileJoystick } from "./MobileJoystick";
import { MobileTopActions } from "./MobileTopActions";
import { useMobileTouchControlRuntime } from "./mobileTouchControlsRuntime";

export function MobileTouchControls({
  openSpellMenu,
  pauseTouchGameplay,
  openEngineMenu,
  showEngineMenuButton = false,
}: {
  openSpellMenu: () => void;
  pauseTouchGameplay: () => void;
  openEngineMenu?: () => void;
  showEngineMenuButton?: boolean;
}) {
  const joystickRef = useRef<HTMLDivElement>(null);
  const joystickKnobRef = useRef<HTMLDivElement>(null);
  const {
    beginLook,
    beginMove,
    endLook,
    endMove,
    moveLook,
    moveStick,
    resetMove,
    setButton,
    setCast,
  } = useMobileTouchControlRuntime({ joystickRef, joystickKnobRef });

  return (
    <div data-testid="mobile-touch-controls" data-wof-hud-qa="mobile-touch-controls" className="mobile-touch-controls pointer-events-none absolute inset-0 z-[85] select-none">
      <div
        className="pointer-events-auto absolute inset-y-0 right-0 w-[58%]"
        style={{ touchAction: "none" }}
        onPointerDown={beginLook}
        onPointerMove={moveLook}
        onPointerUp={endLook}
        onPointerCancel={endLook}
      />

      <MobileTopActions
        openSpellMenu={openSpellMenu}
        pauseTouchGameplay={pauseTouchGameplay}
        openEngineMenu={openEngineMenu}
        showEngineMenuButton={showEngineMenuButton}
      />

      <MobileJoystick
        joystickRef={joystickRef}
        joystickKnobRef={joystickKnobRef}
        beginMove={beginMove}
        moveStick={moveStick}
        endMove={endMove}
        resetMove={resetMove}
      />

      <MobileActionCluster setButton={setButton} setCast={setCast} />
    </div>
  );
}
