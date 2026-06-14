import { useRef } from "react";
import { MobileHotbarWheel } from "./MobileHotbarWheel";
import { MobileTopActions } from "./MobileTopActions";
import {
  mobileActionButtonClass,
  useMobileTouchControlRuntime,
} from "./mobileTouchControlsRuntime";

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

      <div className="mobile-joystick-zone absolute left-3 bottom-[118px] z-10 flex flex-col gap-2">
        <div
          ref={joystickRef}
          className="mobile-joystick pointer-events-auto relative h-28 w-28 rounded-full border-2 border-cyan-100/35 bg-black/40"
          style={{ touchAction: "none" }}
          onPointerDown={beginMove}
          onPointerMove={moveStick}
          onPointerUp={endMove}
          onPointerCancel={resetMove}
        >
          <div className="mobile-joystick-center absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-100/25" />
          <div
            ref={joystickKnobRef}
            className="mobile-joystick-knob absolute left-1/2 top-1/2 h-12 w-12 rounded-full border border-cyan-100/55 bg-cyan-200/20"
            style={{
              transform: "translate(calc(-50% + 0px), calc(-50% + 0px))",
            }}
          />
        </div>
      </div>

      <div className="mobile-action-cluster absolute right-3 bottom-[108px] z-10 flex items-end gap-4">
        <div className="flex flex-col items-center gap-2">
          <MobileHotbarWheel hand="left" />
          <button
            data-testid="mobile-left-cast"
            className={mobileActionButtonClass}
            onPointerDown={setCast("left", "start")}
            onPointerUp={setCast("left", "end")}
            onPointerCancel={setCast("left", "end")}
          >
            L
          </button>
        </div>
        <div className="mobile-movement-column mb-1 flex flex-col items-center gap-4">
          <button
            data-testid="mobile-jump"
            className={mobileActionButtonClass}
            onPointerDown={setButton("jump", true)}
            onPointerUp={setButton("jump", false)}
            onPointerCancel={setButton("jump", false)}
          >
            JUMP
          </button>
          <button
            data-testid="mobile-slide"
            className={mobileActionButtonClass}
            onPointerDown={setButton("slide", true)}
            onPointerUp={setButton("slide", false)}
            onPointerCancel={setButton("slide", false)}
          >
            SLIDE
          </button>
          <button
            data-testid="mobile-sprint"
            className={mobileActionButtonClass}
            onPointerDown={setButton("sprint", true)}
            onPointerUp={setButton("sprint", false)}
            onPointerCancel={setButton("sprint", false)}
          >
            RUN
          </button>
        </div>
        <div className="flex flex-col items-center gap-2">
          <MobileHotbarWheel hand="right" />
          <button
            data-testid="mobile-right-cast"
            className={mobileActionButtonClass}
            onPointerDown={setCast("right", "start")}
            onPointerUp={setCast("right", "end")}
            onPointerCancel={setCast("right", "end")}
          >
            R
          </button>
        </div>
      </div>
    </div>
  );
}
